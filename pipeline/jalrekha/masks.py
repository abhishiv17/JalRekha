"""Pixel masks: clouds from the scene classification layer, building shadows."""

import numpy as np

from .config import THRESHOLDS, Thresholds

# SCL classes to drop: no data, saturated/defective, cloud shadow,
# cloud medium, cloud high, thin cirrus.
SCL_INVALID = (0, 1, 3, 8, 9, 10)


def clear_mask(scl: np.ndarray) -> np.ndarray:
    """True where the SCL says the pixel is usable."""
    return ~np.isin(scl, SCL_INVALID)


def shadow_mask(blue, green, red, nir, swir16, t: Thresholds = THRESHOLDS) -> np.ndarray:
    """True where a pixel looks like a tall building's shadow.

    Shadows are dark in the visible bands, like water, but keep some NIR and
    SWIR, which water absorbs (algae-covered water keeps NIR, not SWIR).
    Starting values; check on the validation lakes.
    """
    dark_visible = (
        (blue < t.shadow_visible_max)
        & (green < t.shadow_visible_max)
        & (red < t.shadow_visible_max)
    )
    return dark_visible & (nir > t.shadow_nir_min) & (swir16 > t.shadow_swir_min)
