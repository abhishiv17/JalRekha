# KereWatch

KereWatch uses free Sentinel-2 imagery to show, year by year, where Bengaluru's lakes and their buffer zones have been filled, built on or dumped into. It then turns that into dated evidence packs that lake groups can file.

Built for WeMakeDevs Environmental Hacks, Heat and Water track.

> KereWatch reports **change detected**, never "encroachment". Satellite pixels cannot establish ownership or legality. Verify every flag on the ground and in records.

## Repository layout

```
contracts/      Output format shared by the pipeline and the web app (agree this first)
data/
  lakes/        Lake outlines as GeoJSON (from the ATREE-CSEI KML)
  sample/       Hand-made sample outputs so the frontend can start before the pipeline is done
pipeline/       Python analysis: fetch scenes, mask, classify, persistence, flags, export
infra/
  lambda/       Container image for the pipeline Lambda
  stepfunctions/ State machine: one Map branch per lake
templates/      Complaint and RTI letter templates filled from a flag
web/            Next.js + MapLibre app (reads finished results only)
```

## How it works

1. Sentinel-2 L2A scenes from Earth Search (AWS Open Data, us-west-2); only the lake window is read.
2. Cloud mask (SCL) and building-shadow mask (dark in visible bands but not in SWIR, unlike water).
3. Dry-season (Jan–Apr) and post-monsoon (Nov–Dec) median composites per year; under 3 clear looks = "not enough data".
4. Per-pixel classes: water (MNDWI above a per-lake Otsu threshold, never below 0), floating vegetation, land vegetation, bare/built, mixed.
5. **The hyacinth trap:** vegetation inside the lake is floating (still lake) when its SWIR is low, because water lies beneath it. Grass on dry land reflects far more SWIR (measured: about 0.12–0.16 vs 0.23 at Subedeharana).
6. Reference footprint = ATREE outline ∪ water present in every 2019–2020 dry season and connected to the lake (roofs and roads never join it).
7. Baseline = 2019–2020. A lake-bed pixel is lost only if it was lake in every baseline dry season and is land in its latest dry seasons after 2020: bare/built, or grassed over with SWIR risen ≥ 0.06 above its own baseline (so marsh that drifts doesn't count). Two seasons in a row = confirmed.
8. Buffer: natural ground (water or vegetation in every baseline season) inside the 30 m ring that turned bare or built.
9. Flags = 5+ connected lost pixels (500 m²), each with area, first-seen season, confidence and kind (fill/construction or grassed land).

Thresholds live in [`pipeline/kerewatch/config.py`](pipeline/kerewatch/config.py) and are the same for every lake.

## Lakes across India

The site lists every named lake, tank and reservoir of 1 hectare or more mapped on OpenStreetMap, state by state, with its real outline. Lakes the pipeline has analysed show their results; the rest are "Queued" and never show numbers.

```bash
cd pipeline
python scripts/osm_india_lakes.py <cache_dir> ../data/catalog   # Overpass API; resumable, cached per state
```

This writes `data/catalog/india.json` (name, state, nearest town, centroid, area), `shapes/<state>.json` (outlines for the cards) and `outlines/<state>.geojson` (full outlines, ready to feed the pipeline in place of the ATREE map). Data © OpenStreetMap contributors, ODbL.

## Run the pipeline locally

```bash
cd pipeline
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m kerewatch.run --lake subedeharana-kere --out ../data/out
pytest
```

## Data credits

- Contains modified Copernicus Sentinel data [2019–2026], via the [Registry of Open Data on AWS](https://registry.opendata.aws/sentinel-2-l2a-cogs/) and [Earth Search](https://github.com/element84/earth-search) by Element 84.
- Lake outlines: [ATREE-CSEI, Map of Lakes in Bengaluru Urban](https://data.opencity.in/dataset/map-lakes-streams-bengaluru-urban-within-bbmp-area), CC BY.
- © OpenStreetMap contributors, ODbL.

## Limitations

- Not a land survey: change is measured against the lake's historical water extent, not the revenue boundary.
- 10 m pixels: a 30 m buffer is three pixels wide; small sheds and walls are missed.
- History starts in 2019 (Sentinel-2 L2A is global from December 2018).
- Legal works (walkways, sewage plants) also show as change.

## AI tools used

<!-- The rules require listing these. -->
- Claude Code (Anthropic)
