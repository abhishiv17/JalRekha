"""Lakes keep you cool: summer daytime ground temperature around each lake, from Landsat 8 and 9.

Landsat Collection 2 Level-2 surface temperature (thermal band 10, 100 m, delivered on a 30 m grid)
from the Registry of Open Data on AWS (s3://usgs-landsat, requester pays), found through Earth
Search. For each lake we take every clear April-May pass of 2023-2025 (the hottest weeks before the
monsoon, about 10:30 in the morning), keep the median per pixel, and compare:

- the ground 100-300 m from the water with the ground 600-1,000 m away (how much cooler it is
  near the lake), and
- the lake bed that turned to land with the water that is still there (how much hotter filled
  ground gets). Small patches share a thermal pixel with the water, so this understates it.

This is ground (skin) temperature, not air temperature, and buildings and trees differ between
rings too: a lake is one reason it is cooler near the water, not the only one.

    python -m jalrekha.heat --api <data API URL> --out ../web/public/insights [--lake <id> ...]
"""

import argparse
import json
import math
from pathlib import Path
from urllib.request import urlopen

import numpy as np
import odc.stac
from odc.geo.geobox import GeoBox
from PIL import Image
from pystac_client import Client
from pyproj import Transformer
from rasterio.features import rasterize
from shapely.geometry import mapping, shape
from shapely.ops import transform as reproject, unary_union

STAC_URL = "https://earth-search.aws.element84.com/v1"
COLLECTION = "landsat-c2-l2"
YEARS = (2023, 2024, 2025)
MONTHS = ("04-01", "05-31")
MAX_CLOUD = 40
MIN_CLEAR = 3  # clear passes a pixel needs before we trust its median
RES_M = 30
MARGIN_M = 1300
NEAR, FAR = (100, 300), (600, 1000)  # metres from the water's edge
ACRE_M2 = 4046.86
MIN_FILLED_AC = 2.0  # below this a filled patch is mostly one mixed thermal pixel
SCALE, OFFSET = 0.00341802, 149.0  # Collection 2 ST_B10 -> kelvin
# QA_PIXEL bits that make a pixel unusable: fill, dilated cloud, cirrus, cloud, cloud shadow.
BAD_BITS = (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4)


def get_json(url: str):
    with urlopen(url, timeout=60) as r:
        return json.load(r)


