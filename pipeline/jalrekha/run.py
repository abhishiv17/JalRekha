"""Run one lake end to end.

    python -m jalrekha.run --lake subedeharana-kere --out ../data/out
    python -m jalrekha.run --lake subedeharana-kere --years 2023 2024 2025   # quick test
    python -m jalrekha.run --lake subedeharana-kere --s3-bucket <bucket>
"""

import argparse
import datetime as dt
from pathlib import Path

import numpy as np
from shapely.ops import unary_union

from . import export, stac
from .buffer import bill_2025_buffer_m, buffer_rings
from .change import (
    BUFFER_LOSS,
    LAKEBED_LOSS,
    baseline_lake,
    baseline_natural,
    confidence,
    find_flags,
    persistence,
)
from .classify import BARE_BUILT, FLOATING_VEG, LAND_VEG, NODATA, WATER, classify, water_threshold
from .composites import season_status, seasonal_composite
from .config import (
    BASELINE_YEARS,
    CURRENT_LAW_BUFFER_M,
    M2_PER_ACRE,
    PIXEL_AREA_M2,
    THRESHOLDS,
    YEARS,
)
from .indices import mndwi, ndbi, ndvi
from .lakes import (
    DEFAULT_LAKES_FILE,
    analysis_grid,
    grow_footprint,
    load_lake,
    mask_to_geom,
    to_mask,
    to_wgs84,
)


def acres(mask) -> float:
    return round(float(np.count_nonzero(mask)) * PIXEL_AREA_M2 / M2_PER_ACRE, 2)


def _load_stack(gbox, year: int, season: str, cache: Path | None):
    """Scenes for one season as reflectance arrays, cached as .npz when `cache` is set."""
    path = cache / f"{year}-{season}.npz" if cache else None
    if path and path.exists():
        z = np.load(path, allow_pickle=False)
        if tuple(z["shape"]) == tuple(gbox.shape):
            stack = {k: z[k] for k in z.files if k not in ("shape", "scene_ids")}
            stack["scene_ids"] = [str(x) for x in z["scene_ids"]]
            return stack
    items = stac.search(gbox, year, season)
    if not items:
        return None
    stack = stac.load(items, gbox)
    if path:
        path.parent.mkdir(parents=True, exist_ok=True)
        arrays = {k: v for k, v in stack.items() if k != "scene_ids"}
        np.savez_compressed(path, shape=np.array(gbox.shape), scene_ids=np.array(stack["scene_ids"]), **arrays)
    return stack


def load_seasons(gbox, years, cache: Path | None = None, on_season=None) -> dict:
    """Composite and indices for every season with scenes; oldest first.

    on_season(name, scene_count), if given, is called after each season (for progress).
    """
    seasons = {}
    for year in years:
        for season in ("dry", "post"):
            name = f"{year}-{season}"
            stack = _load_stack(gbox, year, season, cache)
            if stack is None:
                print(f"{name}: no scenes")
                if on_season:
                    on_season(name, 0)
                continue
            composite, looks = seasonal_composite(stack)
            seasons[name] = {
                "year": year,
                "season": season,
                "composite": composite,
                "looks": looks,
                "scene_ids": stack["scene_ids"],
                "mndwi": mndwi(composite["green"], composite["swir16"]),
                "ndvi": ndvi(composite["nir"], composite["red"]),
                "ndbi": ndbi(composite["swir16"], composite["nir"]),
            }
            print(f"{name}: {len(stack['scene_ids'])} scenes")
            if on_season:
                on_season(name, len(stack["scene_ids"]))
    return seasons


