"""Buffer rings around the reference footprint.

Current law (KTCDA Act 2014): a uniform 30 m buffer.
2025 amendment bill (returned by the Governor; not in force): size-based
tiers as reported by Deccan Herald. Sources disagree on the smallest tier
(0 m up to 0.05 acres per Mongabay; other thresholds elsewhere), which
doesn't affect the lakes in scope. Show this rule as "proposed", with an
"as of" date.
"""

from shapely.geometry.base import BaseGeometry

from .config import CURRENT_LAW_BUFFER_M

# (upper bound in acres, buffer in metres), checked in order.
BILL_2025_TIERS = (
    (0.05, 0),
    (1, 3),
    (10, 6),
    (25, 12),
    (100, 24),
    (float("inf"), 30),
)


def bill_2025_buffer_m(lake_area_acres: float) -> int:
    """Buffer width the 2025 bill would set for a lake of this size."""
    for upper, metres in BILL_2025_TIERS:
        if lake_area_acres <= upper:
            return metres
    raise ValueError(lake_area_acres)


def ring(footprint: BaseGeometry, width_m: float) -> BaseGeometry:
    """Band of `width_m` outside the footprint (footprint in a metric CRS)."""
    return footprint.buffer(width_m).difference(footprint)


def buffer_rings(footprint: BaseGeometry, lake_area_acres: float) -> dict:
    """Rings for the current law and the 2025 bill, keyed by width in metres."""
    widths = {CURRENT_LAW_BUFFER_M, bill_2025_buffer_m(lake_area_acres)}
    return {w: ring(footprint, w) for w in sorted(widths) if w > 0}
