"""
GIS Exporter Module for SIH26161 (NTRO).
Generates official geospatial deliverables:
1. ESRI Shapefile bundle (.shp, .shx, .dbf, .prj inside a .zip)
2. Google Earth (.kml) with styled depth/hazard tiers
"""

import os
import io
import zipfile
import tempfile
import numpy as np
import geopandas as gpd
from shapely.geometry import box


# ---------------------------------------------------------------------------
# One polygonizer, shared by both exporters.
#
# The .shp and the .kml are opened side by side -- one in QGIS, one in Google
# Earth -- so a reviewer reads them as two views of a single result. They used
# to derive the extent independently, and the KML's copy never read the depth
# grid at all: `generate_kml` ignored its own first argument and emitted the
# four corners of the raster bounds. A run that flooded a strip of the domain
# therefore produced a "Inundation Perimeter" covering the entire domain, while
# the shapefile from that same run drew the wet cells. Two deliverables
# disagreeing about where the water went is worse than either being coarse, so
# both now read the grid through this one function.
# ---------------------------------------------------------------------------

INUNDATION_THRESHOLD_M = 0.1

# Ordered high -> low; the first floor a depth reaches names its band. These are
# the thresholds the shapefile always used, kept unchanged so hazard categories
# stay comparable with exports already handed out.
HAZARD_BANDS = ((3.0, "EXTREME"), (1.5, "HIGH"), (0.5, "MODERATE"), (0.0, "LOW"))

# Draw order for the KML: lower bands first, so the deepest water ends up on
# top where the tiers overlap.
HAZARD_DRAW_ORDER = {"LOW": 0, "MODERATE": 1, "HIGH": 2, "EXTREME": 3}


def classify_hazard(depth_m: float) -> str:
    """Hazard band for a depth in metres."""
    for floor, name in HAZARD_BANDS:
        if depth_m >= floor:
            return name
    return "LOW"


def inundation_cells(depth_grid, bounds):
    """Wet blocks of the depth grid as a list of (polygon, depth_m, hazard).

    Returns an empty list when no block exceeds the inundation threshold. That
    is a real answer -- it means the run put no water in this domain -- and
    callers are expected to report it rather than substitute a shape, because a
    plausible-looking polygon standing in for a solve that produced nothing is
    indistinguishable from a real result once it is in someone's GIS.
    """
    min_lon, min_lat, max_lon, max_lat = bounds
    nrow, ncol = depth_grid.shape

    d_lon = (max_lon - min_lon) / ncol
    d_lat = (max_lat - min_lat) / nrow

    # Sampling stride. Coarsens a large grid so vectorisation stays fast without
    # changing the footprint; a small grid takes every cell.
    step = max(1, nrow // 50)

    cells = []
    for r in range(0, nrow - step, step):
        for c in range(0, ncol - step, step):
            max_d = float(np.max(depth_grid[r:r + step, c:c + step]))
            if max_d > INUNDATION_THRESHOLD_M:
                cells.append((
                    box(min_lon + c * d_lon,
                        max_lat - (r + step) * d_lat,
                        min_lon + (c + step) * d_lon,
                        max_lat - r * d_lat),
                    round(max_d, 2),
                    classify_hazard(max_d),
                ))
    return cells


def generate_shapefile_zip(
    depth_grid: np.ndarray,
    bounds: tuple, # (min_lon, min_lat, max_lon, max_lat)
    dam_name: str = "Dam",
    arrival_time_s: float = 0.0
):
    """
    Polygonizes depth grid into hazard tiers and returns an ESRI Shapefile .zip
    as bytes, or None when the grid holds no inundation.
    """
    cells = inundation_cells(depth_grid, bounds)
    if not cells:
        return None

    gdf = gpd.GeoDataFrame({
        "dam_name": [dam_name[:30]] * len(cells),
        "depth_m": [depth for _, depth, _ in cells],
        "hazard": [hazard for _, _, hazard in cells],
        "arrival_s": [round(arrival_time_s, 1)] * len(cells),
        "geometry": [poly for poly, _, _ in cells],
    }, crs="EPSG:4326")

    # Dissolve contiguous polygons by hazard category for clean GIS layers
    try:
        dissolved = gdf.dissolve(by="hazard", aggfunc={"depth_m": "max", "arrival_s": "first", "dam_name": "first"}).reset_index()
    except Exception:
        dissolved = gdf

    with tempfile.TemporaryDirectory() as tmp_dir:
        base_name = f"{dam_name.lower().replace(' ', '_')[:20]}_inundation"
        shp_file = os.path.join(tmp_dir, f"{base_name}.shp")
        dissolved.to_file(shp_file, driver="ESRI Shapefile")

        # Package into ZIP
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as z:
            for ext in [".shp", ".shx", ".dbf", ".prj"]:
                fpath = os.path.join(tmp_dir, f"{base_name}{ext}")
                if os.path.exists(fpath):
                    z.write(fpath, arcname=f"{base_name}{ext}")

        return zip_buf.getvalue()


def _ring_coordinates(ring) -> str:
    """A KML <coordinates> payload for one linear ring."""
    return " ".join(f"{x:.6f},{y:.6f},0" for x, y in ring.coords)


def _kml_polygon_blocks(geom, indent: str):
    """<Polygon> blocks for a Polygon or MultiPolygon, interior rings included."""
    parts = list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]

    blocks = []
    for part in parts:
        blocks.append(f"{indent}<Polygon>")
        blocks.append(f"{indent}  <outerBoundaryIs><LinearRing><coordinates>")
        blocks.append(f"{indent}    {_ring_coordinates(part.exterior)}")
        blocks.append(f"{indent}  </coordinates></LinearRing></outerBoundaryIs>")
        # Holes are real: a dry island inside a flooded reach must not be
        # painted as water.
        for hole in part.interiors:
            blocks.append(f"{indent}  <innerBoundaryIs><LinearRing><coordinates>")
            blocks.append(f"{indent}    {_ring_coordinates(hole)}")
            blocks.append(f"{indent}  </coordinates></LinearRing></innerBoundaryIs>")
        blocks.append(f"{indent}</Polygon>")
    return blocks


