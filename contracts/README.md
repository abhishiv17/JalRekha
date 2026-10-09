# Output contract

The pipeline writes these files; the web app and the API only read them. Agree this in the first hour, then work in parallel from `data/sample/`.

All coordinates are WGS84 (EPSG:4326). Areas are in acres (1 acre = 4046.86 m²). Seasons are named `<year>-dry` (Jan–Apr) and `<year>-post` (Nov–Dec).

## Layout (S3 bucket root or `data/out/` locally)

```
index.json                         all lakes, for the lake list (local runs)
lakes/<lake-id>/summary.json       this lake's index.json entry (written by the Lambda)
lakes/<lake-id>/stats.json         numbers for one lake
lakes/<lake-id>/reference.geojson  reference footprint + buffer rings
lakes/<lake-id>/flags.geojson      change flags (one feature per flag)
lakes/<lake-id>/water/<season>.geojson     water extent outline for that season
lakes/<lake-id>/overlay/<season>.png       class overlay, transparent PNG
lakes/<lake-id>/truecolor/<season>.png     true-colour image for the swipe
lakes/<lake-id>/bounds.json        [west, south, east, north] that the PNGs cover
```

`lake-id` is a lowercase slug, e.g. `subedeharana-kere`.

## index.json

```json
{
  "generated": "2026-10-10T08:00:00Z",
  "lakes": [
    {
      "id": "subedeharana-kere",
      "name": "Subedeharana Kere",
      "area_ac": 12.4,
      "flagged_ac": 1.8,
      "flagged_share": 0.145,
      "latest_first_seen": "2024-dry",
      "centroid": [77.6, 12.88]
    }
  ]
}
```

The list is ranked by `flagged_ac`, then by `latest_first_seen` (newest first). On AWS, lakes run in parallel, so each writes `summary.json` (one entry, same fields) and the API builds the list from those.

## stats.json

```json
{
  "id": "subedeharana-kere",
  "name": "Subedeharana Kere",
  "reference_area_ac": 12.4,
  "thresholds": { "mndwi": 0.0, "veg_ndvi": 0.4, "bare_ndvi": 0.2, "ndbi": 0.0, "min_flag_px": 5 },
  "seasons": [
    {
      "season": "2024-dry",
      "clear_looks": 7,
      "status": "ok",
      "water_thr": 0.0,
      "water_ac": 9.1,
      "floating_veg_ac": 1.2,
      "bare_built_ac": 1.6,
      "land_veg_ac": 0.4,
      "nodata_share": 0.0,
      "scene_ids": ["S2B_43PGQ_20240214_0_L2A"]
    }
  ],
  "flags_total_ac": 1.8,
  "buffer": {
    "current_law_m": 30,
    "bill_2025_m": 6,
    "change_in_buffer_ac": { "30": 0.4, "6": 0.1 }
  },
  "as_of": "2026-10-10"
}
```

`status` is `"ok"` or `"not_enough_data"` (fewer than 3 clear looks). When it is `"not_enough_data"`, the area fields are `null`. Area fields count pixels inside the reference footprint (the lake), not the ring around it. `land_veg_ac` is lake bed that now carries land vegetation (dried or filled, then grassed over).

## flags.geojson

A FeatureCollection of polygons. Properties on each feature:

| Field | Type | Meaning |
| --- | --- | --- |
| `flag_id` | string | `<lake-id>-<n>` |
| `zone` | string | `"lakebed"` or `"buffer"` |
| `area_ac` | number | Flag area |
| `first_seen` | string | First season it was bare/built, e.g. `"2024-dry"` |
| `status` | string | `"confirmed"` (2+ dry seasons) or `"new"` (1 season) |
| `confidence` | string | `"high"`, `"medium"` or `"low"` |
| `kind` | string | `"fill_or_construction"` (mostly bare/built now) or `"vegetated_land"` (lake bed now grassed land) |
| `scene_ids` | string[] | Scenes behind the first-seen and latest composites |

## Overlay PNG colours

| Class | Value | RGBA |
| --- | --- | --- |
| Water | 1 | `30,120,220,160` |
| Floating vegetation | 2 | `60,170,90,160` |
| Bare or built | 3 | `220,80,50,200` |
| Land vegetation (incl. grassed-over lake bed) | 4 | transparent |
| Mixed | 5 | transparent |
| Shadow / no data | 0 | transparent |
