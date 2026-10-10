import numpy as np
from odc.geo.geobox import GeoBox
from shapely.geometry import box

from jalrekha import heat
from jalrekha.flood import FLOOD, LAKE, NODATA
from jalrekha.floodlink import city_share


def test_utm_zone_for_indian_cities():
    assert heat.utm_crs(77.17, 28.74) == "EPSG:32643"  # Delhi
    assert heat.utm_crs(78.39, 17.43) == "EPSG:32644"  # Hyderabad
    assert heat.utm_crs(80.05, 13.0) == "EPSG:32644"  # Chennai


def test_landsat_kelvin_scale():
    # Collection 2 ST_B10: a DN of 44177 is about 300 K, 27 degC.
    assert abs(44177 * heat.SCALE + heat.OFFSET - 273.15 - 26.85) < 0.1


def test_mean_in_ignores_cloudy_pixels():
    gbox = GeoBox.from_bbox((0, 0, 300, 300), crs="EPSG:32643", resolution=30)
    lst = np.full(gbox.shape, 40.0)
    lst[:5, :] = np.nan  # cloud
    lst[5:, :5] = 30.0
    assert heat.mean_in(lst, box(0, 0, 150, 150), gbox) == 30.0
    assert heat.mean_in(lst, box(0, 150, 300, 300), gbox) is None  # all cloud
    assert heat.mean_in(lst, None, gbox) is None


def test_colour_is_transparent_where_unknown():
    lst = np.array([[25.0, np.nan], [45.0, 35.0]])
    rgba = heat.colour(lst, 25, 45)
    assert rgba[0, 1, 3] == 0 and rgba[0, 0, 3] == 255
    assert rgba[0, 0, 2] > rgba[0, 0, 0]  # coolest is blue
    assert rgba[1, 0, 0] > rgba[1, 0, 2]  # hottest is red


def test_city_share_counts_land_only():
    c = np.array([[FLOOD, 0, 0, LAKE], [NODATA, 0, FLOOD, LAKE]], dtype="uint8")
    assert city_share(c) == 2 / 5
