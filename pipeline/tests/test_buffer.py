import pytest

shapely = pytest.importorskip("shapely")
from shapely.geometry import box  # noqa: E402

from jalrekha.buffer import bill_2025_buffer_m, buffer_rings  # noqa: E402


@pytest.mark.parametrize(
    "acres, metres",
    [(0.01, 0), (0.5, 3), (1, 3), (5, 6), (20, 12), (50, 24), (100, 24), (250, 30)],
)
def test_bill_tiers(acres, metres):
    assert bill_2025_buffer_m(acres) == metres


def test_rings_exclude_footprint():
    lake = box(0, 0, 100, 100)
    rings = buffer_rings(lake, 5)  # 5 acres -> 6 m under the bill
    assert sorted(rings) == [6, 30]
    assert rings[30].intersection(lake).area == pytest.approx(0, abs=1e-6)
    assert rings[30].area > rings[6].area
