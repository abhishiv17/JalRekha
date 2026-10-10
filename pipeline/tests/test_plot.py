import json

import numpy as np
import pytest

from jalrekha.plot import buffer_rules, drop_specks, nearest_extent, plot_grid, utm_crs, water_at_pin
from jalrekha.verdict import _parse, explain_with_template, level, reasons


def facts(**over):
    base = {
        "dry_seasons_with_water": [],
        "post_seasons_with_water": [],
        "dry_seasons_checked": 8,
        "distance_to_extent_m": 400,
        "in_lake_bed": False,
        "buffer_rules": [{"rule": "ktcda_2014", "width_m": 30, "status": "in_force", "inside": False}],
        "floods": [],
    }
    base.update(over)
    return base


def test_utm_zone_for_bengaluru_and_hyderabad():
    assert utm_crs(77.6, 12.9) == "EPSG:32643"
    assert utm_crs(78.4, 17.4) == "EPSG:32644"


def test_pin_sits_in_the_middle_of_the_window():
    gbox, (row, col) = plot_grid(12.9649, 77.4948)
    assert gbox.shape == (120, 120)
    assert 58 <= row <= 61 and 58 <= col <= 61


def test_water_at_pin_is_a_majority_of_clear_pixels():
    water = np.zeros((5, 5), bool)
    valid = np.ones((5, 5), bool)
    water[1:3, 1:4] = True  # 6 of the 9 around (2, 2)
    assert water_at_pin(water, valid, (2, 2)) is True
    water[1, :] = False  # 3 of 9
    assert water_at_pin(water, valid, (2, 2)) is False
    valid[:] = False
    assert water_at_pin(water, valid, (2, 2)) is None


def test_specks_under_500_m2_are_dropped():
    m = np.zeros((10, 10), bool)
    m[0, 0] = True  # 1 px
    m[5:8, 5:7] = True  # 6 px
    out = drop_specks(m)
    assert not out[0, 0] and out[5:8, 5:7].all()


def test_distance_to_extent_and_patch():
    extent = np.zeros((20, 20), bool)
    extent[0:5, 0:5] = True
    near = nearest_extent(extent, (4, 10))
    assert near["distance_m"] == 60  # 6 px to column 4
    assert near["patch"].sum() == 25
    assert nearest_extent(extent, (2, 2))["distance_m"] == 0
    assert nearest_extent(np.zeros((5, 5), bool), (2, 2))["distance_m"] is None


def test_buffer_rules_by_state():
    ka = buffer_rules("Karnataka", 5)
    assert [r["width_m"] for r in ka] == [30, 6]
    assert ka[1]["status"] == "proposed"
    assert buffer_rules("Telangana", 30)[0]["width_m"] == 30  # 30 ac > 10 ha
    assert buffer_rules("Telangana", 20)[0]["width_m"] == 9
    assert buffer_rules(None, 5)[0]["status"] == "reference"


def test_low_when_nothing_found():
    f = facts()
    assert level(f, reasons(f)) == "low"


def test_unknown_when_too_few_clear_seasons():
    f = facts(dry_seasons_checked=2)
    assert level(f, reasons(f)) == "unknown"


def test_lake_bed_is_high():
    f = facts(dry_seasons_with_water=["2019-dry", "2020-dry"], distance_to_extent_m=0, in_lake_bed=True)
    found = reasons(f)
    assert found[0]["code"] == "lake_bed" and level(f, found) == "high"


def test_inside_buffer_in_force_is_high_proposed_is_watch():
    rules = [
        {"rule": "ktcda_2014", "width_m": 30, "status": "in_force", "inside": True},
        {"rule": "ktcda_bill_2025", "width_m": 6, "status": "proposed", "inside": False},
    ]
    f = facts(distance_to_extent_m=20, buffer_rules=rules)
    assert level(f, reasons(f)) == "high"
    rules = [{"rule": "reference_30m", "width_m": 30, "status": "reference", "inside": True}]
    f = facts(distance_to_extent_m=20, buffer_rules=rules)
    assert level(f, reasons(f)) == "watch"


def test_monsoon_wetness_and_floods():
    f = facts(post_seasons_with_water=["2021-post"])
    assert level(f, reasons(f)) == "watch"
    flood = {"name": "Bengaluru floods", "date": "2022-09-05", "flooded_at_pin": True, "share_flooded_250m": 0.3}
    f = facts(floods=[flood])
    assert level(f, reasons(f)) == "high"
    f = facts(floods=[{**flood, "flooded_at_pin": False, "share_flooded_250m": 0.08}])
    assert [r["code"] for r in reasons(f)] == ["flood_nearby"]


def test_templates_cover_every_reason_in_every_language():
    found = [
        {"code": "lake_bed", "level": "high", "seasons": ["2019-dry"]},
        {"code": "flooded", "level": "high", "event": "E", "date": "2022-09-05"},
        {"code": "in_buffer", "level": "high", "width_m": 30, "rule": "r", "distance_m": 12},
        {"code": "in_buffer_other", "level": "watch", "width_m": 6, "rule": "r", "distance_m": 5},
        {"code": "wet_after_monsoon", "level": "watch", "seasons": ["2021-post"]},
        {"code": "near_lake", "level": "watch", "distance_m": 80},
        {"code": "flood_nearby", "level": "watch", "event": "E", "date": "2022-09-05", "share": 0.1},
    ]
    text = explain_with_template("high", found)
    assert set(text) == {"en", "kn", "te", "hi"}
    for part in text.values():
        assert part["headline"] and part["summary"] and part["checks"]
        assert "{" not in part["summary"]


def test_parse_claude_reply():
    good = {lang: {"headline": "h", "summary": "s", "checks": ["c"]} for lang in ("en", "kn", "te", "hi")}
    assert _parse("Here you go:\n" + json.dumps(good, ensure_ascii=False))["kn"]["headline"] == "h"
    bad = {**good, "te": {"headline": "h"}}
    with pytest.raises((KeyError, ValueError)):
        _parse(json.dumps(bad))


def test_verdict_falls_back_from_bedrock_to_translate_to_templates(monkeypatch):
    import jalrekha.verdict as v

    def boom(*a, **k):
        raise RuntimeError("no access")

    f = facts(dry_seasons_with_water=["2019-dry"], distance_to_extent_m=0, in_lake_bed=True)
    monkeypatch.setattr(v, "explain_with_claude", boom)
    monkeypatch.setattr(v, "explain_with_translate", lambda *a: {"en": "translated"})
    assert v.verdict(f)["text_source"] == "translate"
    monkeypatch.setattr(v, "explain_with_translate", boom)
    out = v.verdict(f)
    assert out["text_source"] == "template" and out["level"] == "high"
    assert "2019" in out["text"]["en"]["summary"] and "2019-dry" not in out["text"]["en"]["summary"]


def test_english_wording_names_the_lake_and_reads_plainly():
    found = [{"code": "near_lake", "level": "watch", "distance_m": 76},
             {"code": "flood_nearby", "level": "watch", "event": "E", "date": "2022-09-05", "share": 0.1}]
    f = facts(dry_seasons_checked=8, nearest_lake={"name": "Herohalli Kere"})
    en = explain_with_template("watch", found, f)["en"]
    assert "Herohalli Kere's water has come within 76 metres" in en["summary"]
    assert "5 September 2022" in en["summary"]
    assert "stayed dry in all 8 dry seasons" in en["summary"]
