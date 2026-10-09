"""Lake outlines and the analysis grid.

data/lakes/lakes.geojson holds one feature per lake (WGS84), converted from
the ATREE-CSEI KML, with at least the properties `id` and `name`.
"""

import json
from pathlib import Path

import numpy as np
from odc.geo.geobox import GeoBox
from pyproj import Transformer
from rasterio.features import rasterize, shapes
from skimage.measure import label
from shapely.geometry import shape
from shapely.ops import transform as reproject, unary_union

from .config import CRS, RESOLUTION_M, THRESHOLDS

DEFAULT_LAKES_FILE = Path(__file__).resolve().parents[2] / "data" / "lakes" / "lakes.geojson"

_to_utm = Transformer.from_crs("EPSG:4326", CRS, always_xy=True).transform
_to_wgs84 = Transformer.from_crs(CRS, "EPSG:4326", always_xy=True).transform


def load_lake(lake_id: str, path: Path = DEFAULT_LAKES_FILE) -> dict:
    """{"id", "name", "outline"}; the outline is in UTM metres."""
    features = json.loads(Path(path).read_text(encoding="utf-8"))["features"]
    for f in features:
        if f["properties"].get("id") == lake_id:
            return {
                "id": lake_id,
                "name": f["properties"].get("name", lake_id),
                "outline": reproject(_to_utm, shape(f["geometry"])),
            }
    raise KeyError(f"lake {lake_id!r} not in {path}")


def to_wgs84(geom):
    return reproject(_to_wgs84, geom)


def analysis_grid(outline, margin_m: int = THRESHOLDS.ring_m) -> GeoBox:
    """10 m grid covering the outline plus the margin; every season loads onto it."""
    minx, miny, maxx, maxy = outline.buffer(margin_m).bounds
    return GeoBox.from_bbox((minx, miny, maxx, maxy), crs=CRS, resolution=RESOLUTION_M)


def to_mask(geom, gbox: GeoBox) -> np.ndarray:
    """Rasterize a UTM geometry onto the grid; True inside."""
    if geom.is_empty:
        return np.zeros(gbox.shape, dtype=bool)
    return rasterize(
        [(geom, 1)], out_shape=gbox.shape, transform=gbox.affine, fill=0, dtype="uint8"
    ).astype(bool)


def mask_to_geom(mask: np.ndarray, gbox: GeoBox):
    """Union of the True pixels as one UTM geometry (empty if none)."""
    mask = mask.astype(bool)
    geoms = [
        shape(g)
        for g, v in shapes(mask.astype("uint8"), mask=mask, transform=gbox.affine)
        if v == 1
    ]
    return unary_union(geoms)


def grow_footprint(outline_mask: np.ndarray, water: np.ndarray) -> np.ndarray:
    """Outline plus the baseline water connected to it.

    Water that merely touches the analysis window (a pond next door, a wet
    road) is not added; only water that is part of this lake.
    """
    combined = outline_mask | water
    labels = label(combined, connectivity=2)
    keep = np.unique(labels[outline_mask])
    keep = keep[keep > 0]
    return np.isin(labels, keep)
