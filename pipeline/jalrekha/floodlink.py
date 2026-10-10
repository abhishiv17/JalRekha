"""Why did it flood here? Each tracked lake against the radar flood maps we have (flood.py).

For every lake inside a mapped flood, measure how much ground flooded within 1 km of the lake and
within 250 m of the lake bed that turned to land, and compare with the flooded share of the whole
mapped city. A lake that lost ground and has floods pressing in around it is where filling in a
lake shows up as water in homes. Overlap is not proof of cause: drains, slopes and rainfall matter too.

    python -m jalrekha.floodlink --api <data API URL> --floods ../data/floods --out ../web/public/insights
"""

import argparse
import json
from pathlib import Path
from urllib.request import urlopen

import numpy as np
import rasterio
from PIL import Image
from pyproj import Transformer
from rasterio.features import rasterize
from rasterio.windows import from_bounds
from shapely.geometry import mapping, shape
from shapely.ops import transform as reproject, unary_union

from .flood import FLOOD, LAKE, NODATA

NEAR_LAKE_M = 1000
NEAR_LOST_M = 250
HA = 10_000


def get_json(url: str):
    with urlopen(url, timeout=60) as r:
        return json.load(r)


def lake_geoms(api: str, lake: str):
    ref = get_json(f"{api}/lakes/{lake}/reference.geojson")
    flags = get_json(f"{api}/lakes/{lake}/flags.geojson")
    footprint = unary_union([shape(f["geometry"]) for f in ref["features"] if f["properties"].get("kind") == "reference"])
    lost = [shape(f["geometry"]) for f in flags["features"]]
    return footprint, unary_union(lost) if lost else None


def city_share(classes: np.ndarray) -> float:
    valid = classes != NODATA
    land = valid & (classes != LAKE)
    return float(np.sum(classes == FLOOD)) / max(int(np.sum(land)), 1)


def run_lake(api: str, lake: str, event_dir: Path, event: dict, out: Path) -> dict | None:
    footprint, lost = lake_geoms(api, lake)
    c = footprint.centroid
    w, s, e, n = event["bounds"]
    if not (w <= c.x <= e and s <= c.y <= n):
        return None
    with rasterio.open(event_dir / "flood.tif") as src:
        fwd = Transformer.from_crs("EPSG:4326", src.crs, always_xy=True).transform
        back = Transformer.from_crs(src.crs, "EPSG:4326", always_xy=True).transform
        fp = reproject(fwd, footprint)
        lost_m = reproject(fwd, lost) if lost is not None else None
        area = fp.buffer(NEAR_LAKE_M + 200)
        win = from_bounds(*area.bounds, transform=src.transform).round_offsets().round_lengths()
        classes = src.read(1, window=win, boundless=True, fill_value=NODATA)
        transform = src.window_transform(win)
        px_m2 = abs(src.transform.a * src.transform.e)
        whole = src.read(1)

    def mask(geom):
        return rasterize([mapping(geom)], out_shape=classes.shape, transform=transform, fill=0, default_value=1).astype(bool)

    ring = mask(fp.buffer(NEAR_LAKE_M).difference(fp.buffer(30)))
    land = ring & (classes != NODATA) & (classes != LAKE)
    flooded = land & (classes == FLOOD)
    share = float(flooded.sum()) / max(int(land.sum()), 1)
    city = city_share(whole)
    near_lost = None
    if lost_m is not None and not lost_m.is_empty:
        z = mask(lost_m.buffer(NEAR_LOST_M)) & (classes == FLOOD)
        near_lost = round(float(z.sum()) * px_m2 / HA, 1)

    # A small picture: flooded ground in blue around the lake.
    rgba = np.zeros(classes.shape + (4,), dtype="uint8")
    rgba[classes == FLOOD] = (30, 120, 220, 230)
    rgba[classes == LAKE] = (22, 63, 44, 120)
    rgba[(classes == NONE_CLASS)] = (0, 0, 0, 0)
    out.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(out / f"{lake}-flood.png", optimize=True)
    x0, y0 = transform * (0, classes.shape[0])
    x1, y1 = transform * (classes.shape[1], 0)
    (lon0, lat0), (lon1, lat1) = back(x0, y0), back(x1, y1)

    return {
        "event": event["id"],
        "name": event["name"],
        "date": event["date"],
        "flooded_ha_near": round(float(flooded.sum()) * px_m2 / HA, 1),
        "near_m": NEAR_LAKE_M,
        "share_near": round(share, 4),
        "share_city": round(city, 4),
        "times_city": round(share / city, 1) if city > 0 else None,
        "flooded_ha_near_lost": near_lost,
        "near_lost_m": NEAR_LOST_M,
        "image": f"/insights/{lake}-flood.png",
        "bounds": [round(lon0, 6), round(lat0, 6), round(lon1, 6), round(lat1, 6)],
    }


NONE_CLASS = 0


def main(argv=None) -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--api", required=True)
    p.add_argument("--floods", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    a = p.parse_args(argv)
    api = a.api.rstrip("/")
    events = [(d, json.loads((d / "event.json").read_text("utf-8"))) for d in sorted(a.floods.iterdir()) if (d / "flood.tif").exists()]
    result = {}
    for lake in [l["id"] for l in get_json(f"{api}/index.json")["lakes"]]:
        for d, ev in events:
            try:
                r = run_lake(api, lake, d, ev, a.out)
            except Exception as e:
                print(f"{lake} x {ev['id']}: failed: {e!r}"[:300])
                continue
            if r:
                result[lake] = r
                print(f"{lake}: {ev['id']} flooded {r['flooded_ha_near']} ha within 1 km "
                      f"({r['share_near']:.1%} vs city {r['share_city']:.1%}), near lost bed {r['flooded_ha_near_lost']} ha")
                break
    path = a.out / "floods.json"
    path.write_text(json.dumps(result, indent=1, ensure_ascii=False) + "\n", "utf-8")
    print(f"{len(result)} lakes in {path}")


if __name__ == "__main__":
    main()
