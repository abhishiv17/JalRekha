"""Photos for a lake's step-by-step story, made the same way for every lake.

Every lake gets the same kind of frame as the home page's Bhalswa story: a square at
least MIN_SIDE_M across, centred on the lake (so a small pond is shown with its
surroundings at the same zoom as a big lake), from the first and latest clear dry
seasons, enlarged smoothly to SIZE pixels and sharpened. Written next to the lake's
results as story/<year>.jpg and story/meta.json (the square's bounds, for drawing).

    python -m jalrekha.story --bucket <bucket> bellandur bhalswa ...
"""

import argparse
import json
import math
import tempfile
import warnings
from pathlib import Path

import numpy as np
from odc.geo.geobox import GeoBox
from PIL import Image, ImageFilter
from pyproj import Transformer

from . import stac
from .masks import clear_mask, shadow_mask
from .plot import utm_crs

MIN_SIDE_M = 700
MARGIN = 1.3  # the square is at least this many times the lake's longest side
SIZE = 720
MAX_REFL = 0.3  # same stretch as the lake pipeline's true-colour images


def square(bounds: list[float]) -> GeoBox:
    """A square UTM grid around the lake's bounds (west, south, east, north)."""
    w, s, e, n = bounds
    crs = utm_crs((w + e) / 2, (s + n) / 2)
    to = Transformer.from_crs("EPSG:4326", crs, always_xy=True).transform
    xs, ys = zip(*(to(x, y) for x in (w, e) for y in (s, n)))
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    half = max(MIN_SIDE_M, MARGIN * max(max(xs) - min(xs), max(ys) - min(ys))) / 2
    half = math.ceil(half / 10) * 10
    return GeoBox.from_bbox((cx - half, cy - half, cx + half, cy + half), crs=crs, resolution=10)


def photo(gbox: GeoBox, year: int) -> Image.Image | None:
    """Median of the clear January-April passes, enlarged and sharpened."""
    items = stac.search(gbox, year, "dry")
    if not items:
        return None
    stack = stac.load(items, gbox)
    valid = clear_mask(stack["scl"]) & ~shadow_mask(stack["blue"], stack["green"], stack["red"], stack["nir"], stack["swir16"])
    bands = []
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        for b in ("red", "green", "blue"):
            clear = np.nanmedian(np.where(valid, stack[b], np.nan), axis=0)
            anyway = np.nanmedian(stack[b], axis=0)  # where no pass was clear, use them all
            bands.append(np.where(np.isfinite(clear), clear, anyway))
    rgb = np.nan_to_num(np.clip(np.dstack(bands) / MAX_REFL, 0, 1) * 255).astype("uint8")
    img = Image.fromarray(rgb, "RGB").resize((SIZE, SIZE), Image.BICUBIC)
    return img.filter(ImageFilter.UnsharpMask(radius=2, percent=50, threshold=2))


def make_story(bounds: list[float], years: tuple[int, int], out: Path) -> dict:
    gbox = square(bounds)
    out.mkdir(parents=True, exist_ok=True)
    made = []
    for y in years:
        img = photo(gbox, y)
        if img is not None:
            img.save(out / f"{y}.jpg", quality=84, optimize=True)
            made.append(y)
    b = gbox.geographic_extent.boundingbox
    meta = {"bounds": [b.left, b.bottom, b.right, b.top], "size": SIZE, "years": made}
    (out / "meta.json").write_text(json.dumps(meta), encoding="utf-8")
    return meta


def story_for(lake_id: str, stats: dict, bounds: list[float], out: Path) -> dict:
    """Story photos for a lake from its results (first and latest clear dry seasons)."""
    dry = [s["season"] for s in stats["seasons"] if s["season"].endswith("-dry") and s["status"] == "ok"]
    if not dry:
        raise ValueError(f"{lake_id}: no clear dry season")
    return make_story(bounds, (int(dry[0][:4]), int(dry[-1][:4])), out)


def main() -> None:
    import boto3

    from . import export

    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("lakes", nargs="+")
    p.add_argument("--bucket", required=True)
    args = p.parse_args()
    s3 = boto3.client("s3")
    for lake in args.lakes:
        try:
            get = lambda k: json.loads(s3.get_object(Bucket=args.bucket, Key=f"lakes/{lake}/{k}")["Body"].read())  # noqa: E731
            out = Path(tempfile.mkdtemp()) / "story"
            meta = story_for(lake, get("stats.json"), get("bounds.json")["bounds"], out)
            export.upload_dir(out, args.bucket, f"lakes/{lake}/story/")
            print(f"OK   {lake}: {meta['years']}", flush=True)
        except Exception as e:  # one lake failing shouldn't stop the rest
            print(f"FAIL {lake}: {e!r}", flush=True)


if __name__ == "__main__":
    main()