def run(lake_id: str, lakes_file: Path, out_root: Path, years, cache_root: Path | None = None) -> Path:
    lake = load_lake(lake_id, lakes_file)
    gbox = analysis_grid(lake["outline"])
    region = to_mask(lake["outline"].buffer(THRESHOLDS.ring_m), gbox)
    outline_mask = to_mask(lake["outline"], gbox)
    seasons = load_seasons(gbox, years, cache_root / lake_id if cache_root else None)
    dry_names = [n for n, s in seasons.items() if s["season"] == "dry"]
    base_names = [n for n in dry_names if seasons[n]["year"] in BASELINE_YEARS]
    if not base_names or len(dry_names) <= len(base_names):
        raise SystemExit("need baseline dry seasons and at least one later dry season")

    # Reference footprint: mapped outline + water present in every baseline dry
    # season and connected to the lake, so an outline drawn on an already-shrunk
    # lake can't hide losses, but roofs and roads never join the lake.
    for s in seasons.values():
        s["water_thr"] = water_threshold(s["mndwi"], region)
    steady_water = np.logical_and.reduce(
        [seasons[n]["mndwi"] > seasons[n]["water_thr"] for n in base_names]
    )
    footprint_mask = grow_footprint(outline_mask, steady_water)
    footprint = unary_union([lake["outline"], mask_to_geom(footprint_mask, gbox)])
    reference_ac = round(footprint.area / M2_PER_ACRE, 2)
    rings = buffer_rings(footprint, reference_ac)
    ring_masks = {w: to_mask(r, gbox) & ~footprint_mask for w, r in rings.items()}

    for s in seasons.values():
        s["classes"] = classify(
            s["mndwi"], s["ndvi"], s["ndbi"], s["composite"]["swir16"], footprint_mask, s["water_thr"]
        )
        s["status"] = season_status(s["looks"], footprint_mask)

    # Change is counted only after the baseline, on dry seasons.
    base = np.stack([seasons[n]["classes"] for n in base_names])
    after = [n for n in dry_names if n not in base_names]
    dry = np.stack([seasons[n]["classes"] for n in after])
    dry_years = [seasons[n]["year"] for n in after]
    post = {
        s["year"]: s["classes"]
        for s in seasons.values()
        if s["season"] == "post" and s["year"] >= dry_years[0] and s["status"] == "ok"
    }

    was_lake = baseline_lake(base) & footprint_mask
    was_natural = baseline_natural(base)
    buffer_zone = ring_masks.get(CURRENT_LAW_BUFFER_M, np.zeros(gbox.shape, dtype=bool))

    # Lake bed is lost when it turns to land: bare, built, or grassed over. Grass
    # counts only if the pixel's SWIR also rose clearly above its own baseline,
    # so dense marsh drifting across the floating/land line doesn't count.
    # Buffer: only natural ground that turned bare or built.
    base_swir = np.nanmedian(np.stack([seasons[n]["composite"]["swir16"] for n in base_names]), axis=0)
    bed_dry = dry.copy()
    for i, n in enumerate(after):
        rise = seasons[n]["composite"]["swir16"] - base_swir
        steady = (bed_dry[i] == LAND_VEG) & ~(rise >= THRESHOLDS.land_veg_swir_rise)
        bed_dry[i][steady] = FLOATING_VEG
    in_buffer = buffer_zone & was_natural & ~was_lake
    rl_bed, rs_bed = persistence(bed_dry, LAKEBED_LOSS)
    rl_buf, rs_buf = persistence(dry, BUFFER_LOSS)
    run_len = np.where(was_lake, rl_bed, np.where(in_buffer, rl_buf, 0))
    run_start = np.where(was_lake, rs_bed, np.where(in_buffer, rs_buf, -1))
    conf = np.where(
        was_lake,
        confidence(rl_bed, rs_bed, dry_years, post, LAKEBED_LOSS),
        confidence(rl_buf, rs_buf, dry_years, post, BUFFER_LOSS),
    )
    lost = (run_len >= 1) & (was_lake | in_buffer)
    labels, flags = find_flags(lost, run_len, run_start, conf, footprint_mask, after, bed_dry[-1])
    latest = dry_names[-1]
    for f in flags:
        f["scene_ids"] = sorted(set(seasons[f["first_seen"]]["scene_ids"] + seasons[latest]["scene_ids"]))

    out = out_root / "lakes" / lake_id
    for name, s in seasons.items():
        export.write_overlay(out, name, s["classes"])
        export.write_truecolor(out, name, s["composite"])
        export.write_water(out, name, s["classes"], gbox)
    export.write_flags(out, lake_id, labels, flags, gbox)
    export.write_reference(out, footprint, rings)
    export.write_bounds(out, gbox)

    flagged = labels > 0
    widths = sorted(ring_masks)
    stats = {
        "id": lake_id,
        "name": lake["name"],
        "reference_area_ac": reference_ac,
        "thresholds": {
            "mndwi": THRESHOLDS.mndwi,
            "veg_ndvi": THRESHOLDS.veg_ndvi,
            "bare_ndvi": THRESHOLDS.bare_ndvi,
            "ndbi": THRESHOLDS.ndbi,
            "min_flag_px": THRESHOLDS.min_flag_px,
        },
        "seasons": [
            {
                "season": name,
                "clear_looks": int(np.median(s["looks"][footprint_mask])) if footprint_mask.any() else 0,
                "status": s["status"],
                "water_thr": round(s["water_thr"], 3),
                "water_ac": acres(footprint_mask & (s["classes"] == WATER)) if s["status"] == "ok" else None,
                "floating_veg_ac": acres(footprint_mask & (s["classes"] == FLOATING_VEG)) if s["status"] == "ok" else None,
                "bare_built_ac": acres(footprint_mask & (s["classes"] == BARE_BUILT)) if s["status"] == "ok" else None,
                "land_veg_ac": acres(footprint_mask & (s["classes"] == LAND_VEG)) if s["status"] == "ok" else None,
                "nodata_share": round(float((s["classes"][footprint_mask] == NODATA).mean()), 3),
                "scene_ids": s["scene_ids"],
            }
            for name, s in seasons.items()
        ],
        "flags_total_ac": acres(flagged),
        "buffer": {
            "current_law_m": CURRENT_LAW_BUFFER_M,
            "bill_2025_m": bill_2025_buffer_m(reference_ac),
            "change_in_buffer_ac": {str(w): acres(flagged & ring_masks[w]) for w in widths},
        },
        "as_of": dt.date.today().isoformat(),
    }
    export.write_stats(out, stats)

    c = to_wgs84(lake["outline"].centroid)
    export.update_index(
        out_root,
        {
            "id": lake_id,
            "name": lake["name"],
            "area_ac": reference_ac,
            "flagged_ac": stats["flags_total_ac"],
            "flagged_share": round(stats["flags_total_ac"] / reference_ac, 3) if reference_ac else 0,
            "latest_first_seen": max((f["first_seen"] for f in flags), default=None),
            "centroid": [round(c.x, 5), round(c.y, 5)],
        },
        dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
    )
    print(f"{lake_id}: {len(flags)} flags, {stats['flags_total_ac']} ac -> {out}")
    return out


def main(argv=None) -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--lake", required=True, help="lake id from data/lakes/lakes.geojson")
    p.add_argument("--lakes-file", type=Path, default=DEFAULT_LAKES_FILE)
    p.add_argument("--out", type=Path, default=Path("../data/out"))
    p.add_argument("--years", type=int, nargs="+", default=list(YEARS))
    p.add_argument("--cache", type=Path, default=Path("../data/cache"), help="scene cache; '' to disable")
    p.add_argument("--s3-bucket", help="also upload results to this bucket")
    args = p.parse_args(argv)

    run(args.lake, args.lakes_file, args.out, args.years, args.cache if str(args.cache) else None)
    if args.s3_bucket:
        n = export.upload_dir(args.out, args.s3_bucket)
        print(f"uploaded {n} files to s3://{args.s3_bucket}/")


if __name__ == "__main__":
    main()
