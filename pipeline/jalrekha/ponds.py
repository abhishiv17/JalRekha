"""Find a city's ponds from space and which of them have vanished since 2019.

Ponds in north India fill with the monsoon and shrink by summer, so this uses the
months after it (November to January), when they still hold water and the rice
fields, which are flooded in September and October, have been harvested.

1. One cloud-free median per season, 2019-2025, from Sentinel-2 (AWS Open Data),
   over the whole city at 10 m. Pixels with no clear pass stay unknown.
2. A pond is a patch where the median MNDWI is above WATER_MNDWI in at least 2 of
   the baseline seasons (2019-2021), between MIN_PX and MAX_PX in size. The river
   and anything within RIVER_GAP_M of it are left out, and so are long thin
   shapes (drains and canals, compactness below MIN_COMPACT).
3. In the recent seasons (2024-2025) the test is gentler (STILL_MNDWI), so murky
   or weedy water still counts: calling a pond gone must need strong evidence.
   Only seasons with a clear look at most of the pond count. It vanished if none
   of it held water in any of them, shrank if less than half did, alive otherwise,
   and unknown if no recent season had a clear look.
4. What is there now, from the latest clear season's colours: built over or bare
   ground, dried and grassed, or unclear.
5. Good news too: patches with no water in any baseline season but water in every
   recent one are "came_back" (a revived pond, or new water such as a new lake or
   a flooded pit: the photos show which). Not shown on the site: too often it is the
   river changing course or a wet field. Revivals are proved per pond (pondcheck.py).
6. Each pond gets its district (OpenStreetMap), so a letter reaches the right office.

Writes ponds.geojson (one point and outline per pond with its numbers), summary.json
and small before/after photos of every pond that vanished or shrank.

    python -m jalrekha.ponds --city delhi --out ../data/ponds
"""

import argparse
import datetime as dt
import json
import warnings
from pathlib import Path

import numpy as np
import odc.stac
from odc.geo.geobox import GeoBox
from PIL import Image
from pyproj import Transformer
from pystac_client import Client
from rasterio.features import shapes
from scipy import ndimage
from shapely.geometry import mapping, shape
from shapely.ops import transform as reproject_geom, unary_union

from .config import BOA_OFFSET, REFLECTANCE_SCALE, STAC_URL
from .indices import mndwi, ndbi, ndvi
from .masks import clear_mask

CITIES = {
    "delhi": {
        "name": "Delhi",
        "bbox": [76.84, 28.41, 77.34, 28.88],  # NCT of Delhi
        "crs": "EPSG:32643",
        "osm": "R1942586",  # the boundary: only ponds inside it are kept (the box spills into Haryana and UP)
    },
}
BASELINE = (2019, 2020, 2021)
RECENT = (2024, 2025)
MONTHS = "11-01", "01-31"  # November of the year to January of the next
WATER_MNDWI = 0.1
STILL_MNDWI = 0.0
OPEN_MNDWI = 0.3  # "water came back" needs clearly open water, not a waterlogged field
MIN_COMPACT = 0.15  # 4 pi area / perimeter^2: a ring of pixels around a pond is ~0.3+, a drain is below 0.1
MIN_CLEAR = 0.8  # share of a pond a season must see clearly to count
MIN_PX = 8  # 800 m2
MAX_PX = 200_000  # 20 km2: anything bigger is a lake system or the river, not a pond
RIVER_PX = 300_000  # water patches this big in every baseline year are the river
RIVER_GAP_M = 300
THUMB_M = 300
MAX_SCENES = 15
MAX_CLOUD = 60


def boundary(city: dict):
    """The city's boundary from OpenStreetMap (Nominatim), in WGS84."""
    import requests

    r = requests.get("https://nominatim.openstreetmap.org/lookup",
                     params={"osm_ids": city["osm"], "polygon_geojson": 1, "format": "json"},
                     headers={"User-Agent": "JalRekha/1.0 (lake watch)"}, timeout=60)
    r.raise_for_status()
    return shape(r.json()[0]["geojson"])


