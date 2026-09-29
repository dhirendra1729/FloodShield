"""
Near Real-Time Satellite Analysis Pipeline for SIH26161 (NTRO).

Connects to Sentinel-1 SAR (all-weather radar) via the Element84 STAC API,
reads the actual backscatter raster for the area of interest, filters it, and
delineates water by Otsu thresholding. Verification against the hydrodynamic
simulation is an IoU / Dice comparison of two real masks.

Everything here operates on real scene pixels. Where a scene or an asset cannot
be retrieved the module says so and returns nothing -- it never substitutes
invented scene metadata or a decorative water polygon, which is what earlier
revisions of this file did.

Processing chain
----------------
1. ``refined_lee_filter`` on *linear* backscatter power.  Speckle in SAR is
   multiplicative, so filtering must happen before any dB conversion; doing it
   in dB biases the estimate.
2. Convert to dB.  Speckle is approximately Gaussian in dB and the
   water/land histogram is bimodal there, which is the space Otsu expects.
   (Otsu on linear power is *not* equivalent -- a monotone transform preserves
   the pixel ordering but changes the between-class variance Otsu maximises.)
3. Otsu threshold -> water mask.
4. If a pre-event scene over the same footprint is available, subtract its
   water mask to remove permanent water (rivers, reservoirs, lakes) and leave
   only the new inundation.

Calibration note: absolute sigma0/gamma0 in dB needs the scene's calibration
vector, which the STAC assets do not carry. Detection is unaffected -- Otsu
operates on the same relative scale -- but the reported dB threshold should be
read as relative, not as an absolute backscatter level.
"""

import numpy as np
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from pystac_client import Client

STAC_API_URL = "https://earth-search.aws.element84.com/v1"

# Radiometrically terrain-corrected scenes are preferred: already calibrated and
# geometrically corrected, so no terrain flattening is needed. GRD is the
# fallback, and its digital numbers are handled as linear power.
COLLECTIONS = ("sentinel-1-rtc", "sentinel-1-grd")

# Assets that may hold the co-polarised backscatter, in preference order.
_VV_ASSETS = ("vv", "VV", "sigma0_vv", "gamma0_vv")


# ---------------------------------------------------------------------------
# STAC search
# ---------------------------------------------------------------------------

def _vv_href(item) -> Optional[str]:
    for name in _VV_ASSETS:
        asset = item.assets.get(name)
        if asset is not None and asset.href:
            return asset.href
    return None


def search_sentinel1_scenes(lat: float, lon: float, days_back: int = 30,
                            collections: Tuple[str, ...] = COLLECTIONS
                            ) -> List[Dict[str, Any]]:
    """Query real Sentinel-1 scenes covering a point, newest first.

    Returns ``[]`` when nothing is available.  It deliberately does not fall
    back to hard-coded scene metadata: a fabricated scene id looks like
    evidence of a working pipeline and is worse than an empty list.
    """
    client = Client.open(STAC_API_URL)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days_back)
    date_str = f"{start_date.strftime('%Y-%m-%d')}/{end_date.strftime('%Y-%m-%d')}"

    for collection in collections:
        try:
            search = client.search(
                collections=[collection],
                intersects={"type": "Point", "coordinates": [lon, lat]},
                datetime=date_str,
                max_items=20,
            )
            items = list(search.items())
        except Exception as exc:                      # collection may not exist
            print(f"STAC collection '{collection}' unavailable: {exc}")
            continue

        if not items:
            continue

        scenes = []
        for item in items:
            scenes.append({
                "id": item.id,
                "collection": collection,
                "datetime": (item.datetime.strftime("%Y-%m-%d %H:%M:%SZ")
                             if item.datetime else ""),
                "orbit_direction": item.properties.get("sat:orbit_state", ""),
                "instrument_mode": item.properties.get("sar:instrument_mode", "IW"),
                "polarizations": item.properties.get("sar:polarizations", []),
                "platform": item.properties.get("platform", ""),
                "asset_vv": _vv_href(item),
            })
        scenes.sort(key=lambda s: s["datetime"], reverse=True)
        return scenes

    return []


