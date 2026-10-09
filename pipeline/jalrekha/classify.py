"""Per-pixel land/water classes for one seasonal composite."""

import numpy as np
from skimage.filters import threshold_otsu

from .config import THRESHOLDS, Thresholds

# Class values; must match the overlay table in contracts/README.md.
NODATA = 0
WATER = 1
FLOATING_VEG = 2
BARE_BUILT = 3
LAND_VEG = 4
MIXED = 5

LAKE_CLASSES = (WATER, FLOATING_VEG)


def water_threshold(mndwi: np.ndarray, region: np.ndarray, t: Thresholds = THRESHOLDS) -> float:
    """Per-lake MNDWI threshold: Otsu over the region, clamped, or the fixed start value."""
    if not t.use_otsu:
        return t.mndwi
    values = mndwi[region & np.isfinite(mndwi)]
    if values.size < 50 or np.ptp(values) == 0:
        return t.mndwi
    return float(np.clip(threshold_otsu(values), t.otsu_min, t.otsu_max))


def classify(mndwi, ndvi, ndbi, swir16, footprint, water_thr: float, t: Thresholds = THRESHOLDS) -> np.ndarray:
    """Class per pixel. Later rules override earlier ones; water wins.

    Vegetation inside the historical footprint is floating vegetation
    (hyacinth, algae) when its SWIR is low, because water lies underneath:
    still lake, never loss. Vegetation with land-like SWIR is land, even in
    the lake bed (a filled or dried patch that has grassed over).
    """
    out = np.full(mndwi.shape, MIXED, dtype="uint8")

    bare = (ndvi < t.bare_ndvi) & (ndbi > t.ndbi)
    out[bare] = BARE_BUILT

    veg = ndvi >= t.veg_ndvi
    floating = footprint & (swir16 < t.land_veg_swir)
    out[veg & floating] = FLOATING_VEG
    out[veg & ~floating] = LAND_VEG

    out[mndwi > water_thr] = WATER

    missing = ~(np.isfinite(mndwi) & np.isfinite(ndvi) & np.isfinite(ndbi) & np.isfinite(swir16))
    out[missing] = NODATA
    return out
