"""Flood maps from Sentinel-1 radar, which sees through monsoon cloud.

Sentinel-1 GRD scenes come from the Registry of Open Data on AWS
(s3://sentinel-s1-l1c, eu-central-1, requester pays), found through Earth
Search. Only the city window is read from each cloud-optimized GeoTIFF.

Method (change detection, same orbit so the geometry matches):
1. Backscatter (VV, sigma0 in dB) on the flood morning, and the median of the
   same orbit's non-flood passes that monsoon as the reference.
2. Flooded = dark on the flood day (open water reflects the radar away),
   clearly darker than the reference, and not a lake that is always there
   (Sentinel-2 dry-season water from the same year).
3. GRD is placed on the ellipsoid without terrain, so on Bengaluru's plateau
   it sits offset by about a kilometre. The radar grid is shifted onto the
   Sentinel-2 lakes by phase correlation before comparing.

Limits: radar sees floods on open ground, parks, new layouts and lake
margins. Water between tall buildings returns a bright double bounce and is
missed, so "no flood seen" never means "flood-free". One pass catches the
water standing at that moment only.

    python -m jalrekha.flood --event blr-2022-09 --out ../data/floods
"""

import argparse
import datetime as dt
import json
import warnings
import xml.etree.ElementTree as ET
from pathlib import Path

import boto3
import numpy as np
import odc.stac
import rasterio
from odc.geo.geobox import GeoBox
from PIL import Image
from pyproj import Transformer
from pystac_client import Client
from rasterio.control import GroundControlPoint
from rasterio.enums import Resampling
from rasterio.features import rasterize
from rasterio.session import AWSSession
from rasterio.transform import from_gcps
from rasterio.warp import reproject
from rasterio.windows import Window
from scipy import ndimage
from shapely.geometry import shape
from shapely.ops import transform as reproject_geom
from skimage.registration import phase_cross_correlation

from .config import BOA_OFFSET, REFLECTANCE_SCALE, STAC_URL
from .indices import mndwi
from .lakes import DEFAULT_LAKES_FILE
from .masks import clear_mask

EVENTS = {
    "blr-2022-09": {
        "name": "Bengaluru floods, September 2022",
        "date": "2022-09-05",
        "flood_scene": "S1A_IW_GRDH_1SDV_20220905T004028_20220905T004053_044862_055BB0",
        "relative_orbit": 165,
        # Same-orbit passes that monsoon, away from the flood week.
        "reference_ranges": ["2022-07-01/2022-08-31", "2022-09-25/2022-10-31"],
        "dry_season": "2022-01-01/2022-04-30",
        "bbox": [77.50, 12.82, 77.82, 13.10],  # west, south, east, north
        "crs": "EPSG:32643",
    },
}

RES_M = 20  # GRD resolution is about 20 m; finer pixels would only add speckle
FLOOD_DB_MAX = -15.0  # VV darker than this on the flood day ...
DROP_DB = 3.0  # ... and at least this much darker than the reference
MIN_FLOOD_PX = 4  # 1,600 m2
MAX_SHIFT_PX = 150  # 3 km: larger "shifts" mean the correlation failed

NONE, FLOOD, LAKE, NODATA = 0, 1, 2, 255


def grid(event: dict) -> GeoBox:
    w, s, e, n = event["bbox"]
    to_utm = Transformer.from_crs("EPSG:4326", event["crs"], always_xy=True).transform
    xs, ys = zip(*(to_utm(x, y) for x in (w, e) for y in (s, n)))
    return GeoBox.from_bbox((min(xs), min(ys), max(xs), max(ys)), crs=event["crs"], resolution=RES_M)


def _s3(href: str) -> tuple[str, str]:
    bucket, _, key = href.removeprefix("s3://").partition("/")
    return bucket, key


