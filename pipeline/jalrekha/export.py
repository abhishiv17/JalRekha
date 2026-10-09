"""Write one lake's results in the shape of contracts/README.md."""

import json
from pathlib import Path

import numpy as np
from PIL import Image
from shapely.geometry import mapping

from .classify import BARE_BUILT, FLOATING_VEG, WATER
from .lakes import mask_to_geom, to_wgs84

OVERLAY_RGBA = {
    WATER: (30, 120, 220, 160),
    FLOATING_VEG: (60, 170, 90, 160),
    BARE_BUILT: (220, 80, 50, 200),
}


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _polygons(mask: np.ndarray, gbox):
    """Union of the True pixels as one WGS84 geometry (or None)."""
    geom = mask_to_geom(mask, gbox)
    return None if geom.is_empty else to_wgs84(geom)


def feature_collection(features: list) -> dict:
    return {"type": "FeatureCollection", "features": features}


def write_flags(out: Path, lake_id: str, labels, flags, gbox) -> None:
    features = []
    for f in flags:
        geom = _polygons(labels == f["label"], gbox)
        props = {"flag_id": f"{lake_id}-{f['label']}"}
        props.update({k: v for k, v in f.items() if k != "label"})
        features.append({"type": "Feature", "properties": props, "geometry": mapping(geom)})
    _write_json(out / "flags.geojson", feature_collection(features))


def write_water(out: Path, season: str, classes, gbox) -> None:
    geom = _polygons(classes == WATER, gbox)
    features = [] if geom is None else [
        {"type": "Feature", "properties": {"season": season}, "geometry": mapping(geom)}
    ]
    _write_json(out / "water" / f"{season}.geojson", feature_collection(features))


def write_reference(out: Path, footprint_utm, rings_utm: dict) -> None:
    features = [{"type": "Feature", "properties": {"kind": "reference"},
                 "geometry": mapping(to_wgs84(footprint_utm))}]
    for width, ring in rings_utm.items():
        features.append({"type": "Feature", "properties": {"kind": "buffer", "width_m": width},
                         "geometry": mapping(to_wgs84(ring))})
    _write_json(out / "reference.geojson", feature_collection(features))


def write_overlay(out: Path, season: str, classes) -> None:
    rgba = np.zeros((*classes.shape, 4), dtype="uint8")
    for value, colour in OVERLAY_RGBA.items():
        rgba[classes == value] = colour
    path = out / "overlay" / f"{season}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(path)


def write_truecolor(out: Path, season: str, composite: dict, max_refl: float = 0.3) -> None:
    rgb = np.dstack([composite["red"], composite["green"], composite["blue"]])
    rgb = np.nan_to_num(np.clip(rgb / max_refl, 0, 1) * 255).astype("uint8")
    path = out / "truecolor" / f"{season}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgb, "RGB").save(path)


def write_bounds(out: Path, gbox) -> None:
    b = gbox.geographic_extent.boundingbox
    _write_json(out / "bounds.json", {"bounds": [b.left, b.bottom, b.right, b.top]})


def write_stats(out: Path, stats: dict) -> None:
    _write_json(out / "stats.json", stats)


def update_index(root: Path, entry: dict, generated: str) -> None:
    """Add or replace this lake in index.json, ranked by flagged area then recency."""
    path = root / "index.json"
    index = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"lakes": []}
    lakes = [l for l in index["lakes"] if l["id"] != entry["id"]] + [entry]
    lakes.sort(key=lambda l: l["latest_first_seen"] or "", reverse=True)  # stable: tie-break
    lakes.sort(key=lambda l: l["flagged_ac"], reverse=True)
    _write_json(path, {"generated": generated, "lakes": lakes})


def upload_dir(local: Path, bucket: str, prefix: str = "") -> int:
    """Copy a results folder to S3; returns the number of files."""
    import boto3

    s3 = boto3.client("s3")
    types = {".json": "application/json", ".geojson": "application/geo+json", ".png": "image/png"}
    count = 0
    for path in local.rglob("*"):
        if path.is_file():
            key = f"{prefix}{path.relative_to(local).as_posix()}"
            extra = {"ContentType": types.get(path.suffix, "application/octet-stream")}
            s3.upload_file(str(path), bucket, key, ExtraArgs=extra)
            count += 1
    return count