def districts(city: dict) -> list[tuple[str, object]]:
    """The city's districts (admin level 5) from OpenStreetMap, as (name, WGS84 shape)."""
    import requests
    from shapely.ops import polygonize

    q = (f'[out:json][timeout:120];rel({city["osm"][1:]});map_to_area->.c;'
         'rel(area.c)["boundary"="administrative"]["admin_level"="5"];out geom;')
    r = requests.post("https://overpass-api.de/api/interpreter", data={"data": q},
                      headers={"User-Agent": "JalRekha/1.0 (lake watch)"}, timeout=180)
    r.raise_for_status()
    out = []
    for rel in r.json()["elements"]:
        lines = [[(pt["lon"], pt["lat"]) for pt in m["geometry"]] for m in rel.get("members", [])
                 if m["type"] == "way" and m.get("role") in ("outer", "") and m.get("geometry")]
        from shapely.geometry import LineString
        geom = unary_union(list(polygonize(unary_union([LineString(l) for l in lines if len(l) > 1]))))
        if not geom.is_empty:
            out.append((rel["tags"].get("name:en") or rel["tags"].get("name", "?"), geom))
    return out


def grid(city: dict) -> GeoBox:
    w, s, e, n = city["bbox"]
    to = Transformer.from_crs("EPSG:4326", city["crs"], always_xy=True).transform
    xs, ys = zip(*(to(x, y) for x in (w, e) for y in (s, n)))
    return GeoBox.from_bbox((min(xs), min(ys), max(xs), max(ys)), crs=city["crs"], resolution=10)


def year_median(city: dict, gbox: GeoBox, year: int) -> dict | None:
    """Median reflectance of the clearest post-monsoon passes (cloud and shadow masked)."""
    w, s, e, n = city["bbox"]
    items = Client.open(STAC_URL).search(
        collections=["sentinel-2-l2a"], bbox=(w, s, e, n), datetime=f"{year}-{MONTHS[0]}/{year + 1}-{MONTHS[1]}",
        query={"eo:cloud_cover": {"lt": MAX_CLOUD}},
    ).item_collection()
    if not items:
        return None
    # Keep the clearest passes per tile, so every part of the city has a few looks.
    items = sorted(items, key=lambda it: it.properties["eo:cloud_cover"])
    by_tile: dict[str, list] = {}
    for it in items:
        by_tile.setdefault(it.properties.get("s2:mgrs_tile", ""), []).append(it)
    items = [it for group in by_tile.values() for it in group[:MAX_SCENES]]
    odc.stac.configure_rio(cloud_defaults=True, aws={"aws_unsigned": True})
    ds = odc.stac.load(items, bands=["blue", "green", "red", "nir", "swir16", "scl"], geobox=gbox,
                       groupby="solar_day", resampling={"swir16": "bilinear", "*": "nearest"}, pool=16)
    by_day = {it.datetime.date(): it for it in items}
    offs = []
    for t in ds.time.values:
        it = by_day.get(np.datetime64(t, "D").item(), items[0])
        base = float(it.properties.get("s2:processing_baseline", "0"))
        offs.append(BOA_OFFSET if base >= 4.0 and not it.properties.get("earthsearch:boa_offset_applied", False) else 0.0)
    off = np.array(offs, dtype="float32")[:, None, None]
    valid = clear_mask(ds["scl"].values)
    out = {}
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        for b in ("blue", "green", "red", "nir", "swir16"):
            dn = ds[b].values
            refl = np.where(valid & (dn > 0), dn * REFLECTANCE_SCALE + off, np.nan).astype("float32")
            out[b] = np.nanmedian(refl, axis=0)
            del refl
    out["scenes"] = len(ds.time)
    return out


def classify_now(img: dict, region: np.ndarray) -> str:
    """What replaced the pond, from the latest year's colours inside it."""
    nd_v = ndvi(img["nir"], img["red"])[region]
    nd_b = ndbi(img["swir16"], img["nir"])[region]
    ok = np.isfinite(nd_v) & np.isfinite(nd_b)
    if ok.sum() < 3:
        return "unclear"
    green = np.mean(nd_v[ok] >= 0.35)
    built = np.mean((nd_v[ok] < 0.2) & (nd_b > -0.05))
    if built >= 0.5:
        return "built_or_bare"
    if green >= 0.5:
        return "dried_grassed"
    return "unclear"


def clear_share(img: dict, rows: slice, cols: slice) -> float:
    return float(np.isfinite(img["green"][rows, cols]).mean())


def thumb(img: dict, rows: slice, cols: slice, path: Path) -> None:
    rgb = np.dstack([img[b][rows, cols] for b in ("red", "green", "blue")])
    rgb = np.nan_to_num(np.clip(rgb / 0.3, 0, 1) * 255).astype("uint8")
    Image.fromarray(rgb, "RGB").resize((160, 160), Image.BICUBIC).save(path, quality=85)


