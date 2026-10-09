# JalRekha

**See how our lakes change over time.**

JalRekha is a satellite-powered lake monitoring and environmental evidence platform. It compares historical Sentinel-2 imagery, dry season against dry season, to find persistent change in lake beds and their buffer zones, and turns it into dated, reproducible evidence that communities can use for environmental action.

Built for **WeMakeDevs Environmental Hacks**, Heat and Water track (floods, groundwater, droughts). Lakes absorb monsoon floodwater and recharge groundwater; every acre filled weakens both.

> Satellite-detected change is not proof of illegal encroachment. Verify on the ground and in official records.

## What it does

Discover a lake → compare historical satellite observations → inspect detected changes → examine the buffer zone → download an evidence pack → watch for new change.

| Status | Lakes |
| --- | --- |
| Analysed (full pipeline, 2019–2026) | 12 lakes in Bengaluru, Hyderabad and Chennai |
| Catalogued, queued for analysis | 7,165 named lakes across 35 states and union territories (OpenStreetMap) |
| Flags hand-checked | Not yet: see [`research/`](research/README.md) |

Demo lake: **Subedeharana Kere, Bengaluru**: 0.94 ac of lake bed turned to grassed land, lasting since the 2025 dry season (reported debris dumping in early 2024).

## Repository layout

```
web/            Next.js app (static export) + MapLibre: home, lakes, lake analysis, evidence pack, watchlist
pipeline/       Python analysis package `jalrekha`: scenes, masks, composites, classes, persistence, flags, export
  scripts/      Lake lists (ATREE KML, OSM catalogue), index builder, hand-check kit
infra/          AWS: pipeline Lambda container, API Lambda, Step Functions, IAM policies
contracts/      Output format shared by the pipeline and the web app
data/lakes/     Outlines of the analysed lakes
data/catalog/   India-wide lake catalogue (list + card outlines)
data/sample/    Hand-made fixtures, clearly marked sample (not results)
templates/      Complaint and RTI letter templates
research/       Flag hand-check kit
```

## How the analysis works

1. Sentinel-2 L2A scenes from Earth Search (AWS Open Data, us-west-2); only the lake window is read.
2. Cloud mask (SCL) and building-shadow mask (dark in visible bands but not in SWIR, unlike water).
3. Dry-season (Jan–Apr) and post-monsoon (Nov–Dec) median composites per year; under 3 clear looks = "not enough data".
4. Per-pixel classes: water (MNDWI above a per-lake Otsu threshold, never below 0), floating vegetation, land vegetation, bare/built, mixed.
5. **Weeds versus land:** vegetation inside the lake is floating (still lake) when its SWIR is low, because water lies beneath it. Grass on dry land reflects far more SWIR (measured: about 0.12–0.16 vs 0.23 at Subedeharana).
6. Reference footprint = lake outline ∪ water present in every 2019–2020 dry season and connected to the lake.
7. Baseline = 2019–2020. A lake-bed pixel is lost only if it was lake in every baseline dry season and is land in its latest dry seasons: bare/built, or grassed over with SWIR risen ≥ 0.06 above its own baseline. Two seasons in a row = confirmed.
8. Buffer: natural ground inside the 30 m ring that turned bare or built.
9. Flags = 5+ connected lost pixels (500 m²), each with area, first-seen season, persistence, confidence and category.

Thresholds live in [`pipeline/jalrekha/config.py`](pipeline/jalrekha/config.py) and are the same for every lake.

## Built on AWS (verified 9 Oct 2026)

| Service | Use | Status |
| --- | --- | --- |
| Registry of Open Data (Sentinel-2 COGs) | All imagery, read in place | Live |
| Lambda (container) | Pipeline, one lake per run, ~2 min | Live |
| Step Functions | All lakes in parallel, retries | Live; last run 12/12 succeeded |
| S3 | Results, images, flags | Live |
| DynamoDB | Lake summaries, season statistics, flags (267 items); watchers | Live |
| EventBridge Scheduler | Monthly re-scan, 5th at 03:00 IST | Live |
| SNS | Email alerts, once per new dry season | Live; no subscribers yet |
| API Gateway + Lambda | Results, `/watch`, `/unwatch` | Live |
| Amplify Hosting | Web app | Not deployed yet; the site runs locally (`npm run dev`) |

Deployed resource names keep the original `kerewatch-*` prefix (see [`infra/README.md`](infra/README.md)); renaming them needs a migration, not a rename.

## Run it

```bash
# Web app
cd web && npm install && cp .env.example .env.local && npm run dev   # http://localhost:3000

# Pipeline
cd pipeline
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m jalrekha.run --lake subedeharana-kere --out ../data/out
pytest
```

India catalogue (Overpass API, resumable, cached per state):

```bash
cd pipeline && python scripts/osm_india_lakes.py <cache_dir> ../data/catalog
```

## Data credits

- Contains modified Copernicus Sentinel data [2019–2026], via the [Registry of Open Data on AWS](https://registry.opendata.aws/sentinel-2-l2a-cogs/) and [Earth Search](https://github.com/element84/earth-search) by Element 84.
- Lake outlines: [ATREE-CSEI, Map of Lakes in Bengaluru Urban](https://data.opencity.in/dataset/map-lakes-streams-bengaluru-urban-within-bbmp-area), CC BY; © OpenStreetMap contributors, ODbL.

## Limitations

- Not a land survey: change is measured against the lake's historical water extent, not the revenue boundary.
- 10 m pixels: a 30 m buffer is three pixels wide; small sheds and walls are missed.
- History starts in 2019 (Sentinel-2 L2A is global from December 2018).
- Legal works (walkways, sewage plants, desilting) also show as change.
- Flags are not yet hand-checked.

## AI tools used

<!-- The rules require listing these. -->
- Claude Code (Anthropic)
