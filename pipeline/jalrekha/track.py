"""Track any catalogued lake on demand: fetch its outline from OpenStreetMap, run the
lake pipeline, and publish the results where the results API reads them.

    python -m jalrekha.track osm-w291654387 --bucket <bucket>

Used by the Plot Check worker Lambda ("Track this lake" on the website). The lake id
is its catalogue id (osm-w<way> or osm-r<relation>). Lakes bigger than MAX_HA are
refused: one Lambda run has 15 minutes, and very large lakes need more.
Outlines © OpenStreetMap contributors, ODbL.
"""

import argparse
import json
import os
import re
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

from shapely.geometry import LineString, mapping, shape
from shapely.ops import polygonize, unary_union

from . import export
from .config import YEARS
from .run import run
from .story import story_for

MAX_HA = 1000
LAKE_ID = re.compile(r"^osm-([wr])(\d+)$")
UA = "JalRekha/0.1 (WeMakeDevs Environmental Hacks; github.com/abhishiv17/JalRekha)"
DATA_DIR = Path(os.environ.get("JALREKHA_DATA", Path(__file__).resolve().parents[2] / "data"))


def _get_json(url: str, data: bytes | None = None):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def fetch_outline(lake_id: str):
    """The lake's polygon (WGS84). Nominatim first; Overpass for lakes without a name."""
    kind, num = LAKE_ID.match(lake_id).groups()
    try:
        feats = _get_json(f"https://nominatim.openstreetmap.org/lookup?osm_ids={kind.upper()}{num}"
                          "&format=geojson&polygon_geojson=1")["features"]
        if feats and feats[0]["geometry"]["type"] in ("Polygon", "MultiPolygon"):
            return shape(feats[0]["geometry"])
    except Exception as e:  # fall through to Overpass
        print(f"nominatim: {e!r}")
    q = f"[out:json][timeout:60];{'way' if kind == 'w' else 'relation'}({num});out geom;"
    el = _get_json("https://overpass-api.de/api/interpreter",
                   urllib.parse.urlencode({"data": q}).encode())["elements"][0]
    if kind == "w":
        return shape({"type": "Polygon", "coordinates": [[(p["lon"], p["lat"]) for p in el["geometry"]]]})
    lines = [LineString([(p["lon"], p["lat"]) for p in m["geometry"]])
             for m in el["members"] if m["type"] == "way" and m.get("role", "outer") in ("outer", "")]
    return unary_union(list(polygonize(unary_union(lines))))


def catalog_entry(lake_id: str, catalog: Path | None = None) -> dict:
    path = catalog or DATA_DIR / "catalog" / "india.json"
    for lake in json.loads(path.read_text(encoding="utf-8")):
        if lake["id"] == lake_id:
            return lake
    raise LookupError(f"{lake_id} is not in the lake catalogue")


def track(lake_id: str, bucket: str, progress=None, data_dir: Path | None = None) -> dict:
    """Analyse one catalogued lake and upload it. Returns its index entry."""
    say = progress or (lambda *a, **k: None)
    if not LAKE_ID.match(lake_id):
        raise ValueError(f"not a catalogue id: {lake_id}")
    lake = catalog_entry(lake_id, (data_dir / "catalog" / "india.json") if data_dir else None)
    if lake["ha"] > MAX_HA:
        raise ValueError(f"{lake['name']} is too big to track in one run ({lake['ha']:.0f} hectares; the limit is {MAX_HA})")

    say("outline", f"Finding the edge of {lake['name']} on OpenStreetMap")
    geom = fetch_outline(lake_id)
    work = Path(tempfile.mkdtemp())
    lakes_file = work / "lakes.geojson"
    lakes_file.write_text(json.dumps({"type": "FeatureCollection", "features": [{
        "type": "Feature", "properties": {"id": lake_id, "name": lake["name"]}, "geometry": mapping(geom),
    }]}), encoding="utf-8")

    total = 2 * len(list(YEARS))
    count = {"n": 0}

    def on_season(name, scenes):
        count["n"] += 1
        year, kind = name.split("-")
        when = f"{'Jan–Apr' if kind == 'dry' else 'Nov–Dec'} {year}"
        say("read", f"{when}: {scenes} satellite photos" if scenes else f"{when}: no clear photos", count["n"], total)

    say("read", "Looking for satellite photos of the lake since 2019", 0, total)
    out = work / "out"
    run(lake_id, lakes_file, out, list(YEARS), None, on_season=on_season)

    say("change", "Comparing every year with 2019 and 2020")
    index = json.loads((out / "index.json").read_text(encoding="utf-8"))
    entry = next(l for l in index["lakes"] if l["id"] == lake_id)
    entry.update({"state": lake.get("state"), "city": lake.get("near"), "osm_id": lake_id, "tracked_on_demand": True})
    (out / "lakes" / lake_id / "summary.json").write_text(json.dumps(entry, indent=2), encoding="utf-8")
    # No flag has been checked on sharper photos yet; the lake page reads this file.
    (out / "lakes" / lake_id / "checks.json").write_text(json.dumps({"as_of": "", "flags": {}}), encoding="utf-8")
    say("save", f"{entry['flagged_ac']} acres turned to land. Saving the results")
    export.upload_dir(out / "lakes" / lake_id, bucket, f"lakes/{lake_id}/")
    # Photos for the lake's step-by-step story, same framing as every other lake.
    say("save", "Making the photos for the lake's story")
    stats = json.loads((out / "lakes" / lake_id / "stats.json").read_text(encoding="utf-8"))
    bounds = json.loads((out / "lakes" / lake_id / "bounds.json").read_text(encoding="utf-8"))["bounds"]
    story = work / "story"
    story_for(lake_id, stats, bounds, story)
    export.upload_dir(story, bucket, f"lakes/{lake_id}/story/")
    return entry


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("lake_id")
    p.add_argument("--bucket", required=True)
    args = p.parse_args()
    print(json.dumps(track(args.lake_id, args.bucket, lambda *a, **k: print(*a)), indent=2))


if __name__ == "__main__":
    main()