# ---------------------------------------------------------------------------
# Refined Lee speckle filter
# ---------------------------------------------------------------------------

def refined_lee_filter(image: np.ndarray, size: int = 7, looks: float = 4.0
                       ) -> Tuple[np.ndarray, np.ndarray]:
    """Refined Lee speckle filter (Lee 1981; edge-aligned refined form).

    Input must be *linear* backscatter power.

    For every pixel the local edge orientation is found from four directional
    gradients over the 3x3 neighbourhood.  Of the eight 3x3 sub-windows tiling
    the ring inside the ``size`` x ``size`` window, the two straddling that edge
    are candidates; the more homogeneous of the pair supplies the local mean.
    The pixel is then blended toward that mean by

        ``W = 1 - Cu^2 / Ci^2``,   ``Cu^2 = 1/looks``

    clipped to [0, 1].  Where the local coefficient of variation ``Ci`` falls to
    the speckle floor the window mean is used outright; where it rises (an edge
    or a point target) the centre pixel is kept.

    Returns ``(filtered, direction)`` -- ``direction`` is the index of the
    gradient axis chosen at each pixel, useful for inspecting edge selection.
    """
    img = np.asarray(image, dtype=np.float64)
    valid = np.isfinite(img)
    if not valid.any():
        raise ValueError("backscatter window contains no valid pixels")

    fill = float(np.mean(img[valid]))
    filled = np.where(valid, img, fill)

    k = size // 2
    off = max(k - 1, 1)
    rows, cols = img.shape
    pad = np.pad(filled, k, mode="reflect")

    def at(dy: int, dx: int) -> np.ndarray:
        return pad[k + dy:k + dy + rows, k + dx:k + dx + cols]

    # --- edge orientation from the 3x3 neighbourhood ---
    pts = [at(dy, dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1)]

    def contrast(a: List[int], b: List[int]) -> np.ndarray:
        return np.abs(sum(pts[i] for i in a) - sum(pts[i] for i in b))

    grads = np.stack([
        contrast([0, 1, 2], [6, 7, 8]),   # horizontal edge
        contrast([0, 3, 6], [2, 5, 8]),   # vertical edge
        contrast([1, 2, 5], [3, 6, 7]),   # 45-degree edge
        contrast([0, 1, 3], [5, 7, 8]),   # 135-degree edge
    ])
    direction = np.argmax(grads, axis=0)

    # --- the eight directional 3x3 sub-windows ---
    dirs = [(-1, 0), (-1, 1), (0, 1), (1, 1),
            (1, 0), (1, -1), (0, -1), (-1, -1)]
    means, variances = [], []
    for dy, dx in dirs:
        vals = np.stack([at(dy * off + uy, dx * off + ux)
                         for uy in (-1, 0, 1) for ux in (-1, 0, 1)])
        means.append(vals.mean(axis=0))
        variances.append(vals.var(axis=0))
    means = np.stack(means)
    variances = np.stack(variances)

    # Each gradient axis admits the two windows lying along that edge.
    pairs = {0: (2, 6),    # horizontal edge -> east / west windows
             1: (0, 4),    # vertical edge   -> north / south windows
             2: (1, 7),    # 45-degree edge  -> north-east / south-west
             3: (3, 5)}    # 135-degree edge -> south-east / north-west

    idx = np.zeros_like(direction)
    for axis, (a, b) in pairs.items():
        sel = direction == axis
        if sel.any():
            idx[sel] = np.where(variances[b][sel] < variances[a][sel], b, a)

    sub_mean = np.take_along_axis(means, idx[None], axis=0)[0]
    sub_var = np.take_along_axis(variances, idx[None], axis=0)[0]

    cu2 = 1.0 / max(looks, 1.0)
    with np.errstate(divide="ignore", invalid="ignore"):
        ci2 = sub_var / np.maximum(sub_mean, 1e-12) ** 2
    weight = np.clip(1.0 - cu2 / np.maximum(ci2, 1e-12), 0.0, 1.0)

    filtered = sub_mean + weight * (filled - sub_mean)
    return np.where(valid, filtered, np.nan), direction