def _calibration(item, rows: slice, cols: slice) -> float:
    """Median sigma0 calibration constant over the part of the swath we read."""
    bucket, key = _s3(item.assets["schema-calibration-vv"].href)
    body = boto3.client("s3", region_name="eu-central-1").get_object(
        Bucket=bucket, Key=key, RequestPayer="requester")["Body"].read()
    values = []
    for vec in ET.fromstring(body).iter("calibrationVector"):
        line = int(vec.findtext("line"))
        if not rows.start - 2000 <= line <= rows.stop + 2000:
            continue
        pixels = np.array(vec.findtext("pixel").split(), dtype=int)
        sigma = np.array(vec.findtext("sigmaNought").split(), dtype=float)
        values.extend(sigma[(pixels >= cols.start) & (pixels <= cols.stop)])
    if not values:
        raise RuntimeError(f"no calibration vectors over the window in {item.id}")
    return float(np.median(values))


def read_sigma0_db(item, gbox: GeoBox) -> np.ndarray:
    """VV backscatter in dB on the grid, NaN outside the swath."""
    href = item.assets["vv"].href
    with rasterio.Env(AWSSession(boto3.Session(), requester_pays=True),
                      AWS_REGION="eu-central-1", GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"):
        with rasterio.open(href) as src:
            gcps, gcp_crs = src.gcps
            # Approximate the source window from an affine fit, with a wide margin.
            approx = from_gcps(gcps)
            to_ll = Transformer.from_crs(gbox.crs, gcp_crs, always_xy=True).transform
            corners = [to_ll(x, y) for x in (gbox.extent.boundingbox.left, gbox.extent.boundingbox.right)
                       for y in (gbox.extent.boundingbox.bottom, gbox.extent.boundingbox.top)]
            rc = [rasterio.transform.rowcol(approx, lon, lat) for lon, lat in corners]
            r0, r1 = min(r for r, _ in rc) - 600, max(r for r, _ in rc) + 600
            c0, c1 = min(c for _, c in rc) - 600, max(c for _, c in rc) + 600
            r0, c0 = max(r0, 0), max(c0, 0)
            r1, c1 = min(r1, src.height), min(c1, src.width)
            if r1 <= r0 or c1 <= c0:
                raise RuntimeError(f"{item.id} does not cover the window")
            dn = src.read(1, window=Window(c0, r0, c1 - c0, r1 - r0)).astype("float32")
    shifted = [GroundControlPoint(row=g.row - r0, col=g.col - c0, x=g.x, y=g.y, z=g.z) for g in gcps]
    a = _calibration(item, slice(r0, r1), slice(c0, c1))
    sigma0 = np.where(dn > 0, dn * dn / (a * a), np.nan).astype("float32")
    out = np.full(gbox.shape, np.nan, dtype="float32")
    reproject(sigma0, out, gcps=shifted, src_crs=gcp_crs, dst_transform=gbox.affine, dst_crs=gbox.crs,
              resampling=Resampling.average, src_nodata=np.nan, dst_nodata=np.nan)
    # Speckle: average a 3 x 3 neighbourhood in linear power, then convert.
    valid = np.isfinite(out)
    num = ndimage.uniform_filter(np.where(valid, out, 0), 3)
    den = ndimage.uniform_filter(valid.astype("float32"), 3)
    with np.errstate(divide="ignore", invalid="ignore"):
        smooth = num / den
        db = 10 * np.log10(smooth)
    db[~valid] = np.nan
    return db


def s1_items(event: dict, datetime: str):
    w, s, e, n = event["bbox"]
    items = Client.open(STAC_URL).search(
        collections=["sentinel-1-grd"], bbox=(w, s, e, n), datetime=datetime,
        query={"sat:relative_orbit": {"eq": event["relative_orbit"]}},
    ).item_collection()
    return sorted(items, key=lambda it: it.datetime)


def dry_season_water(event: dict, gbox: GeoBox, max_scenes: int = 8) -> np.ndarray:
    """Lakes that hold water in the dry season, from Sentinel-2 (MNDWI > 0.1)."""
    w, s, e, n = event["bbox"]
    items = Client.open(STAC_URL).search(
        collections=["sentinel-2-l2a"], bbox=(w, s, e, n), datetime=event["dry_season"],
        query={"eo:cloud_cover": {"lt": 10}},
    ).item_collection()
    items = sorted(items, key=lambda it: it.properties["eo:cloud_cover"])[:max_scenes]
    odc.stac.configure_rio(cloud_defaults=True, aws={"aws_unsigned": True})
    ds = odc.stac.load(items, bands=["green", "swir16", "scl"], geobox=gbox, groupby="solar_day",
                       resampling="average", pool=8)
    offsets = []
    by_day = {it.datetime.date(): it for it in items}
    for t in ds.time.values:
        it = by_day.get(np.datetime64(t, "D").item(), items[0])
        baseline = float(it.properties.get("s2:processing_baseline", "0"))
        applied = it.properties.get("earthsearch:boa_offset_applied", False)
        offsets.append(BOA_OFFSET if baseline >= 4.0 and not applied else 0.0)
    off = np.array(offsets, dtype="float32")[:, None, None]
    valid = clear_mask(ds["scl"].values)
    green = np.where(valid, ds["green"].values * REFLECTANCE_SCALE + off, np.nan)
    swir = np.where(valid, ds["swir16"].values * REFLECTANCE_SCALE + off, np.nan)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        m = np.nanmedian(mndwi(green, swir), axis=0)
    return np.nan_to_num(m, nan=-1) > 0.1


def mapped_lakes(gbox: GeoBox, path=DEFAULT_LAKES_FILE) -> np.ndarray:
    """Mapped lake outlines on the grid. Weed-covered lakes (Bellandur in 2022)
    don't look like water to Sentinel-2, and their surface going under on the
    flood morning is the lake, not a flooded street."""
    to_grid = Transformer.from_crs("EPSG:4326", gbox.crs, always_xy=True).transform
    geoms = [reproject_geom(to_grid, shape(f["geometry"]))
             for f in json.loads(Path(path).read_text(encoding="utf-8"))["features"]]
    if not geoms:
        return np.zeros(gbox.shape, dtype=bool)
    return rasterize([(g, 1) for g in geoms], out_shape=gbox.shape, transform=gbox.affine,
                     fill=0, dtype="uint8").astype(bool)


def coregister(sar_ref_db: np.ndarray, lakes: np.ndarray) -> tuple[int, int]:
    """Pixel shift that puts the radar's dark lakes on the Sentinel-2 lakes."""
    dark = np.nan_to_num(sar_ref_db, nan=0) < -18
    shift, _, _ = phase_cross_correlation(lakes.astype("float32"), dark.astype("float32"))
    dy, dx = (int(round(v)) for v in shift)
    if max(abs(dy), abs(dx)) > MAX_SHIFT_PX:
        print(f"co-registration shift {dy, dx} px is implausible; not applied")
        return 0, 0
    return dy, dx


def shift(a: np.ndarray, dy: int, dx: int) -> np.ndarray:
    return ndimage.shift(a, (dy, dx), order=0, mode="constant", cval=np.nan)


def classify_flood(flood_db, ref_db, lakes) -> np.ndarray:
    valid = np.isfinite(flood_db) & np.isfinite(ref_db)
    flooded = valid & (flood_db < FLOOD_DB_MAX) & (ref_db - flood_db >= DROP_DB)
    lake_zone = ndimage.binary_dilation(lakes, iterations=1)
    flooded &= ~lake_zone
    labels, n = ndimage.label(flooded, structure=np.ones((3, 3)))
    if n:
        sizes = ndimage.sum(flooded, labels, index=np.arange(1, n + 1))
        flooded = np.isin(labels, np.flatnonzero(sizes >= MIN_FLOOD_PX) + 1)
    out = np.full(flood_db.shape, NONE, dtype="uint8")
    out[lakes] = LAKE
    out[flooded] = FLOOD
    out[~valid] = NODATA
    return out


def write(out: Path, event_id: str, event: dict, gbox: GeoBox, classes, meta: dict, quicklooks: dict) -> None:
    out.mkdir(parents=True, exist_ok=True)
    profile = dict(driver="GTiff", height=classes.shape[0], width=classes.shape[1], count=1, dtype="uint8",
                   crs=event["crs"], transform=gbox.affine, nodata=NODATA, compress="deflate", tiled=True)
    with rasterio.open(out / "flood.tif", "w", **profile) as dst:
        dst.write(classes, 1)
    rgba = np.zeros(classes.shape + (4,), dtype="uint8")
    rgba[classes == FLOOD] = (124, 58, 237, 190)  # violet: flood water
    rgba[classes == LAKE] = (30, 120, 220, 110)  # blue: lakes that are always there
    Image.fromarray(rgba, "RGBA").save(out / "overlay.png", optimize=True)
    for name, db in quicklooks.items():
        grey = np.nan_to_num(np.clip((db + 25) / 25, 0, 1) * 255).astype("uint8")
        Image.fromarray(grey, "L").save(out / f"{name}.png", optimize=True)
    b = gbox.geographic_extent.boundingbox
    (out / "event.json").write_text(json.dumps({
        "id": event_id, "name": event["name"], "date": event["date"],
        "bounds": [b.left, b.bottom, b.right, b.top],
        **meta,
    }, indent=2), encoding="utf-8")


def run(event_id: str, out_root: Path) -> Path:
    event = EVENTS[event_id]
    gbox = grid(event)
    print(f"grid {gbox.shape} at {RES_M} m")

    flood_item = next(it for it in s1_items(event, event["date"]) if it.id == event["flood_scene"])
    refs = [it for r in event["reference_ranges"] for it in s1_items(event, r)]
    print(f"flood scene {flood_item.id}; {len(refs)} reference scenes")

    flood_db = read_sigma0_db(flood_item, gbox)
    ref_stack = []
    for it in refs:
        try:
            ref_stack.append(read_sigma0_db(it, gbox))
            print(f"  read {it.id}")
        except Exception as e:  # a scene that misses the window or fails to read
            print(f"  skipped {it.id}: {e}")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        ref_db = np.nanmedian(np.stack(ref_stack), axis=0)

    lakes = dry_season_water(event, gbox)
    dy, dx = coregister(ref_db, lakes)
    lakes |= mapped_lakes(gbox)
    print(f"co-registration shift: {dy} px down, {dx} px right ({dy * RES_M} m, {dx * RES_M} m)")
    flood_db, ref_db = shift(flood_db, dy, dx), shift(ref_db, dy, dx)

    classes = classify_flood(flood_db, ref_db, lakes)
    flooded_km2 = round(float((classes == FLOOD).sum()) * RES_M * RES_M / 1e6, 2)
    print(f"flooded area seen: {flooded_km2} km2")
    out = out_root / event_id
    write(out, event_id, event, gbox, classes, {
        "flood_scene": flood_item.id,
        "flood_time_utc": flood_item.datetime.isoformat(),
        "reference_scenes": [it.id for it in refs],
        "resolution_m": RES_M,
        "shift_px": [dy, dx],
        "flooded_km2": flooded_km2,
        "thresholds": {"flood_db_max": FLOOD_DB_MAX, "drop_db": DROP_DB, "min_flood_px": MIN_FLOOD_PX},
        "source": "Copernicus Sentinel-1 GRD via the Registry of Open Data on AWS (Earth Search)",
        "limits": "Radar misses water between tall buildings and floods that drained before the pass.",
        "made": dt.date.today().isoformat(),
    }, {"flood_db": flood_db, "reference_db": ref_db})
    return out


def main(argv=None) -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--event", default="blr-2022-09", choices=sorted(EVENTS))
    p.add_argument("--out", type=Path, default=Path("../data/floods"))
    args = p.parse_args(argv)
    print(run(args.event, args.out))


if __name__ == "__main__":
    main()
