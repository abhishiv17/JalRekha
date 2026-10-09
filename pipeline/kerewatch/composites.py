"""Seasonal median composites from a stack of scenes."""

import warnings

import numpy as np

from .config import THRESHOLDS, Thresholds
from .masks import clear_mask, shadow_mask

REFLECTANCE_BANDS = ("blue", "green", "red", "nir", "swir16")


def seasonal_composite(stack: dict, t: Thresholds = THRESHOLDS):
    """Median of the clear looks for each pixel.

    stack: band name -> array (time, y, x) of reflectance, plus "scl".
    Returns (composite, looks): composite maps band -> (y, x) median with NaN
    where a pixel has fewer than `min_clear_looks`; looks is the clear count.
    """
    valid = clear_mask(stack["scl"]) & ~shadow_mask(
        stack["blue"], stack["green"], stack["red"], stack["nir"], stack["swir16"], t
    )
    looks = valid.sum(axis=0)
    enough = looks >= t.min_clear_looks

    composite = {}
    for band in REFLECTANCE_BANDS:
        values = np.where(valid, stack[band], np.nan).astype("float32")
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)  # all-NaN pixels
            median = np.nanmedian(values, axis=0)
        median[~enough] = np.nan
        composite[band] = median
    return composite, looks


def season_status(looks: np.ndarray, region: np.ndarray, t: Thresholds = THRESHOLDS) -> str:
    """"ok" when the typical pixel in the region has enough clear looks."""
    if not region.any():
        return "not_enough_data"
    typical = np.median(looks[region])
    return "ok" if typical >= t.min_clear_looks else "not_enough_data"