def generate_kml(
    depth_grid: np.ndarray,
    bounds: tuple, # (min_lon, min_lat, max_lon, max_lat)
    dam_name: str = "Dam",
    dam_coords: tuple = (0.0, 0.0), # (lat, lon)
    stats: dict = None,
    provenance: str = ""
) -> str:
    """
    Google Earth .kml of the inundated area, one styled placemark per hazard
    band, or None when the grid holds no inundation.

    `provenance` is written into the document description. It is a parameter
    rather than a literal in this template because the previous hard-coded
    sentence named the ANUGA solver unconditionally, including on the path that
    exported a synthetic grid -- the file asserted a solve that had not run.
    """
    cells = inundation_cells(depth_grid, bounds)
    if not cells:
        return None

    stats = stats or {}
    dam_lat, dam_lon = dam_coords

    gdf = gpd.GeoDataFrame({
        "hazard": [hazard for _, _, hazard in cells],
        "depth_m": [depth for _, depth, _ in cells],
        "geometry": [poly for poly, _, _ in cells],
    }, crs="EPSG:4326")

    try:
        tiers = gdf.dissolve(by="hazard", aggfunc={"depth_m": "max"}).reset_index()
    except Exception:
        tiers = gdf

    tiers = sorted(tiers.to_dict("records"),
                   key=lambda row: HAZARD_DRAW_ORDER.get(row["hazard"], 9))

    kml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<kml xmlns="http://www.opengis.net/kml/2.2">',
        '  <Document>',
        f'    <name>{dam_name} Dam Break Inundation Zone</name>',
        f'    <description>{provenance}</description>',
        '    <Style id="dam_icon">',
        '      <IconStyle><scale>1.3</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/caution.png</href></Icon></IconStyle>',
        '    </Style>',
        '    <Style id="poly_low">',
        '      <LineStyle><color>ff00aa00</color><width>1.5</width></LineStyle>',
        '      <PolyStyle><color>7f00ff00</color></PolyStyle>', # Green/yellow (aabbggrr)
        '    </Style>',
        '    <Style id="poly_high">',
        '      <LineStyle><color>ff0000ff</color><width>2</width></LineStyle>',
        '      <PolyStyle><color>7f0000ff</color></PolyStyle>', # Red (aabbggrr)
        '    </Style>',
        '    <Placemark>',
        f'      <name>{dam_name} Breach Origin</name>',
        f'      <description>Breach point for scenario. Peak depth: {stats.get("max_depth_m", float("nan")):.2f} m. Inundated area: {stats.get("inundated_area_km2", float("nan")):.2f} km²</description>',
        '      <styleUrl>#dam_icon</styleUrl>',
        f'      <Point><coordinates>{dam_lon},{dam_lat},0</coordinates></Point>',
        '    </Placemark>',
    ]

    for tier in tiers:
        # Shallow bands read green, deep bands red -- matching the two styles
        # above, which until now were declared and never referenced.
        style = "poly_high" if tier["hazard"] in ("HIGH", "EXTREME") else "poly_low"
        blocks = _kml_polygon_blocks(tier["geometry"], "        ")

        kml.append('    <Placemark>')
        kml.append(f'      <name>{dam_name} Inundation — {tier["hazard"]}</name>')
        kml.append(f'      <description>Hazard band {tier["hazard"]}, deepest cell '
                   f'{tier["depth_m"]:.2f} m.</description>')
        kml.append(f'      <styleUrl>#{style}</styleUrl>')
        if len(blocks) > 2 and blocks.count("        <Polygon>") > 1:
            kml.append('      <MultiGeometry>')
            kml.extend(blocks)
            kml.append('      </MultiGeometry>')
        else:
            kml.extend(blocks)
        kml.append('    </Placemark>')

    kml.extend([
        '  </Document>',
        '</kml>',
    ])
    return '\n'.join(kml)
