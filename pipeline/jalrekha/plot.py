"""Plot Check: the water history of one spot, for someone about to buy or rent.

Uses the most reliable signal the pipeline has, whether open water was there,
not whether a lake was filled:

1. A 1.2 km window around the pin, every dry season (Jan-Apr) and
   post-monsoon season (Nov-Dec) since 2019, from the same Sentinel-2
   composites as the lake pipeline.
2. Water in each season (MNDWI above a per-window Otsu threshold, never
   below 0), read at the pin (3 x 3 pixels, so one noisy pixel can't decide).
3. The lake's largest historical extent: every pixel that was open water in
   any dry season, in patches of 500 m2 or more. Distance from the pin to it.
4. Buffer rules measured from that extent (not the revenue boundary).
5. Mapped flood events (see flood.py) sampled at the pin.

    python -m jalrekha.plot --lat 12.9649 --lon 77.4948 --out ../data/plot
"""

import argparse
import json
import math
import os
from pathlib import Path

import numpy as np
from odc.geo.geobox import GeoBox
from pyproj import Transformer
from scipy import ndimage

from .buffer import bill_2025_buffer_m
from .classify import water_threshold
from .config import M2_PER_ACRE, PIXEL_AREA_M2, RESOLUTION_M, THRESHOLDS, YEARS
from .run import load_seasons

HALF_WINDOW_M = 600  # 1.2 km box around the pin
PIN_PX = 1  # 3 x 3 pixels around the pin
NEAR_LAKE_M = 100  # "close to a lake" for the Watch level
FLOOD_NEAR_M = 250  # neighbourhood for "flooding nearby"
FLOOD_NEAR_SHARE = 0.05  # share of that neighbourhood flooded to count
CATALOG_MATCH_M = 1500  # catalogued lake within this distance names the lake

DATA_DIR = Path(os.environ.get("JALREKHA_DATA", Path(__file__).resolve().parents[2] / "data"))

# Buffer rules by state, measured from the water's edge. Sources: KTCDA Act
# 2014 (30 m) and its 2025 amendment bill (size tiers, not in force, see
# buffer.py); HMDA/HYDRAA (30 m for lakes over 10 ha, 9 m below). Elsewhere
# 30 m is shown as a common reference, not a rule.


def buffer_rules(state: str | None, lake_acres: float) -> list[dict]:
    if state == "Karnataka":
        return [
            {"rule": "ktcda_2014", "width_m": 30, "status": "in_force"},
            {"rule": "ktcda_bill_2025", "width_m": bill_2025_buffer_m(lake_acres), "status": "proposed"},
        ]
    if state == "Telangana":
        width = 30 if lake_acres > 10 / 0.404686 else 9  # 10 ha
        return [{"rule": "hmda", "width_m": width, "status": "in_force"}]
    return [{"rule": "reference_30m", "width_m": 30, "status": "reference"}]


