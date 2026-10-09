# Pipeline

Python analysis for one lake at a time. The same code runs on a laptop and inside the Lambda container.

```
kerewatch/
  config.py      thresholds, seasons, bands; the same for every lake
  lakes.py       lake outlines, reference footprint, UTM projection
  stac.py        Earth Search query and windowed loading of Sentinel-2 L2A
  masks.py       SCL cloud mask, building-shadow mask
  indices.py     MNDWI, NDVI, NDBI
  composites.py  seasonal median composites and clear-look counts
  classify.py    per-pixel classes, Otsu water threshold
  change.py      persistence test, flags, confidence
  buffer.py      buffer rings, 2025 bill tiers
  export.py      stats.json, GeoJSON, PNG overlays (see contracts/README.md)
  run.py         CLI: python -m kerewatch.run --lake <id>
```

Order of work for Friday: `stac.py` → `masks.py` → `indices.py` → `composites.py` → water area per year for Subedeharana Kere. The rest is Saturday.

Run tests with `pytest` from this folder. The core logic (masks, indices, classes, persistence, flags) has tests that need only numpy, scipy and scikit-image.
