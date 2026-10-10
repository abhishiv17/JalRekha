import json

import pytest

from jalrekha.track import catalog_entry, track


def catalog(tmp_path, lakes):
    d = tmp_path / "catalog"
    d.mkdir()
    (d / "india.json").write_text(json.dumps(lakes), encoding="utf-8")
    return tmp_path


def test_rejects_ids_that_are_not_catalogue_ids(tmp_path):
    with pytest.raises(ValueError):
        track("bellandur", "bucket", data_dir=catalog(tmp_path, []))


def test_unknown_lake(tmp_path):
    with pytest.raises(LookupError):
        catalog_entry("osm-w1", tmp_path / "missing.json" if False else catalog(tmp_path, []) / "catalog" / "india.json")


def test_refuses_lakes_too_big_for_one_run(tmp_path):
    big = {"id": "osm-r1", "name": "Chilika Lake", "state": "Odisha", "near": "", "lat": 19.7, "lon": 85.3, "ha": 87506}
    with pytest.raises(ValueError, match="too big"):
        track("osm-r1", "bucket", data_dir=catalog(tmp_path, [big]))
