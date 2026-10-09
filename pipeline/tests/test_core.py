"""Core logic tests; need only numpy, scipy and scikit-image."""

import numpy as np

from jalrekha.change import baseline_lake, baseline_natural, confidence, find_flags, persistence
from jalrekha.lakes import grow_footprint
from jalrekha.classify import BARE_BUILT, FLOATING_VEG, LAND_VEG, MIXED, NODATA, WATER, classify
from jalrekha.composites import seasonal_composite
from jalrekha.indices import mndwi, ndvi
from jalrekha.masks import clear_mask, shadow_mask

B, W, N = BARE_BUILT, WATER, NODATA


def test_indices_handle_zero_and_nan():
    out = mndwi(np.array([0.1, 0.0, np.nan]), np.array([0.05, 0.0, 0.1]))
    assert np.isclose(out[0], 1 / 3)
    assert np.isnan(out[1]) and np.isnan(out[2])
    assert np.isclose(ndvi(np.array([0.4]), np.array([0.1]))[0], 0.6)


def test_clear_mask_drops_clouds_and_shadow():
    scl = np.array([4, 5, 6, 3, 8, 9, 10, 0, 1])
    assert clear_mask(scl).tolist() == [True, True, True] + [False] * 6


def test_shadow_mask_keeps_water():
    # shadow on concrete | clear water | algae-covered water (keeps NIR, not SWIR)
    dark = np.array([0.02, 0.02, 0.03])
    nir = np.array([0.08, 0.01, 0.12])
    swir = np.array([0.09, 0.01, 0.03])
    assert shadow_mask(dark, dark, dark, nir, swir).tolist() == [True, False, False]


def test_composite_needs_three_clear_looks():
    t, shape = 4, (1, 2)
    stack = {b: np.full((t, *shape), 0.1, dtype="float32") for b in ("blue", "green", "red", "nir", "swir16")}
    stack["scl"] = np.full((t, *shape), 4)
    stack["scl"][:2, 0, 1] = 9  # pixel (0, 1) clouded in 2 of 4 scenes
    comp, looks = seasonal_composite(stack)
    assert looks.tolist() == [[4, 2]]
    assert np.isclose(comp["green"][0, 0], 0.1) and np.isnan(comp["green"][0, 1])


def test_classify_hyacinth_is_lake_inside_footprint():
    # water | hyacinth on lake | grass outside | fill | mixed | missing | grass on filled lake bed
    m = np.array([0.4, -0.3, -0.3, -0.3, -0.1, np.nan, -0.3])
    v = np.array([0.0, 0.6, 0.6, 0.1, 0.3, 0.1, 0.6])
    b = np.array([0.0, -0.2, -0.2, 0.2, -0.1, 0.1, -0.1])
    sw = np.array([0.02, 0.12, 0.23, 0.25, 0.15, 0.1, 0.24])
    fp = np.array([True, True, False, True, True, True, True])
    assert classify(m, v, b, sw, fp, 0.0).tolist() == [
        WATER, FLOATING_VEG, LAND_VEG, BARE_BUILT, MIXED, NODATA, LAND_VEG
    ]


def test_persistence_runs_reset_and_skip_cloudy_years():
    # pixels: confirmed fill | one season only | desilted then water | fill with cloudy year between
    dry = np.array([
        [W, W, W, W],
        [W, W, B, B],
        [B, W, B, N],
        [B, B, W, B],
    ]).reshape(4, 1, 4)
    run_len, run_start = persistence(dry)
    assert run_len.ravel().tolist() == [2, 1, 0, 2]
    assert run_start.ravel().tolist() == [2, 3, -1, 1]


def test_confidence_levels():
    run_len = np.array([[2, 2, 1, 0]])
    run_start = np.array([[0, 0, 1, -1]])
    post = {2024: np.array([[B, W, B, W]])}
    assert confidence(run_len, run_start, [2024, 2025], post).tolist() == [[3, 2, 1, 0]]


def test_flags_drop_small_patches():
    lost = np.zeros((6, 6), dtype=bool)
    lost[0:2, 0:3] = True  # 6 px, kept
    lost[5, 5] = True  # 1 px, dropped
    run_len = np.where(lost, 2, 0)
    run_start = np.where(lost, 1, -1)
    conf = np.where(lost, 3, 0).astype("uint8")
    labels, flags = find_flags(lost, run_len, run_start, conf, np.ones_like(lost), ["2023-dry", "2024-dry"])
    assert len(flags) == 1 and labels[5, 5] == 0
    f = flags[0]
    assert (f["first_seen"], f["status"], f["confidence"], f["zone"]) == ("2024-dry", "confirmed", "high", "lakebed")
    assert f["area_ac"] == round(600 / 4046.8564, 2)


def test_baseline_needs_every_season():
    # stable water | flickers water/bare | cloudy once, else water | roof (bare) both years
    base = np.array([[W, W, W, B], [W, B, N, B]]).reshape(2, 1, 4)
    assert baseline_lake(base).ravel().tolist() == [True, False, True, False]
    assert baseline_natural(base).ravel().tolist() == [True, False, True, False]


def test_footprint_grows_only_with_connected_water():
    outline = np.zeros((5, 7), dtype=bool)
    outline[1:4, 1:3] = True
    water = np.zeros_like(outline)
    water[1:4, 3] = True  # lake water beyond the mapped edge: added
    water[2, 6] = True  # separate wet patch: not added
    grown = grow_footprint(outline, water)
    assert grown[2, 3] and not grown[2, 6] and grown.sum() == outline.sum() + 3
