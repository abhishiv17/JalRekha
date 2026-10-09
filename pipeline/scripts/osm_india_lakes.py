"""Catalog of named lakes across India from OpenStreetMap (Overpass API).

    python scripts/osm_india_lakes.py <raw_dir> <out_dir>

For every state and union territory: named natural=water (and older
landuse=reservoir) polygons that are lakes, reservoirs, ponds or tanks (rivers, canals and the like left out), with
area, centroid, nearest town and a simplified outline. Raw Overpass replies
are cached in <raw_dir>, so a re-run only fetches what is missing.

Writes:
  <out_dir>/india.json             [{id, name, state, near, lat, lon, ha}] (no geometry)
  <out_dir>/shapes/<state>.json    {id: svg path in a 100x100 box}
  <out_dir>/outlines/<state>.geojson  full outlines (WGS84) for the pipeline

Data © OpenStreetMap contributors, ODbL.
"""

import json
import math
import os
import warnings
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import LineString, MultiPolygon, Polygon, mapping
from shapely.ops import linemerge, polygonize, transform, unary_union

warnings.filterwarnings("ignore", category=DeprecationWarning)
OVERPASS = "https://overpass-api.de/api/interpreter"  # the community mirrors were down on 2026-10-09
UA = "JalRekha/0.1 (WeMakeDevs hackathon lake catalog)"
SKIP_WATER = {"river", "canal", "stream", "wastewater", "ditch", "drain", "moat", "fish_pass", "lock", "riverbank", "basin", "fountain"}
MIN_HA = 1.0  # drop tiny garden ponds


def overpass(query: str, cache: Path, allow_empty: bool = False) -> dict:
    """Run a query, caching good replies. Timeouts come back as an empty reply with
    a "remark", so empty replies are retried and never cached unless allowed."""
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    body = urllib.parse.urlencode({"data": query}).encode()
    for attempt in range(16):
        try:
            req = urllib.request.Request(OVERPASS, data=body, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=700) as r:
                data = json.loads(r.read())
            if data.get("remark") or (not data.get("elements") and not allow_empty):
                raise RuntimeError(f"incomplete reply: {data.get('remark', 'no elements')[:80]}")
            cache.write_text(json.dumps(data), encoding="utf-8")
            time.sleep(2)
            return data
        except Exception as e:  # 429/504 when the server is busy: back off
            wait = min(15 * (attempt + 1), 180)
            print(f"  overpass: {e}; retry in {wait}s", flush=True)
            time.sleep(wait)
    raise RuntimeError("overpass kept failing")


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def way_polygon(el):
    pts = [(p["lon"], p["lat"]) for p in el.get("geometry", [])]
    if len(pts) >= 4 and pts[0] == pts[-1]:
        return Polygon(pts)
    return None


def relation_polygon(el):
    outers, inners = [], []
    for m in el.get("members", []):
        if m.get("type") != "way" or "geometry" not in m:
            continue
        line = [(p["lon"], p["lat"]) for p in m["geometry"]]
        if len(line) >= 2:
            (inners if m.get("role") == "inner" else outers).append(LineString(line))
    if not outers:
        return None
    shell = unary_union(list(polygonize(linemerge(outers))))
    if inners:
        shell = shell.difference(unary_union(list(polygonize(linemerge(inners)))))
    return shell if not shell.is_empty else None


def svg_path(geom) -> str:
    """Outline scaled into a 100x100 box (north up), for card silhouettes."""
    minx, miny, maxx, maxy = geom.bounds
    k = 100 / max(maxx - minx, (maxy - miny), 1e-9)
    ox, oy = (100 - (maxx - minx) * k) / 2, (100 - (maxy - miny) * k) / 2
    parts = []
    polys = geom.geoms if isinstance(geom, MultiPolygon) else [geom]
    for poly in polys:
        for ring in [poly.exterior, *poly.interiors]:
            pts = [(ox + (x - minx) * k, oy + (maxy - y) * k) for x, y in ring.coords]
            parts.append("M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z")
    return "".join(parts)