def run(city_id: str, out_root: Path) -> Path:
    city = CITIES[city_id]
    gbox = grid(city)
    print(f"grid {gbox.shape} at 10 m")
    years = sorted(set(BASELINE) | set(RECENT))
    imgs, water, wet, seen, open_water = {}, {}, {}, {}, {}
    for y in years:
        img = year_median(city, gbox, y)
        if img is None:
            print(f"{y}: no scenes", flush=True)
            continue
        m = mndwi(img["green"], img["swir16"])
        seen[y] = np.isfinite(m)
        water[y] = np.nan_to_num(m, nan=-1) > WATER_MNDWI
        if y in RECENT:
            wet[y] = np.nan_to_num(m, nan=-1) > STILL_MNDWI
            open_water[y] = np.nan_to_num(m, nan=-1) > OPEN_MNDWI
        if y == BASELINE[0] or y in RECENT:
            imgs[y] = img  # colours only for the before photo and the recent seasons (memory)
        print(f"{y}: {img['scenes']} passes, {seen[y].mean() * 100:.1f}% seen clearly, {water[y].mean() * 100:.2f}% water", flush=True)

    base_years = [y for y in BASELINE if y in water]
    recent_years = [y for y in RECENT if y in water]
    count = np.sum([water[y] for y in base_years], axis=0)
    baseline = count >= 2

    # The river and big lakes: very large patches of water in every baseline year.
    # (the river's course shifts, so its big patches in the recent seasons count too)
    steady = np.logical_and.reduce([water[y] for y in base_years]) | np.logical_and.reduce([water[y] for y in recent_years])
    lab, n = ndimage.label(steady)
    sizes = ndimage.sum(steady, lab, index=np.arange(1, n + 1))
    river = np.isin(lab, np.flatnonzero(sizes >= RIVER_PX) + 1)
    near_river = ndimage.binary_dilation(river, iterations=RIVER_GAP_M // 10)

    lab, n = ndimage.label(baseline & ~near_river, structure=np.ones((3, 3)))
    print(f"{n} candidate ponds")
    objs = ndimage.find_objects(lab)
    to_ll = Transformer.from_crs(gbox.crs, "EPSG:4326", always_xy=True).transform
    out = out_root / city_id
    (out / "thumbs").mkdir(parents=True, exist_ok=True)
    first = BASELINE[0]
    feats, tally = [], {"alive": 0, "shrank": 0, "vanished": 0}
    skipped = {"drain_or_canal": 0, "no_clear_recent_look": 0, "outside_city": 0}
    inside = boundary(city)
    for i, sl in enumerate(objs, start=1):
        if sl is None:
            continue
        mask = lab[sl] == i
        px = int(mask.sum())
        if px < MIN_PX or px > MAX_PX:
            continue
        geom = unary_union([shape(g) for g, v in shapes(mask.astype("uint8"), mask=mask,
                            transform=gbox.affine * gbox.affine.translation(sl[1].start, sl[0].start)) if v == 1])
        if not inside.contains(reproject_geom(to_ll, geom).representative_point()):
            skipped["outside_city"] += 1
            continue
        if 4 * np.pi * geom.area / max(geom.length, 1) ** 2 < MIN_COMPACT:
            skipped["drain_or_canal"] += 1
            continue
        looked = [y for y in recent_years if seen[y][sl][mask].mean() >= MIN_CLEAR]
        if not looked:
            skipped["no_clear_recent_look"] += 1
            continue
        still = float(np.logical_or.reduce([wet[y][sl][mask] for y in looked]).mean())
        status = "vanished" if still == 0 else "shrank" if still < 0.5 else "alive"
        tally[status] += 1
        ll = reproject_geom(to_ll, geom)
        c = ll.representative_point()
        props = {
            "id": f"{city_id}-{i}",
            "status": status,
            "area_ha": round(px * 100 / 10_000, 2),
            "water_left": round(still, 2),
            "baseline_years_with_water": int(np.max(count[sl][mask])),
            "recent_years_seen": looked,
            "lat": round(c.y, 5),
            "lon": round(c.x, 5),
        }
        if status != "alive":
            region = np.zeros(gbox.shape, bool)
            region[sl] = mask
            props["now"] = classify_now(imgs[looked[-1]], region)
            r0, c0 = (sl[0].start + sl[0].stop) // 2, (sl[1].start + sl[1].stop) // 2
            half = THUMB_M // 20
            rows = slice(max(r0 - half, 0), r0 + half)
            cols = slice(max(c0 - half, 0), c0 + half)
            # The clearest recent season for the after photo, the latest if it ties.
            latest = max(looked, key=lambda y: (round(clear_share(imgs[y], rows, cols), 1), y))
            pair = [y for y in (first, latest) if y in imgs]
            for y in pair:
                thumb(imgs[y], rows, cols, out / "thumbs" / f"{props['id']}-{y}.jpg")
            props["thumbs"] = [f"thumbs/{props['id']}-{y}.jpg" for y in pair]
        feats.append({"type": "Feature", "properties": props, "geometry": mapping(ll.simplify(0.00003))})
    # Water that came back: no water in any baseline season, water in every recent one.
    # Clearly open water in every recent season (wet fields and sandbanks are only faintly "wet").
    back = np.logical_and.reduce([open_water[y] for y in recent_years]) & (count == 0) & ~near_river
    lab, n = ndimage.label(back, structure=np.ones((3, 3)))
    tally["came_back"] = 0
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        if sl is None:
            continue
        mask = lab[sl] == i
        px = int(mask.sum())
        if px < MIN_PX or px > MAX_PX:
            continue
        geom = unary_union([shape(g) for g, v in shapes(mask.astype("uint8"), mask=mask,
                            transform=gbox.affine * gbox.affine.translation(sl[1].start, sl[0].start)) if v == 1])
        ll = reproject_geom(to_ll, geom)
        if not inside.contains(ll.representative_point()) or 4 * np.pi * geom.area / max(geom.length, 1) ** 2 < MIN_COMPACT:
            continue
        tally["came_back"] += 1
        c = ll.representative_point()
        props = {"id": f"{city_id}-b{i}", "status": "came_back", "area_ha": round(px * 100 / 10_000, 2),
                 "water_left": 1.0, "lat": round(c.y, 5), "lon": round(c.x, 5)}
        r0, c0 = (sl[0].start + sl[0].stop) // 2, (sl[1].start + sl[1].stop) // 2
        half = THUMB_M // 20
        rows, cols = slice(max(r0 - half, 0), r0 + half), slice(max(c0 - half, 0), c0 + half)
        # Before: the first season's photo (the only baseline colours kept); after: the latest recent season.
        pair = [y for y in (first, recent_years[-1]) if y in imgs]
        for y in pair:
            thumb(imgs[y], rows, cols, out / "thumbs" / f"{props['id']}-{y}.jpg")
        props["thumbs"] = [f"thumbs/{props['id']}-{y}.jpg" for y in pair]
        props["dry_in"] = [y for y in base_years]
        feats.append({"type": "Feature", "properties": props, "geometry": mapping(ll.simplify(0.00003))})

    # Districts, so each letter reaches the right office.
    try:
        areas = districts(city)
        for f in feats:
            from shapely.geometry import Point
            pt = Point(f["properties"]["lon"], f["properties"]["lat"])
            f["properties"]["district"] = next((name for name, g in areas if g.contains(pt)), None)
        print(f"{len(areas)} districts", flush=True)
    except Exception as e:  # districts are a nicety; the scan stands without them
        print(f"districts failed: {e!r}", flush=True)

    order = {"vanished": 0, "shrank": 1, "came_back": 2, "alive": 3}
    feats.sort(key=lambda f: (order[f["properties"]["status"]], -f["properties"]["area_ha"]))
    (out / "ponds.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}), encoding="utf-8")
    lost_ha = sum(f["properties"]["area_ha"] for f in feats if f["properties"]["status"] == "vanished")
    ponds_n = sum(1 for f in feats if f["properties"]["status"] != "came_back")
    summary = {
        "city": city["name"], "bbox": city["bbox"], "baseline_years": base_years, "recent_years": recent_years,
        "ponds": ponds_n, **tally, "left_out": skipped, "vanished_ha": round(lost_ha, 1),
        "now": {k: sum(1 for f in feats if f["properties"].get("now") == k) for k in ("built_or_bare", "dried_grassed", "unclear")},
        "method": f"Sentinel-2 November-January medians; pond = MNDWI > {WATER_MNDWI} in 2 of 3 baseline seasons; "
                  f"still wet = MNDWI > {STILL_MNDWI} in any recent season with a clear look; drains and canals left out.",
        "made": dt.date.today().isoformat(),
    }
    (out / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return out


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--city", default="delhi", choices=sorted(CITIES))
    p.add_argument("--out", type=Path, default=Path("../data/ponds"))
    args = p.parse_args()
    run(args.city, args.out)


if __name__ == "__main__":
    main()
