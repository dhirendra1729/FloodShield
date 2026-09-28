"""
Per-dam DEM resolution for SIH26161 (NTRO).

Before this module existed, the only raster in the repository was the bundled
Bhuragaon (Assam) DEM, so *every* scenario — Machchhu-II in Gujarat, Teesta-III
in Sikkim, Rishiganga in Uttarakhand — was simulated on Assamese terrain. That
made the "hydrodynamic modelling of any river" claim untrue at the point where
it mattered most.

This module fetches the correct terrain for a dam's coordinates from the public
Copernicus DEM GLO-30 (1 arc-second, ~30 m) mirror on AWS S3. The bucket is
open access and anonymous — no credentials, no signed URLs. Tiles are cached on
disk so repeated simulations of the same site cost nothing after the first run.

Tile grid
---------
GLO-30 is published as 1x1 degree tiles named from their south-west corner::

    Copernicus_DSM_COG_10_N27_00_E088_00_DEM.tif

so latitudes/longitudes are floored to whole degrees and the hemisphere letter
is derived from the sign.
"""

from __future__ import annotations

import os
from typing import Optional, Tuple

# Public, anonymous, eu-central-1. Verified reachable without credentials.
GLO30_BUCKET_URL = "https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com"

# A GLO-30 tile is ~25-40 MB. Anything far below that is an error page or a
# truncated transfer, not a DEM.
_MIN_TILE_BYTES = 1_000_000

_DEFAULT_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "dem_cache")


def dem_cache_dir() -> str:
    """Directory holding downloaded DEM tiles (created on first use)."""
    override = os.environ.get("FLOODSHIELD_DEM_CACHE")
    path = os.path.abspath(override or _DEFAULT_CACHE_DIR)
    os.makedirs(path, exist_ok=True)
    return path


def tile_name(lat: float, lon: float) -> str:
    """Build the GLO-30 tile identifier covering a coordinate.

    The DEM is gridded on whole degrees, so a point sits in the tile whose
    south-west corner is the floor of its latitude and longitude.

    >>> tile_name(22.7667, 70.8667)
    'Copernicus_DSM_COG_10_N22_00_E070_00_DEM'
    >>> tile_name(-33.9, 151.2)
    'Copernicus_DSM_COG_10_S34_00_E151_00_DEM'
    """
    lat_int = int(lat // 1)
    lon_int = int(lon // 1)

    ns = "N" if lat_int >= 0 else "S"
    ew = "E" if lon_int >= 0 else "W"

    return (
        f"Copernicus_DSM_COG_10_{ns}{abs(lat_int):02d}_00_"
        f"{ew}{abs(lon_int):03d}_00_DEM"
    )


def tile_url(lat: float, lon: float) -> str:
    """Public HTTPS URL for the GLO-30 tile covering a coordinate."""
    name = tile_name(lat, lon)
    return f"{GLO30_BUCKET_URL}/{name}/{name}.tif"


def _download(url: str, dest: str) -> None:
    """Stream a tile to disk via a temporary file, then move it into place.

    Writing to a temp file and renaming keeps a partially-downloaded tile from
    being mistaken for a valid cached one if the process dies mid-transfer.
    """
    import urllib.request

    tmp = dest + ".part"
    try:
        with urllib.request.urlopen(url, timeout=120) as resp:
            with open(tmp, "wb") as fh:
                while True:
                    chunk = resp.read(1 << 20)  # 1 MiB
                    if not chunk:
                        break
                    fh.write(chunk)

        size = os.path.getsize(tmp)
        if size < _MIN_TILE_BYTES:
            raise IOError(
                f"DEM tile at {url} is only {size} bytes — expected a raster. "
                "The coordinate may fall outside GLO-30 coverage."
            )
        os.replace(tmp, dest)
    finally:
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except OSError:
                pass


def resolve_dem(lat: float, lon: float,
                cache_dir: Optional[str] = None,
                force: bool = False) -> str:
    """Return a local path to the GLO-30 tile containing (lat, lon).

    Downloads on first use, then serves from cache. Raises IOError if the tile
    cannot be retrieved — callers should treat that as "no terrain available"
    and fall back explicitly rather than silently substituting another site's
    DEM, which is precisely the bug this module exists to fix.
    """
    name = tile_name(lat, lon)
    directory = os.path.abspath(cache_dir) if cache_dir else dem_cache_dir()
    os.makedirs(directory, exist_ok=True)

    dest = os.path.join(directory, f"{name}.tif")

    if not force and os.path.exists(dest) and os.path.getsize(dest) >= _MIN_TILE_BYTES:
        return dest

    try:
        _download(tile_url(lat, lon), dest)
    except Exception as exc:
        raise IOError(
            f"Could not obtain Copernicus GLO-30 terrain for "
            f"({lat:.4f}, {lon:.4f}) [tile {name}]: {exc}"
        ) from exc

    return dest


def resolve_dem_for_bounds(lat: float, lon: float,
                           span_deg: float = 0.0,
                           cache_dir: Optional[str] = None) -> Tuple[str, bool]:
    """Resolve terrain for a site, reporting whether the tile is single.

    A flood wave running 10-15 km downstream can cross a degree boundary, in
    which case the flow would be truncated at the tile edge. This returns
    ``(path, is_single_tile)`` so the caller can disclose that limitation
    instead of pretending the domain is complete.

    Multi-tile mosaicking is deliberately not attempted here — clipping and
    merging is the engine's concern, and silently merging two tiles of
    differing resolution would be worse than reporting the boundary.
    """
    path = resolve_dem(lat, lon, cache_dir=cache_dir)

    if span_deg <= 0:
        return path, True

    corner_lat = lat + span_deg
    corner_lon = lon + span_deg
    single = tile_name(lat, lon) == tile_name(corner_lat, corner_lon)

    return path, single