def main(raw: Path, out: Path) -> None:
    raw.mkdir(parents=True, exist_ok=True)
    (out / "shapes").mkdir(parents=True, exist_ok=True)
    (out / "outlines").mkdir(parents=True, exist_ok=True)

    states = overpass(
        '[out:json][timeout:120];area["ISO3166-1"="IN"][admin_level=2]->.in;'
        'rel(area.in)["boundary"="administrative"]["admin_level"="4"];out tags;',
        raw / "_states.json",
    )["elements"]
    iso_codes = {s["id"]: s["tags"].get("ISO3166-2") for s in states}
    states = sorted(
        {(s["id"], s["tags"].get("name:en") or s["tags"].get("name")) for s in states}, key=lambda x: x[1]
    )
    print(len(states), "states/UTs", flush=True)
    towns = overpass(
        '[out:json][timeout:300];area["ISO3166-1"="IN"][admin_level=2]->.in;'
        'node["place"~"^(city|town)$"]["name"](area.in);out;',
        raw / "_towns.json",
    )["elements"]
    towns = [(t["tags"].get("name:en") or t["tags"]["name"], t["lat"], t["lon"]) for t in towns]
    print(len(towns), "towns and cities", flush=True)

    catalog = []
    for rel_id, state in states:
        area_id = 3600000000 + rel_id
        key = slug(state)
        print(f"{state}...", flush=True)
        water = []
        for kind in ("way", "relation"):
            water += overpass(
                f'[out:json][timeout:600];area({area_id})->.s;{kind}["natural"="water"]["name"](area.s);out geom;',
                raw / f"{key}-{kind}.json",
                allow_empty=True,
            )["elements"]
            # Many Indian tanks are mapped with the older landuse=reservoir tag only.
            if os.environ.get("KW_NATURAL_WATER_ONLY"):
                continue
            water += overpass(
                f'[out:json][timeout:600];area({area_id})->.s;'
                f'{kind}["landuse"="reservoir"]["name"]["natural"!="water"](area.s);out geom;',
                raw / f"{key}-{kind}-reservoir.json",
                allow_empty=True,
            )["elements"]
        if not water:  # some state boundaries have no area object yet; try the ISO code
            iso = iso_codes.get(rel_id)
            if iso:
                water = overpass(
                    f'[out:json][timeout:600];area["ISO3166-2"="{iso}"]->.s;'
                    f'(way["natural"="water"]["name"](area.s);relation["natural"="water"]["name"](area.s););out geom;',
                    raw / f"{key}-iso.json",
                    allow_empty=True,
                )["elements"]

        shapes, outlines, n = {}, [], 0
        for el in water:
            tags = el.get("tags", {})
            if tags.get("water") in SKIP_WATER or tags.get("waterway"):
                continue
            geom = way_polygon(el) if el["type"] == "way" else relation_polygon(el)
            if geom is None or not geom.is_valid:
                geom = geom.buffer(0) if geom is not None else None
            if geom is None or geom.is_empty:
                continue
            c = geom.representative_point()
            utm = Transformer.from_crs("EPSG:4326", f"EPSG:{32600 + int((c.x + 180) / 6) + 1}", always_xy=True).transform
            ha = transform(utm, geom).area / 10_000
            if ha < MIN_HA:
                continue
            name = tags.get("name:en") or tags["name"]
            lake_id = f"osm-{el['type'][0]}{el['id']}"
            near = None
            if towns:
                d, t = min((math.hypot((c.x - lon) * math.cos(math.radians(c.y)), c.y - lat), tn) for tn, lat, lon in towns)
                if d < 0.3:  # ~30 km
                    near = t
            catalog.append({"id": lake_id, "name": name, "state": state, "near": near,
                            "lat": round(c.y, 5), "lon": round(c.x, 5), "ha": round(ha, 1)})
            simple = geom.simplify(max(geom.bounds[2] - geom.bounds[0], geom.bounds[3] - geom.bounds[1]) / 120)
            shapes[lake_id] = svg_path(simple if not simple.is_empty else geom)
            outlines.append({"type": "Feature", "properties": {"id": lake_id, "name": name},
                             "geometry": mapping(geom.simplify(0.00002))})
            n += 1
        (out / "shapes" / f"{key}.json").write_text(json.dumps(shapes, separators=(",", ":")), encoding="utf-8")
        (out / "outlines" / f"{key}.geojson").write_text(
            json.dumps({"type": "FeatureCollection", "features": outlines}, separators=(",", ":")), encoding="utf-8")
        print(f"  {n} lakes", flush=True)
        write_catalog(out, catalog, "india.partial.json")

    write_catalog(out, catalog, "india.json")
    (out / "india.partial.json").unlink(missing_ok=True)
    print(len(catalog), "lakes in total", flush=True)


def write_catalog(out: Path, catalog: list, name: str) -> None:
    unique = {}
    for row in catalog:  # a lake on a state border comes back for both states; keep the first
        unique.setdefault(row["id"], row)
    rows = sorted(unique.values(), key=lambda l: -l["ha"])
    (out / name).write_text(json.dumps(rows, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