# ---------------------------------------------------------------------------
# Otsu threshold and water delineation
# ---------------------------------------------------------------------------

def compute_otsu_threshold(image_array: np.ndarray, bins: int = 256) -> float:
    """Otsu threshold: the split maximising between-class variance.

    Call it on a dB image -- see the module docstring on why Otsu on linear
    power is not equivalent.
    """
    valid = np.asarray(image_array)[np.isfinite(image_array)]
    if valid.size == 0:
        raise ValueError("no valid pixels to threshold")

    hist, bin_edges = np.histogram(valid, bins=bins)
    centres = (bin_edges[:-1] + bin_edges[1:]) / 2.0
    total = int(hist.sum())

    weight_bg = 0.0
    sum_bg = 0.0
    sum_total = float(np.dot(hist, centres))
    best_var = -1.0
    threshold = float(centres[0])

    for i in range(bins):
        weight_bg += hist[i]
        if weight_bg == 0:
            continue
        weight_fg = total - weight_bg
        if weight_fg == 0:
            break

        sum_bg += hist[i] * centres[i]
        mean_bg = sum_bg / weight_bg
        mean_fg = (sum_total - sum_bg) / weight_fg
        between = weight_bg * weight_fg * (mean_bg - mean_fg) ** 2
        if between > best_var:
            best_var = between
            threshold = float(centres[i])

    return threshold


def detect_water(image: np.ndarray, nodata: Optional[float] = None,
                 looks: float = 4.0) -> Tuple[np.ndarray, float]:
    """Delineate water in a linear backscatter window.

    Returns ``(mask, threshold_db)``.  Low backscatter is water: the surface
    reflects specularly away from the sensor, so it appears dark.
    """
    img = np.asarray(image, dtype=np.float64)
    valid = np.isfinite(img)
    if nodata is not None:
        valid &= (img != nodata)
    if not valid.any():
        raise ValueError("backscatter window contains no valid pixels")

    work = np.where(valid, img, np.nan)

    # Filter speckle in linear power, then move to dB for thresholding.
    filtered, _ = refined_lee_filter(work, looks=looks)
    db = 10.0 * np.log10(np.maximum(filtered, 1e-12))
    db = np.where(valid, db, np.nan)

    finite = np.isfinite(db)
    if not finite.any():
        raise ValueError("no valid dB pixels after filtering")

    threshold = compute_otsu_threshold(db[finite])
    mask = finite & (db <= threshold)
    return mask, threshold


# ---------------------------------------------------------------------------
# Remote raster access
# ---------------------------------------------------------------------------

