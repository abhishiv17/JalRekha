"""Persistence test and change flags.

A pixel is lost only if it was lake in every baseline dry season and is bare
or built in its latest observed dry seasons after the baseline. Two in a row
= confirmed; one = new.
If it turns back to water or vegetation (desilting, restoration), the run
resets and nothing is flagged.
"""

import numpy as np
from skimage.measure import label

from .classify import BARE_BUILT, FLOATING_VEG, LAKE_CLASSES, LAND_VEG, NODATA, WATER
from .config import M2_PER_ACRE, PIXEL_AREA_M2, THRESHOLDS, Thresholds

CONFIDENCE_NAMES = {1: "low", 2: "medium", 3: "high"}


NATURAL_CLASSES = (WATER, FLOATING_VEG, LAND_VEG)


def always(baseline_classes: np.ndarray, allowed) -> np.ndarray:
    """Pixels in one of `allowed` in every observed baseline composite.

    Edge pixels that flicker between classes during the baseline are left
    out, so they can't later show up as "loss".
    """
    observed = baseline_classes != NODATA
    ok = np.isin(baseline_classes, allowed) | ~observed
    return ok.all(axis=0) & observed.any(axis=0)


def baseline_lake(baseline_classes: np.ndarray) -> np.ndarray:
    """Water or floating vegetation in every baseline dry season."""
    return always(baseline_classes, LAKE_CLASSES)


def baseline_natural(baseline_classes: np.ndarray) -> np.ndarray:
    """Water or vegetation (no bare ground, roofs or roads) in every baseline dry season."""
    return always(baseline_classes, NATURAL_CLASSES)


LAKEBED_LOSS = (BARE_BUILT, LAND_VEG)  # lake bed turned to land: filled, built, or grassed over
BUFFER_LOSS = (BARE_BUILT,)  # natural buffer land turned to bare ground or buildings


def persistence(dry_classes: np.ndarray, lost_classes=LAKEBED_LOSS):
    """Length and start index of each pixel's current run of lost classes.

    dry_classes: (season, y, x), oldest first. NODATA seasons are skipped,
    so a cloudy year doesn't break a run. Returns (run_len, run_start);
    run_start is -1 where the pixel is not currently in a lost class.
    """
    n, *shape = dry_classes.shape
    run_len = np.zeros(shape, dtype="int16")
    run_start = np.full(shape, -1, dtype="int16")
    for i in range(n):
        c = dry_classes[i]
        observed = c != NODATA
        bare = np.isin(c, lost_classes)
        run_start = np.where(observed & bare & (run_len == 0), i, run_start)
        run_len = np.where(observed, np.where(bare, run_len + 1, 0), run_len)
        run_start = np.where(observed & ~bare, -1, run_start)
    return run_len, run_start


def confidence(run_len, run_start, dry_years, post_classes: dict, lost_classes=LAKEBED_LOSS) -> np.ndarray:
    """1 = low (one dry season), 2 = medium (dry seasons agree),
    3 = high (dry seasons agree and every observed post-monsoon composite
    since first-seen is bare/built too). 0 where nothing is flagged.

    post_classes: year -> (y, x) classes for that year's Nov-Dec composite.
    """
    years = np.asarray(list(dry_years))
    first_year = np.where(run_start >= 0, years[np.clip(run_start, 0, None)], 10_000)

    post_agrees = np.ones(run_len.shape, dtype=bool)
    for year, c in post_classes.items():
        applies = (first_year <= year) & (c != NODATA)
        post_agrees &= ~applies | np.isin(c, lost_classes)

    out = np.zeros(run_len.shape, dtype="uint8")
    out[run_len == 1] = 1
    out[run_len >= 2] = 2
    out[(run_len >= 2) & post_agrees] = 3
    return out


def find_flags(lost, run_len, run_start, conf, footprint, seasons, latest_classes=None, t: Thresholds = THRESHOLDS):
    """Group lost pixels into flags of at least `min_flag_px` connected pixels.

    seasons: season names matching run_start indices, e.g. ["2019-dry", ...].
    Returns (labels, flags): a label image (0 = no flag) and one dict per flag.
    """
    labels = label(lost, connectivity=2)
    flags = []
    kept = np.zeros_like(labels)
    for k in range(1, labels.max() + 1):
        pix = labels == k
        n = int(pix.sum())
        if n < t.min_flag_px:
            continue
        new_id = len(flags) + 1
        kept[pix] = new_id
        confirmed = (run_len[pix] >= 2).mean() >= 0.5
        flags.append(
            {
                "label": new_id,
                "zone": "lakebed" if footprint[pix].mean() >= 0.5 else "buffer",
                "area_ac": round(n * PIXEL_AREA_M2 / M2_PER_ACRE, 2),
                "first_seen": seasons[int(run_start[pix].min())],
                "status": "confirmed" if confirmed else "new",
                "confidence": CONFIDENCE_NAMES[int(np.median(conf[pix]))],
                "kind": _kind(latest_classes, pix),
            }
        )
    return kept, flags


def _kind(latest_classes, pix) -> str:
    """What the patch is now: mostly bare/built ("fill_or_construction") or grassed land."""
    if latest_classes is None:
        return "fill_or_construction"
    bare_share = (latest_classes[pix] == BARE_BUILT).mean()
    return "fill_or_construction" if bare_share >= 0.5 else "vegetated_land"