def utm_crs(lon: float, lat: float) -> str:
    zone = int((lon + 180) // 6) + 1
    return f"EPSG:{32600 + zone if lat >= 0 else 32700 + zone}"


def plot_grid(lat: float, lon: float) -> tuple[GeoBox, tuple[int, int]]:
    """Window centred on the pin, and the pin's (row, col) in it."""
    crs = utm_crs(lon, lat)
    x, y = Transformer.from_crs("EPSG:4326", crs, always_xy=True).transform(lon, lat)
    # Snap to the 10 m grid so the pin sits in the middle of a pixel.
    x0 = math.floor((x - HALF_WINDOW_M) / RESOLUTION_M) * RESOLUTION_M
    y0 = math.floor((y - HALF_WINDOW_M) / RESOLUTION_M) * RESOLUTION_M
    size = 2 * HALF_WINDOW_M
    gbox = GeoBox.from_bbox((x0, y0, x0 + size, y0 + size), crs=crs, resolution=RESOLUTION_M)
    col = int((x - x0) // RESOLUTION_M)
    row = int((y0 + size - y) // RESOLUTION_M)
    return gbox, (row, col)


def pin_window(mask: np.ndarray, pin: tuple[int, int], r: int = PIN_PX) -> np.ndarray:
    row, col = pin
    return mask[max(row - r, 0): row + r + 1, max(col - r, 0): col + r + 1]


def water_at_pin(water: np.ndarray, valid: np.ndarray, pin: tuple[int, int]) -> bool | None:
    """Majority of the clear pixels around the pin; None if most are unclear."""
    w, v = pin_window(water, pin), pin_window(valid, pin)
    if v.sum() < (v.size + 1) // 2:
        return None
    return bool(w[v].sum() * 2 > v.sum())


def drop_specks(mask: np.ndarray, min_px: int = THRESHOLDS.min_flag_px) -> np.ndarray:
    """Remove water patches under 500 m2 (roofs, wet roads, single noisy pixels)."""
    labels, n = ndimage.label(mask, structure=np.ones((3, 3)))
    if n == 0:
        return mask
    sizes = ndimage.sum(mask, labels, index=np.arange(1, n + 1))
    keep = np.zeros(n + 1, dtype=bool)
    keep[1:] = sizes >= min_px
    return keep[labels]


def nearest_extent(extent: np.ndarray, pin: tuple[int, int]) -> dict:
    """Distance from the pin to the extent, and the patch it reaches."""
    if not extent.any():
        return {"distance_m": None, "patch_acres": None, "patch": np.zeros_like(extent)}
    dist, (rows, cols) = ndimage.distance_transform_edt(~extent, return_indices=True)
    row, col = pin
    distance = float(dist[row, col]) * RESOLUTION_M
    labels, _ = ndimage.label(extent, structure=np.ones((3, 3)))
    patch = labels == labels[rows[row, col], cols[row, col]]
    return {
        "distance_m": round(distance),
        "patch_acres": round(float(patch.sum()) * PIXEL_AREA_M2 / M2_PER_ACRE, 2),
        "patch": patch,
    }


def haversine_m(lat1, lon1, lat2, lon2) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(a))


def nearest_catalog_lake(lat: float, lon: float, catalog: list[dict]) -> dict | None:
    best = min(catalog, key=lambda l: haversine_m(lat, lon, l["lat"], l["lon"]), default=None)
    if best is None:
        return None
    d = haversine_m(lat, lon, best["lat"], best["lon"])
    return {**best, "centre_distance_m": round(d)} if d <= CATALOG_MATCH_M else None


def load_catalog(path: Path = DATA_DIR / "catalog" / "india.json") -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


def flood_events_at(lat: float, lon: float, floods_dir: Path = DATA_DIR / "floods") -> list[dict]:
    """Each mapped flood event covering the pin: flooded at the pin, share nearby."""
    import rasterio

    out = []
    for meta_path in sorted(floods_dir.glob("*/event.json")):
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        with rasterio.open(meta_path.parent / "flood.tif") as src:
            x, y = Transformer.from_crs("EPSG:4326", src.crs, always_xy=True).transform(lon, lat)
            row, col = src.index(x, y)
            if not (0 <= row < src.height and 0 <= col < src.width):
                continue
            r = int(FLOOD_NEAR_M / src.res[0])
            win = rasterio.windows.Window(col - r, row - r, 2 * r + 1, 2 * r + 1)
            near = src.read(1, window=win, boundless=True, fill_value=255)
        c = near.shape[0] // 2
        at_pin = near[c - PIN_PX: c + PIN_PX + 1, c - PIN_PX: c + PIN_PX + 1]
        yy, xx = np.ogrid[: near.shape[0], : near.shape[1]]
        disc = (yy - c) ** 2 + (xx - c) ** 2 <= r * r
        land = disc & (near != 255) & (near != 2)  # leave out no-data and the lake itself
        share = float((near[land] == 1).mean()) if land.any() else None
        out.append({
            "id": meta["id"],
            "name": meta["name"],
            "date": meta["date"],
            "flooded_at_pin": bool((at_pin == 1).any()),
            "pin_in_lake": bool((at_pin == 2).sum() * 2 > at_pin.size),
            "share_flooded_250m": None if share is None else round(share, 3),
        })
    return out


def _season_words(name: str) -> str:
    year, kind = name.split("-")
    return f"{'Jan–Apr' if kind == 'dry' else 'Nov–Dec'} {year}"


def analyse(lat: float, lon: float, years=YEARS, catalog: list[dict] | None = None, cache: Path | None = None,
            progress=None):
    """Water history at the pin. Returns (facts, arrays) where arrays feed the images.

    progress(step, line, done=None, total=None), if given, is told what is happening.
    """
    say = progress or (lambda *a, **k: None)
    gbox, pin = plot_grid(lat, lon)
    total = 2 * len(list(years))
    count = {"done": 0}

    def on_season(name, scenes):
        count["done"] += 1
        line = (f"{_season_words(name)}: {scenes} satellite photos" if scenes
                else f"{_season_words(name)}: no clear photos")
        say("read", line, count["done"], total)

    say("read", "Looking for satellite photos of this spot since 2019", 0, total)
    seasons = load_seasons(gbox, years, cache, on_season=on_season)
    say("water", "Finding where water has been, season by season")
    region = np.ones(gbox.shape, dtype=bool)

    history, dry_water = [], []
    for name, s in seasons.items():
        valid = s["looks"] >= THRESHOLDS.min_clear_looks
        thr = water_threshold(s["mndwi"], region & valid)
        water = (s["mndwi"] > thr) & valid
        s["water"] = water
        at_pin = water_at_pin(water, valid, pin)
        history.append({
            "season": name,
            "status": "ok" if at_pin is not None else "not_enough_data",
            "water_at_pin": at_pin,
            "clear_looks_at_pin": int(s["looks"][pin]),
            "scene_count": len(s["scene_ids"]),
        })
        if s["season"] == "dry" and valid.mean() > 0.5:
            dry_water.append(water)

    extent = drop_specks(np.logical_or.reduce(dry_water)) if dry_water else np.zeros(gbox.shape, bool)
    seen = sum(1 for h in history if h["season"].endswith("dry") and h["water_at_pin"])
    say("water", f"Water at the pin in {seen} of {sum(1 for h in history if h['season'].endswith('dry'))} dry seasons")
    near = nearest_extent(extent, pin)
    # Name the lake from the water patch the pin belongs to, not the pin itself:
    # a plot can sit nearer another lake's centre than its own lake's.
    ref_lat, ref_lon = lat, lon
    if near["patch"].any():
        rows, cols = np.nonzero(near["patch"])
        x, y = gbox.affine * (cols.mean() + 0.5, rows.mean() + 0.5)
        ref_lon, ref_lat = Transformer.from_crs(gbox.crs, "EPSG:4326", always_xy=True).transform(x, y)
    lake = nearest_catalog_lake(ref_lat, ref_lon, catalog if catalog is not None else load_catalog())
    lake_acres = (lake["ha"] / 0.404686) if lake and lake.get("ha") else (near["patch_acres"] or 0)
    rules = buffer_rules(lake["state"] if lake else None, lake_acres)
    d = near["distance_m"]
    for rule in rules:
        rule["inside"] = d is not None and 0 < d <= rule["width_m"]

    say("water", "Nearest lake edge: " + ("on the lake" if d == 0 else f"{d} m away" if d is not None else "none within 600 m")
        + (f" ({lake['name']})" if lake else ""))
    say("flood", "Checking radar flood maps")
    floods = flood_events_at(lat, lon)
    for f in floods:
        say("flood", f"{f['name']}: " + ("water here" if f["flooded_at_pin"] else "no water seen here"))
    if not floods:
        say("flood", "No flood map covers this area yet")
    dry_hits = [h for h in history if h["season"].endswith("dry") and h["water_at_pin"]]
    post_hits = [h for h in history if h["season"].endswith("post") and h["water_at_pin"]]
    facts = {
        "lat": round(lat, 6),
        "lon": round(lon, 6),
        "history": history,
        "dry_seasons_checked": sum(1 for h in history if h["season"].endswith("dry") and h["status"] == "ok"),
        "dry_seasons_with_water": [h["season"] for h in dry_hits],
        "post_seasons_with_water": [h["season"] for h in post_hits],
        "distance_to_extent_m": d,
        "in_lake_bed": d == 0,
        "extent_patch_acres": near["patch_acres"],
        "nearest_lake": None if not lake else {
            "id": lake["id"], "name": lake["name"], "state": lake["state"],
            "near": lake.get("near"), "area_ha": lake.get("ha"),
        },
        "buffer_rules": rules,
        "floods": floods,
        "window": {
            "half_size_m": HALF_WINDOW_M,
            "bounds": list(gbox.geographic_extent.boundingbox),  # left, bottom, right, top
        },
    }
    arrays = {"gbox": gbox, "pin": pin, "seasons": seasons, "extent": extent, "patch": near["patch"]}
    return facts, arrays


def write_images(out: Path, arrays: dict) -> dict:
    """True colour for the first and latest clear dry season, and a water-frequency overlay."""
    from PIL import Image

    from .export import write_truecolor

    seasons = arrays["seasons"]
    dry = [n for n, s in seasons.items() if s["season"] == "dry" and (s["looks"] >= THRESHOLDS.min_clear_looks).mean() > 0.5]
    images = {}
    if dry:
        for key, name in (("before", dry[0]), ("after", dry[-1])):
            write_truecolor(out, name, seasons[name]["composite"])
            images[key] = {"season": name, "path": f"truecolor/{name}.png"}

    # Share of dry seasons each pixel held water: pale to deep blue.
    stack = [seasons[n]["water"] for n in dry]
    if stack:
        freq = np.mean(stack, axis=0)
        rgba = np.zeros(freq.shape + (4,), dtype=np.uint8)
        rgba[..., 0], rgba[..., 1], rgba[..., 2] = 30, 110, 220
        rgba[..., 3] = np.where(arrays["extent"], (60 + 170 * freq).astype(np.uint8), 0)
        (out / "water").mkdir(parents=True, exist_ok=True)
        Image.fromarray(rgba, "RGBA").save(out / "water" / "frequency.png", optimize=True)
        images["water_frequency"] = {"path": "water/frequency.png", "seasons": len(stack)}
    return images


def main(argv=None) -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--lat", type=float, required=True)
    p.add_argument("--lon", type=float, required=True)
    p.add_argument("--out", type=Path, default=Path("../data/plot"))
    p.add_argument("--years", type=int, nargs="+", default=list(YEARS))
    args = p.parse_args(argv)

    facts, arrays = analyse(args.lat, args.lon, args.years)
    out = args.out / f"{args.lat:.4f}_{args.lon:.4f}"
    facts["images"] = write_images(out, arrays)
    (out / "facts.json").write_text(json.dumps(facts, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in facts.items() if k != "history"}, indent=2))


if __name__ == "__main__":
    main()