def _read_window(href: str, bbox: Tuple[float, float, float, float],
                 max_px: int = 1024):
    """Read just the AOI window from a remote COG, decimated to `max_px`.

    Sentinel-1 scenes are far larger than the study area, so downloading whole
    scenes would be wasteful; GDAL reads only the byte ranges covering the
    window. Returns ``(array, transform, crs, nodata)``.
    """
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.transform import Affine
    from rasterio.windows import Window, from_bounds
    from rasterio.vrt import WarpedVRT
    from rasterio.env import Env

    if href.startswith("/vsi"):
        url = href
    elif href.startswith("s3://"):
        url = f"/vsis3/{href[5:]}"
    else:
        url = f"/vsicurl/{href}"

    with Env(aws_no_sign_request=True):
        with rasterio.open(url) as src:
            # If CRS is missing or uses GCPs (common in Sentinel-1 GRD),
            # WarpedVRT reprojects on-the-fly to EPSG:4326 using GCPs.
            if src.crs is None or str(src.crs).upper() != "EPSG:4326":
                vrt_ctx = WarpedVRT(src, crs="EPSG:4326")
            else:
                vrt_ctx = None

            reader = vrt_ctx if vrt_ctx is not None else src
            try:
                min_lon, min_lat, max_lon, max_lat = bbox
                win = from_bounds(min_lon, min_lat, max_lon, max_lat, reader.transform)
                win = win.intersection(Window(0, 0, reader.width, reader.height))
                if win.width < 1 or win.height < 1:
                    raise ValueError("area of interest falls outside the scene footprint")

                scale = min(1.0, max_px / max(win.width, win.height))
                out_h = max(1, int(round(win.height * scale)))
                out_w = max(1, int(round(win.width * scale)))

                data = reader.read(1, window=win, out_shape=(out_h, out_w),
                                resampling=Resampling.bilinear).astype("float64")

                transform = (reader.transform
                            * Affine.translation(win.col_off, win.row_off)
                            * Affine.scale(win.width / out_w, win.height / out_h))

                return data, transform, str(reader.crs), reader.nodata
            finally:
                if vrt_ctx is not None:
                    vrt_ctx.close()


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def mask_to_geojson(mask: np.ndarray, transform, crs: str,
                    properties: Optional[Dict[str, Any]] = None
                    ) -> Dict[str, Any]:
    """Vectorise a boolean water mask into a WGS84 GeoJSON FeatureCollection."""
    from rasterio import features
    from rasterio.warp import transform_geom

    props = dict(properties or {})
    feats = []
    for geom, value in features.shapes(mask.astype("uint8"), mask=mask,
                                       transform=transform):
        if int(value) != 1:
            continue
        if crs and str(crs).upper() != "EPSG:4326":
            geom = transform_geom(crs, "EPSG:4326", geom)
        feats.append({"type": "Feature", "properties": props, "geometry": geom})

    return {"type": "FeatureCollection", "features": feats}


def resample_mask(mask: np.ndarray, shape: Tuple[int, int]) -> np.ndarray:
    """Nearest-neighbour resize of a boolean mask onto another grid.

    Nearest neighbour, because a majority vote would erode narrow channels --
    exactly the features a flood-extent comparison cares about.
    """
    src = np.asarray(mask)
    if src.shape == tuple(shape):
        return src.astype(bool)

    rows = (np.arange(shape[0]) * src.shape[0] / shape[0]).astype(int)
    cols = (np.arange(shape[1]) * src.shape[1] / shape[1]).astype(int)
    rows = np.clip(rows, 0, src.shape[0] - 1)
    cols = np.clip(cols, 0, src.shape[1] - 1)
    return src[np.ix_(rows, cols)].astype(bool)


def verify_inundation(simulated_mask: np.ndarray,
                      satellite_mask: np.ndarray) -> Dict[str, float]:
    """IoU / Dice agreement between simulated and observed water extent.

    Both masks must already share a grid -- see `resample_mask`.
    """
    sim = np.asarray(simulated_mask) > 0
    sat = np.asarray(satellite_mask) > 0

    if sim.shape != sat.shape:
        raise ValueError(
            f"masks must share a grid; got {sim.shape} and {sat.shape}")

    intersection = int(np.logical_and(sim, sat).sum())
    union = int(np.logical_or(sim, sat).sum())

    iou = intersection / union if union else 1.0
    denom = int(sim.sum()) + int(sat.sum())
    dice = (2.0 * intersection / denom) if denom else 1.0
    precision = intersection / int(sim.sum()) if sim.sum() else 1.0
    recall = intersection / int(sat.sum()) if sat.sum() else 1.0

    return {
        "iou": round(float(iou), 4),
        "dice_f1": round(float(dice), 4),
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "overlap_percentage": round(float(iou) * 100.0, 1),
        "simulated_water_pixels": int(sim.sum()),
        "observed_water_pixels": int(sat.sum()),
        "intersection_pixels": intersection,
        "status": ("VERIFIED_ACCURATE" if iou >= 0.75 else
                   "ACCEPTABLE_CORRELATION" if iou >= 0.5 else
                   "CALIBRATION_RECOMMENDED"),
    }


