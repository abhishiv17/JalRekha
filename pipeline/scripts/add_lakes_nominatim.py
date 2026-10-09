"""Add lakes to data/lakes/lakes.geojson with outlines from OpenStreetMap (via Nominatim).

    python scripts/add_lakes_nominatim.py ../data/lakes/lakes.geojson

Edit LAKES below: our id -> (OSM id like "W291654387" / "R16104149", or a search
text, display name, city, state). A lake already in the file with the same id is
replaced. Hauz Khas Lake is unnamed in OSM (relation 2196532), so Nominatim
can't return it; its outline was built from Overpass by hand. Nominatim asks for at most one request per second and a real User-Agent.
Outlines © OpenStreetMap contributors, ODbL.
"""

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

LAKES = {
    # Delhi and around (NCR)
    "najafgarh-jheel": ("W203051309", "Najafgarh Jheel", "Delhi", "Delhi"),
    "bhalswa": ("R16104149", "Bhalswa Lake", "Delhi", "Delhi"),
    "sanjay-lake": ("W76849338", "Sanjay Lake", "Delhi", "Delhi"),
    "neela-hauz": ("W284622267", "Neela Hauz", "Delhi", "Delhi"),
    "purana-qila": ("W370947967", "Purana Qila Lake", "Delhi", "Delhi"),
    "naraina": ("W291654387", "Naraina Lake", "Delhi", "Delhi"),
    "shamshi-talab": ("W470219310", "Shamshi Talab", "Delhi", "Delhi"),
    "shahdara-lake": ("W480075080", "Shahdara Lake", "Delhi", "Delhi"),
    "nehru-vihar-pond": ("R20256879", "Nehru Vihar Pond", "Delhi", "Delhi"),
    "naini-lake-delhi": ("W1189315016", "Naini Lake", "Delhi", "Delhi"),
    "dariyapur-pond": ("W1349493394", "Dariyapur Pond", "Delhi", "Delhi"),
    "neeli-jheel": ("W204969708", "Neeli Jheel", "Faridabad", "Haryana"),
}

UA = "JalRekha/0.1 (WeMakeDevs Environmental Hacks; github.com/abhishiv17/JalRekha)"
API = "https://nominatim.openstreetmap.org"


def _get(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def outline(ref: str):
    """Polygon geometry for an OSM id ("W123", "R456") or the first search hit."""
    if ref[:1] in "WR" and ref[1:].isdigit():
        url = f"{API}/lookup?osm_ids={ref}&format=geojson&polygon_geojson=1"
    else:
        q = urllib.parse.quote(ref)
        url = f"{API}/search?q={q}&format=geojson&polygon_geojson=1&limit=1&countrycodes=in"
    features = _get(url)["features"]
    if not features:
        raise LookupError(ref)
    f = features[0]
    if f["geometry"]["type"] not in ("Polygon", "MultiPolygon"):
        raise LookupError(f"{ref}: got a {f['geometry']['type']}, not an outline")
    props = f["properties"]
    osm = f"{props.get('osm_type', '')[:1].upper()}{props.get('osm_id', '')}"
    return f["geometry"], osm


def main(lakes_file: Path) -> None:
    collection = json.loads(lakes_file.read_text(encoding="utf-8"))
    keep = [f for f in collection["features"] if f["properties"]["id"] not in LAKES]
    for lake_id, (ref, name, city, state) in LAKES.items():
        try:
            geom, osm = outline(ref)
        except LookupError as e:
            print(f"skip {lake_id}: {e}")
            continue
        finally:
            time.sleep(1.1)
        keep.append({
            "type": "Feature",
            "properties": {"id": lake_id, "name": name, "city": city, "state": state,
                           "osm_id": osm, "source": "OpenStreetMap (ODbL)"},
            "geometry": geom,
        })
        print(f"added {lake_id} ({osm})")
    collection["features"] = keep
    lakes_file.write_text(json.dumps(collection), encoding="utf-8")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
