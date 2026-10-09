"""Settings shared by every lake.

Thresholds are starting values. Tune them once on the validation lakes, then
keep them fixed for all lakes and publish them in the README.
"""

from dataclasses import dataclass

# --- Data source -----------------------------------------------------------

STAC_URL = "https://earth-search.aws.element84.com/v1"
COLLECTION = "sentinel-2-l2a"

# Earth Search v1 asset names -> Sentinel-2 band
BANDS = {
    "blue": "B02",
    "green": "B03",
    "red": "B04",
    "nir": "B08",
    "swir16": "B11",
    "scl": "SCL",
}

# Bengaluru sits in UTM zone 43N; work in metres at 10 m pixels.
CRS = "EPSG:32643"
RESOLUTION_M = 10
PIXEL_AREA_M2 = RESOLUTION_M * RESOLUTION_M
M2_PER_ACRE = 4046.8564

# L2A reflectance = DN * scale + offset. Scenes from processing baseline 04.00
# (Jan 2022 on) carry a -0.1 offset unless Earth Search already applied it.
# Check this on the first scenes you load.
REFLECTANCE_SCALE = 0.0001
BOA_OFFSET = -0.1

# --- Time ------------------------------------------------------------------

YEARS = range(2019, 2027)  # L2A is global from Dec 2018
DRY_MONTHS = (1, 2, 3, 4)  # Jan-Apr
POST_MONSOON_MONTHS = (11, 12)  # Nov-Dec; Jun-Oct skipped for cloud
BASELINE_YEARS = (2019, 2020)
MAX_SCENE_CLOUD = 60  # % scene cloud cover; the SCL mask does the real work


@dataclass(frozen=True)
class Thresholds:
    mndwi: float = 0.0  # water if MNDWI above this (or the per-lake Otsu value)
    use_otsu: bool = True
    otsu_min: float = 0.0  # never below 0: bright roofs reach -0.2; weedy water is FLOATING_VEG anyway
    otsu_max: float = 0.3
    veg_ndvi: float = 0.4  # vegetation at or above this
    land_veg_swir: float = 0.19  # vegetation with SWIR at/above this is on land, not floating on water
    land_veg_swir_rise: float = 0.06  # ...and counts as lake loss only if SWIR also rose this much over baseline
    bare_ndvi: float = 0.2  # bare/built below this ...
    ndbi: float = 0.0  # ... and NDBI above this
    shadow_visible_max: float = 0.04  # building shadow: dark in blue, green, red ...
    shadow_nir_min: float = 0.04  # ... but not dark in NIR ...
    shadow_swir_min: float = 0.05  # ... or SWIR, the way water (even algae-covered) is
    min_clear_looks: int = 3  # per pixel per season, else "not enough data"
    min_flag_px: int = 5  # 5 px = 500 m2
    ring_m: int = 100  # analysis margin around the reference footprint


THRESHOLDS = Thresholds()

# Buffer under the KTCDA Act 2014, in force while the 2025 amendment is pending.
CURRENT_LAW_BUFFER_M = 30
