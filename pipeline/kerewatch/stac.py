"""Find and load Sentinel-2 L2A scenes from Earth Search (AWS Open Data).

Only the lake-sized window is read from each Cloud-Optimized GeoTIFF.
Run in us-west-2, next to the imagery, for speed and no transfer cost.
"""

import numpy as np
import odc.stac
from odc.geo.geobox import GeoBox
from pystac_client import Client

from .config import (
    BANDS,
    BOA_OFFSET,
    COLLECTION,
    DRY_MONTHS,
    MAX_SCENE_CLOUD,
    POST_MONSOON_MONTHS,
    REFLECTANCE_SCALE,
    STAC_URL,
)

SEASON_MONTHS = {"dry": DRY_MONTHS, "post": POST_MONSOON_MONTHS}


def season_range(year: int, season: str) -> str:
    months = SEASON_MONTHS[season]
    first, last = months[0], months[-1]
    end_day = {2: 28, 4: 30, 6: 30, 9: 30, 11: 30}.get(last, 31)
    return f"{year}-{first:02d}-01/{year}-{last:02d}-{end_day}"


def search(gbox: GeoBox, year: int, season: str):
    """Scenes over the grid for one season, oldest first."""
    bbox = gbox.geographic_extent.boundingbox
    items = Client.open(STAC_URL).search(
        collections=[COLLECTION],
        bbox=(bbox.left, bbox.bottom, bbox.right, bbox.top),
        datetime=season_range(year, season),
        query={"eo:cloud_cover": {"lt": MAX_SCENE_CLOUD}},
    ).item_collection()
    return sorted(items, key=lambda it: it.datetime)


def _offset(item) -> float:
    """BOA offset still to apply for this scene (baseline 04.00+ only)."""
    baseline = float(item.properties.get("s2:processing_baseline", "0"))
    applied = item.properties.get("earthsearch:boa_offset_applied", False)
    return BOA_OFFSET if baseline >= 4.0 and not applied else 0.0


_rio_configured = False


def _configure_rio() -> None:
    """Anonymous reads from the public Sentinel-2 bucket, tuned for small windows."""
    global _rio_configured
    if not _rio_configured:
        odc.stac.configure_rio(cloud_defaults=True, aws={"aws_unsigned": True})
        _rio_configured = True


def load(items, gbox: GeoBox, threads: int = 16) -> dict:
    """Load scenes onto the grid as reflectance.

    Returns band -> (time, y, x) arrays, "scl" as integers, and "scene_ids".
    """
    _configure_rio()
    ds = odc.stac.load(
        items,
        bands=list(BANDS),
        geobox=gbox,
        groupby="solar_day",
        resampling={"swir16": "bilinear", "*": "nearest"},
        pool=threads,
    )
    by_day = {it.datetime.date(): it for it in items}
    offsets = np.array(
        [_offset(by_day.get(np.datetime64(t, "D").item(), items[0])) for t in ds.time.values],
        dtype="float32",
    )[:, None, None]

    stack = {"scl": ds["scl"].values}
    for band in BANDS:
        if band == "scl":
            continue
        dn = ds[band].values.astype("float32")
        refl = dn * REFLECTANCE_SCALE + offsets
        refl[dn == 0] = np.nan  # 0 = no data
        stack[band] = refl
    stack["scene_ids"] = [it.id for it in items]
    return stack
