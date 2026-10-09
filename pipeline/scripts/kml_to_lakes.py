"""Build data/lakes/lakes.geojson from the ATREE-CSEI BBMP lakes KML.

    python scripts/kml_to_lakes.py <atree_lakes.kml> ../data/lakes/lakes.geojson

Download the KML from
https://data.opencity.in/dataset/map-lakes-streams-bengaluru-urban-within-bbmp-area
(CC BY, ATREE-CSEI). Only the lakes in LAKES are kept, and only their
names, custodian and area; ward contact fields are dropped.
"""

import json
import sys
import xml.etree.ElementTree as ET

KML = "{http://www.opengis.net/kml/2.2}"
M2_PER_ACRE = 4046.8564

# our id -> (ATREE UniqueID, display name, note)
LAKES = {
    "subedeharana-kere": (184, "Subedeharana Kere", "ATREE name: Infrastructure Corridor (alt. Subbedarana kere)"),
    "pattandur-agrahara": (167, "Pattandur Agrahara Lake", "ATREE name: Pattaduru Agrahara kere-2"),
    "ambalipura-kelagina": (107, "Ambalipura Kelagina Kere", "Candidate for the Harlur/Ambalipura pond report; verify"),
    "sadaramangala": (62, "Sadaramangala Lake", "ATREE name: Kodigehalli lake (alt. Sadaramangala)"),
    "yele-mallappa-shetty": (86, "Yele Mallappa Shetty Lake", "ATREE name: Avalahali kere (alt. Yellamallappashetti Kere)"),
    "jakkur": (46, "Jakkur Lake", "Control lake"),
}


def ring(coords_el):
    pts = []
    for token in coords_el.text.split():
        lon, lat, *_ = token.split(",")
        pts.append([round(float(lon), 7), round(float(lat), 7)])
    if pts[0] != pts[-1]:
        pts.append(pts[0])
    return pts


def polygons(placemark):
    out = []
    for poly in placemark.iter(f"{KML}Polygon"):
        outer = poly.find(f"{KML}outerBoundaryIs/{KML}LinearRing/{KML}coordinates")
        holes = poly.findall(f"{KML}innerBoundaryIs/{KML}LinearRing/{KML}coordinates")
        out.append([ring(outer)] + [ring(h) for h in holes])
    return out


def main(src, dst):
    wanted = {uid: lake_id for lake_id, (uid, _, _) in LAKES.items()}
    features = {}
    for pm in ET.parse(src).getroot().iter(f"{KML}Placemark"):
        data = {sd.get("name"): (sd.text or "").strip() for sd in pm.iter(f"{KML}SimpleData")}
        uid = int(float(data.get("UniqueID") or -1))
        if uid not in wanted or wanted[uid] in features:
            continue
        lake_id = wanted[uid]
        _, name, note = LAKES[lake_id]
        polys = polygons(pm)
        geometry = (
            {"type": "Polygon", "coordinates": polys[0]}
            if len(polys) == 1
            else {"type": "MultiPolygon", "coordinates": polys}
        )
        area_m2 = float(data["Aream3"]) if data.get("Aream3") else None  # field holds m2
        features[lake_id] = {
            "type": "Feature",
            "properties": {
                "id": lake_id,
                "name": name,
                "atree_id": uid,
                "atree_name": data.get("Name_of_th"),
                "atree_alt_name": data.get("Alternativ") or None,
                "custodian": data.get("New_Custod") or data.get("Custodian") or None,
                "atree_area_ac": round(area_m2 / M2_PER_ACRE, 2) if area_m2 else None,
                "note": note,
            },
            "geometry": geometry,
        }

    missing = set(LAKES) - set(features)
    if missing:
        sys.exit(f"not found in KML: {sorted(missing)}")
    collection = {
        "type": "FeatureCollection",
        "attribution": "Lake outlines: ATREE-CSEI, Map of Lakes in Bengaluru Urban within BBMP Area (CC BY), via OpenCity",
        "features": [features[k] for k in LAKES],
    }
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(collection, f, indent=1)
    for feat in collection["features"]:
        p = feat["properties"]
        print(f"{p['id']:<22} {p['atree_area_ac']!s:>8} ac  {feat['geometry']['type']}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
