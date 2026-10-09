"""Hand-check kit: every flag as a spreadsheet row and a Google Earth layer.

    python scripts/make_checklist.py ../data/out ../research

Writes:
  flags_to_check.csv  one row per flag, with map links and empty verdict columns
  flags_to_check.kml  open in Google Earth Pro, then use the historical imagery slider

Very large lakes (more than MAX_PER_LAKE flags) keep only their biggest flags;
the CSV says so in the "sampled" column.
"""

import csv
import json
import sys
from pathlib import Path
from xml.sax.saxutils import escape

MAX_PER_LAKE = 10


def centre(geom):
    rings = [geom["coordinates"][0]] if geom["type"] == "Polygon" else [p[0] for p in geom["coordinates"]]
    pts = [pt for r in rings for pt in r]
    return sum(p[1] for p in pts) / len(pts), sum(p[0] for p in pts) / len(pts)


def kml_polygon(geom):
    polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    out = []
    for poly in polys:
        coords = " ".join(f"{x},{y},0" for x, y in poly[0])
        out.append(f"<Polygon><outerBoundaryIs><LinearRing><coordinates>{coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>")
    return "<MultiGeometry>" + "".join(out) + "</MultiGeometry>"


def main(results: Path, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    rows, placemarks = [], []
    for lake_dir in sorted((results / "lakes").iterdir()):
        stats = json.loads((lake_dir / "stats.json").read_text(encoding="utf-8"))
        flags = json.loads((lake_dir / "flags.geojson").read_text(encoding="utf-8"))["features"]
        flags.sort(key=lambda f: -f["properties"]["area_ac"])
        sampled = len(flags) > MAX_PER_LAKE
        for f in flags[:MAX_PER_LAKE]:
            p = f["properties"]
            lat, lon = centre(f["geometry"])
            rows.append({
                "lake": stats["name"],
                "flag_id": p["flag_id"],
                "zone": p["zone"],
                "kind": p.get("kind", ""),
                "area_ac": p["area_ac"],
                "first_seen": p["first_seen"],
                "status": p["status"],
                "confidence": p["confidence"],
                "lat": round(lat, 6),
                "lon": round(lon, 6),
                "google_maps": f"https://www.google.com/maps/@{lat:.6f},{lon:.6f},19z/data=!3m1!1e3",
                "google_earth_web": f"https://earth.google.com/web/@{lat:.6f},{lon:.6f},0a,400d,35y,0h,0t,0r",
                "sampled": f"top {MAX_PER_LAKE} of {len(flags)} by area" if sampled else "",
                # filled in by the checker:
                "verdict": "",
                "what_you_see": "",
                "imagery_dates_compared": "",
                "checked_by": "",
            })
            desc = (f"{stats['name']} · {p['zone']} · {p.get('kind', '')} · {p['area_ac']} ac · "
                    f"first seen {p['first_seen']} · {p['status']} · {p['confidence']}")
            placemarks.append(
                f"<Placemark><name>{escape(p['flag_id'])}</name><description>{escape(desc)}</description>"
                f"<styleUrl>#flag</styleUrl>{kml_polygon(f['geometry'])}</Placemark>")
    with (out / "flags_to_check.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    kml = ('<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>'
           "<name>KereWatch flags to check</name>"
           '<Style id="flag"><LineStyle><color>ff335aff</color><width>3</width></LineStyle>'
           "<PolyStyle><color>40335aff</color></PolyStyle></Style>"
           + "".join(placemarks) + "</Document></kml>")
    (out / "flags_to_check.kml").write_text(kml, encoding="utf-8")
    print(f"{len(rows)} flags -> {out / 'flags_to_check.csv'} and .kml")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
