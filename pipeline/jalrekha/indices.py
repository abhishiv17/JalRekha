"""Spectral indices on reflectance arrays (any matching shapes)."""

import numpy as np


def normalized_difference(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """(a - b) / (a + b), NaN where the sum is zero or an input is NaN."""
    a = np.asarray(a, dtype="float32")
    b = np.asarray(b, dtype="float32")
    total = a + b
    with np.errstate(divide="ignore", invalid="ignore"):
        out = (a - b) / total
    out[~np.isfinite(out)] = np.nan
    return out


def mndwi(green, swir16):
    """Modified water index: high over open water."""
    return normalized_difference(green, swir16)


def ndvi(nir, red):
    """Vegetation index: high over weeds, grass and hyacinth."""
    return normalized_difference(nir, red)


def ndbi(swir16, nir):
    """Built-up index: positive over bare soil, debris and concrete."""
    return normalized_difference(swir16, nir)