# ---------------------------------------------------------------------------
# End-to-end delineation
# ---------------------------------------------------------------------------

def fetch_flood_extent(lat: float, lon: float,
                       bbox: Optional[Tuple[float, float, float, float]] = None,
                       days_back: int = 60, max_px: int = 1024,
                       ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Delineate observed flood water over an AOI from Sentinel-1.

    Picks the most recent scene as the post-event image and an earlier one as
    the pre-event reference, so permanent water (the river channel, reservoirs)
    can be removed and only new inundation reported.

    Returns ``(result, error)``; on failure ``result`` is None and ``error``
    explains why.  Nothing is invented on the failure path.
    """
    if bbox is None:
        d = 0.05
        bbox = (lon - d, lat - d, lon + d, lat + d)

    try:
        scenes = search_sentinel1_scenes(lat, lon, days_back=days_back)
    except Exception as exc:
        return None, f"STAC search failed: {exc}"

    with_vv = [s for s in scenes if s.get("asset_vv")]
    if not with_vv:
        return None, ("no Sentinel-1 scene with a VV asset is available for "
                      "these coordinates")

    post = with_vv[0]
    try:
        post_img, transform, crs, nodata = _read_window(post["asset_vv"], bbox, max_px)
        post_water, post_thr = detect_water(post_img, nodata=nodata)
    except Exception as exc:
        return None, f"could not read or threshold scene {post['id']}: {exc}"

    flood = post_water
    pre = None
    removed_px = 0

    for candidate in with_vv[1:]:
        try:
            pre_img, _, _, pre_nodata = _read_window(candidate["asset_vv"], bbox, max_px)
            if pre_img.shape != post_img.shape:
                continue
            pre_water, _ = detect_water(pre_img, nodata=pre_nodata)
        except Exception:
            continue

        # Permanent water = water in the reference scene. Anything wet in both
        # is the standing river/reservoir, not flood.
        flood = post_water & ~pre_water
        removed_px = int((post_water & pre_water).sum())
        pre = candidate
        break

    area_km2 = None
    try:
        if crs and "4326" in str(crs):
            mid_lat = (bbox[1] + bbox[3]) / 2.0
            deg_lat_m = 111139.0
            deg_lon_m = 111139.0 * np.cos(np.radians(mid_lat))
            d_lon = abs(transform.a)
            d_lat = abs(transform.e)
            pixel_area_m2 = (d_lon * deg_lon_m) * (d_lat * deg_lat_m)
            area_km2 = float(flood.sum() * pixel_area_m2 / 1e6)
        else:
            px = abs(transform.a * transform.e) - abs(transform.b * transform.d)
            area_km2 = float(flood.sum() * px / 1e6)
    except Exception:
        pass

    geojson = mask_to_geojson(flood, transform, crs, properties={
        "sensor": "Sentinel-1 SAR C-band",
        "algorithm": "Refined Lee speckle filter + Otsu threshold",
        "scene": post["id"],
    })

    return {
        "scene": post,
        "reference_scene": pre,
        "permanent_water_pixels_removed": removed_px,
        "otsu_threshold_db": round(float(post_thr), 2),
        "flood_pixels": int(flood.sum()),
        "window_shape": list(flood.shape),
        "observed_area_km2": round(area_km2, 3) if area_km2 is not None else None,
        "water_polygon_geojson": geojson,
        "mask": flood,
        "transform": transform,
        "crs": crs,
        "bbox": list(bbox),
    }, None
