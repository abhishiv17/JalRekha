"""Is there water in this pond now? A fresh look from space, for one pond.

Used to prove a revival (or catch a claim that isn't true): every clear Sentinel-2
pass of the last DAYS days over the pond, and for each the share of the pond that
looks like water (MNDWI above STILL_MNDWI, the same gentle test as the pond scan).
The answer rests on the clear passes only; a photo of the latest one is saved.

    python -m jalrekha.pondcheck --geojson ../data/ponds/delhi/ponds.geojson --id delhi-822
"""

import argparse
import datetime as dt
import io
import json
import math
import warnings
from pathlib import Path

import numpy as np
from odc.geo.geobox import GeoBox
from PIL import Image
from pystac_client import Client
from pyproj import Transformer
from rasterio.features import geometry_mask
from shapely.geometry import shape
from shapely.ops import transform as reproject_geom

from . import stac
from .config import COLLECTION, STAC_URL
from .indices import mndwi
from .masks import clear_mask
from .plot import utm_crs

DAYS = 75
STILL_MNDWI = 0.0
MIN_CLEAR = 0.8  # share of the pond a pass must see clearly to count
WET = 0.5  # water over at least half the pond in the latest clear passes = water is back
SOME = 0.15
MARGIN_M = 150
MAX_CLOUD = 70


def grid_for(geom_ll) -> tuple[GeoBox, object]:
    c = geom_ll.centroid
    crs = utm_crs(c.x, c.y)
    to = Transformer.from_crs("EPSG:4326", crs, always_xy=True).transform
    g = reproject_geom(to, geom_ll)
    w, s, e, n = g.bounds
    half = max(e - w, n - s) / 2 + MARGIN_M
    cx, cy = (w + e) / 2, (s + n) / 2
    half = math.ceil(half / 10) * 10
    return GeoBox.from_bbox((cx - half, cy - half, cx + half, cy + half), crs=crs, resolution=10), g


def check(geom_ll, days: int = DAYS, today: dt.date | None = None) -> tuple[dict, bytes | None]:
    """The pond's water in recent clear passes, and a JPEG of the latest clear one."""
    today = today or dt.date.today()
    gbox, g = grid_for(geom_ll)
    bbox = gbox.geographic_extent.boundingbox
    items = Client.open(STAC_URL).search(
        collections=[COLLECTION], bbox=(bbox.left, bbox.bottom, bbox.right, bbox.top),
        datetime=f"{today - dt.timedelta(days=days)}/{today}", query={"eo:cloud_cover": {"lt": MAX_CLOUD}},
    ).item_collection()
    result = {"checked": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
              "window": [str(today - dt.timedelta(days=days)), str(today)], "passes": []}
    if not items:
        result["verdict"] = "no_clear_look"
        return result, None
    items = sorted(items, key=lambda it: it.datetime)
    stack = stac.load(items, gbox)
    inside = ~geometry_mask([g.__geo_interface__], out_shape=gbox.shape, transform=gbox.affine)
    clear = clear_mask(stack["scl"])
    days_seen = sorted({it.datetime.date() for it in items})
    latest_rgb = None
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        m = mndwi(stack["green"], stack["swir16"])
    for t in range(m.shape[0]):
        ok = clear[t] & np.isfinite(m[t]) & inside
        seen = float(ok.sum() / max(inside.sum(), 1))
        date = str(days_seen[t]) if t < len(days_seen) else None
        entry = {"date": date, "clear": round(seen, 2)}
        if seen >= MIN_CLEAR:
            entry["wet"] = round(float((m[t][ok] > STILL_MNDWI).mean()), 2)
            latest_rgb = t
        result["passes"].append(entry)
    looks = [p for p in result["passes"] if "wet" in p]
    if not looks:
        result["verdict"] = "no_clear_look"
        return result, None
    recent = looks[-3:]  # the latest clear passes decide; earlier ones are history
    wet = float(np.median([p["wet"] for p in recent]))
    result.update(wet_share=round(wet, 2), latest_clear=looks[-1]["date"], clear_passes=len(looks),
                  verdict="water" if wet >= WET else "some_water" if wet >= SOME else "dry")
    rgb = np.dstack([stack[b][latest_rgb] for b in ("red", "green", "blue")])
    rgb = np.nan_to_num(np.clip(rgb / 0.3, 0, 1) * 255).astype("uint8")
    buf = io.BytesIO()
    Image.fromarray(rgb, "RGB").resize((320, 320), Image.BICUBIC).save(buf, "JPEG", quality=85)
    return result, buf.getvalue()


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--geojson", type=Path, required=True)
    p.add_argument("--id", required=True)
    args = p.parse_args()
    feats = json.loads(args.geojson.read_text(encoding="utf-8"))["features"]
    f = next(f for f in feats if f["properties"]["id"] == args.id)
    result, jpg = check(shape(f["geometry"]))
    print(json.dumps(result, indent=2))
    if jpg:
        Path(f"{args.id}-now.jpg").write_bytes(jpg)


if __name__ == "__main__":
    main()
