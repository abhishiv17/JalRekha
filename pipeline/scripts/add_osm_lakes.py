"""Add lakes from the OSM catalog to data/lakes/lakes.geojson so the pipeline can run them.

    python scripts/add_osm_lakes.py ../data/catalog ../data/lakes/lakes.geojson

Edit ADD below: our id -> (OSM catalog id, display name, city, state, note).
A lake already in lakes.geojson with the same id is replaced.
Outlines © OpenStreetMap contributors, ODbL.
"""

import json
import sys
from pathlib import Path

ADD = {
    "bellandur": ("osm-r19751547", "Bellandur Lake", "Bengaluru", "Karnataka", "Survey dispute: 16 vs 36 acres encroached"),
    "varthur": ("osm-r19306126", "Varthur Lake", "Bengaluru", "Karnataka", "Downstream of Bellandur"),
    "kaikondrahalli": ("osm-r6820030", "Kaikondrahalli Lake", "Bengaluru", "Karnataka", "Restored lake; candidate quiet control"),
    "durgam-cheruvu": ("osm-w28131043", "Durgam Cheruvu", "Hyderabad", "Telangana", "Second city"),
    "ameenpur": ("osm-w115772000", "Ameenpur Lake", "Hyderabad", "Telangana", "Second city"),
    "chembarambakkam": ("osm-w25453624", "Chembarambakkam Lake", "Chennai", "Tamil Nadu", "Third city; flood reservoir"),
    "mallathahalli": ("osm-w37898906", "Mallathahalli Lake", "Bengaluru", "Karnataka", "Demo lake near ITI Layout, west Bengaluru"),
}


def main(catalog: Path, lakes_file: Path) -> None:
    wanted = {osm_id: lake_id for lake_id, (osm_id, *_rest) in ADD.items()}
    found = {}
    for f in sorted((catalog / "outlines").glob("*.geojson")):
        for feat in json.loads(f.read_text(encoding="utf-8"))["features"]:
            lake_id = wanted.get(feat["properties"]["id"])
            if lake_id and lake_id not in found:
                found[lake_id] = feat["geometry"]
    missing = set(ADD) - set(found)
    if missing:
        sys.exit(f"not in the OSM catalog outlines: {sorted(missing)}")

    collection = json.loads(lakes_file.read_text(encoding="utf-8"))
    keep = [f for f in collection["features"] if f["properties"]["id"] not in ADD]
    for lake_id, (osm_id, name, city, state, note) in ADD.items():
        keep.append({
            "type": "Feature",
            "properties": {"id": lake_id, "name": name, "city": city, "state": state,
                           "source": "OpenStreetMap", "osm_id": osm_id, "note": note},
            "geometry": found[lake_id],
        })
    collection["features"] = keep
    collection["attribution"] = (
        "Lake outlines: ATREE-CSEI, Map of Lakes in Bengaluru Urban within BBMP Area (CC BY), via OpenCity; "
        "© OpenStreetMap contributors (ODbL) for lakes marked source=OpenStreetMap"
    )
    lakes_file.write_text(json.dumps(collection, indent=1), encoding="utf-8")
    print(len(keep), "lakes in", lakes_file)
    for f in keep:
        print(" ", f["properties"]["id"])


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