def utm_crs(lon: float, lat: float) -> str:
    zone = int((lon + 180) // 6) + 1
    return f"EPSG:{(32600 if lat >= 0 else 32700) + zone}"


def lake_geoms(api: str, lake: str):
    ref = get_json(f"{api}/lakes/{lake}/reference.geojson")
    flags = get_json(f"{api}/lakes/{lake}/flags.geojson")
    footprint = unary_union([shape(f["geometry"]) for f in ref["features"] if f["properties"].get("kind") == "reference"])
    lost = [shape(f["geometry"]) for f in flags["features"]]
    return footprint, unary_union(lost) if lost else None


def scenes(bbox):
    items = []
    for y in YEARS:
        items += Client.open(STAC_URL).search(
            collections=[COLLECTION], bbox=bbox, datetime=f"{y}-{MONTHS[0]}/{y}-{MONTHS[1]}",
            query={"eo:cloud_cover": {"lt": MAX_CLOUD}, "platform": {"in": ["landsat-8", "landsat-9"]}},
        ).item_collection()
    return list(items)


def surface_temperature(items, gbox: GeoBox) -> tuple[np.ndarray, int]:
    """Median clear-sky ground temperature (deg C) per pixel, and how many passes were read."""
    odc.stac.configure_rio(cloud_defaults=True, aws={"requester_pays": True, "region_name": "us-west-2"})
    ds = odc.stac.load(items, bands=["lwir11", "qa_pixel"], geobox=gbox, groupby="solar_day",
                       resampling={"lwir11": "bilinear", "qa_pixel": "nearest"}, chunks={})
    dn = ds["lwir11"].values.astype("float32")
    qa = ds["qa_pixel"].values.astype("uint16")
    clear = (dn > 0) & ((qa & BAD_BITS) == 0)
    celsius = np.where(clear, dn * SCALE + OFFSET - 273.15, np.nan)
    enough = np.sum(np.isfinite(celsius), axis=0) >= MIN_CLEAR
    with np.errstate(all="ignore"):
        med = np.nanmedian(celsius, axis=0)
    return np.where(enough, med, np.nan), int(dn.shape[0])


def mean_in(lst: np.ndarray, geom, gbox: GeoBox) -> float | None:
    if geom is None or geom.is_empty:
        return None
    mask = rasterize([mapping(geom)], out_shape=gbox.shape, transform=gbox.affine, fill=0, default_value=1).astype(bool)
    vals = lst[mask & np.isfinite(lst)]
    return round(float(vals.mean()), 1) if vals.size >= 4 else None


# Cool blue (water) -> pale -> warm orange -> hot red, like a weather map.
STOPS = [(0.0, (49, 104, 176)), (0.35, (143, 196, 214)), (0.55, (248, 238, 196)), (0.78, (245, 160, 72)), (1.0, (196, 48, 38))]


def colour(lst: np.ndarray, lo: float, hi: float) -> np.ndarray:
    t = np.clip((lst - lo) / max(hi - lo, 0.1), 0, 1)
    rgba = np.zeros(lst.shape + (4,), dtype="uint8")
    for (t0, c0), (t1, c1) in zip(STOPS, STOPS[1:]):
        m = (t >= t0) & (t <= t1)
        f = ((t - t0) / (t1 - t0))[m]
        for k in range(3):
            rgba[..., k][m] = (c0[k] + f * (c1[k] - c0[k])).astype("uint8")
    rgba[..., 3] = np.where(np.isfinite(lst), 255, 0)
    return rgba


def run(api: str, lake: str, out: Path) -> dict | None:
    footprint, lost = lake_geoms(api, lake)
    c = footprint.centroid
    crs = utm_crs(c.x, c.y)
    fwd = Transformer.from_crs("EPSG:4326", crs, always_xy=True).transform
    back = Transformer.from_crs(crs, "EPSG:4326", always_xy=True).transform
    fp = reproject(fwd, footprint)
    lost_m = reproject(fwd, lost) if lost is not None else None
    water = fp.difference(lost_m) if lost_m is not None else fp

    minx, miny, maxx, maxy = fp.buffer(MARGIN_M).bounds
    gbox = GeoBox.from_bbox((minx, miny, maxx, maxy), crs=crs, resolution=RES_M)
    w, s, e, n = reproject(back, fp.buffer(MARGIN_M)).bounds
    items = scenes((w, s, e, n))
    if not items:
        print(f"{lake}: no Landsat passes")
        return None
    lst, passes = surface_temperature(items, gbox)

    ring = lambda a, b: fp.buffer(b).difference(fp.buffer(a))  # noqa: E731
    near, far = mean_in(lst, ring(*NEAR), gbox), mean_in(lst, ring(*FAR), gbox)
    water_c = mean_in(lst, water.buffer(-45), gbox)  # inside the shore, away from mixed edge pixels
    filled_ac = round(lost_m.area / ACRE_M2, 2) if lost_m is not None else 0.0
    filled_c = mean_in(lst, lost_m, gbox) if filled_ac >= MIN_FILLED_AC else None

    finite = lst[np.isfinite(lst)]
    lo, hi = (float(np.percentile(finite, 2)), float(np.percentile(finite, 98))) if finite.size else (25.0, 45.0)
    out.mkdir(parents=True, exist_ok=True)
    Image.fromarray(colour(lst, lo, hi), "RGBA").save(out / f"{lake}-heat.png", optimize=True)

    # The image's corners in longitude/latitude, so outlines can be drawn on it.
    x0, y1 = gbox.affine * (0, 0)
    x1, y0 = gbox.affine * (gbox.shape[1], gbox.shape[0])
    (lon0, lat0), (lon1, lat1) = back(x0, y0), back(x1, y1)

    result = {
        "id": lake,
        "source": "Landsat 8 and 9 Collection 2 surface temperature, Registry of Open Data on AWS",
        "period": f"April-May {YEARS[0]}-{YEARS[-1]}, about 10:30 local time",
        "passes": passes,
        "water_c": water_c,
        "near_c": near,
        "far_c": far,
        "near_m": list(NEAR),
        "far_m": list(FAR),
        "cooler_near_c": round(far - near, 1) if near is not None and far is not None else None,
        "filled_ac": filled_ac,
        "filled_c": filled_c,
        "filled_hotter_c": round(filled_c - water_c, 1) if filled_c is not None and water_c is not None else None,
        "scale_c": [round(lo, 1), round(hi, 1)],
        "image": f"/insights/{lake}-heat.png",
        "bounds": [round(lon0, 6), round(lat0, 6), round(lon1, 6), round(lat1, 6)],
    }
    print(f"{lake}: {passes} passes, near {near}, far {far}, cooler {result['cooler_near_c']}, "
          f"water {water_c}, filled {filled_c} ({filled_ac} ac)")
    return result


def main(argv=None) -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--api", required=True, help="data API that serves index.json and lakes/<id>/…")
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--lake", action="append", help="only these lakes (default: every tracked lake)")
    a = p.parse_args(argv)
    api = a.api.rstrip("/")
    lakes = a.lake or [l["id"] for l in get_json(f"{api}/index.json")["lakes"]]
    path = a.out / "heat.json"
    done = json.loads(path.read_text("utf-8")) if path.exists() else {}
    for lake in lakes:
        try:
            r = run(api, lake, a.out)
        except Exception as e:  # one lake failing must not stop the rest
            print(f"{lake}: failed: {e!r}"[:300])
            continue
        if r:
            done[lake] = r
            path.write_text(json.dumps(done, indent=1, ensure_ascii=False) + "\n", "utf-8")
    print(f"{len(done)} lakes in {path}")


if __name__ == "__main__":
    main()
