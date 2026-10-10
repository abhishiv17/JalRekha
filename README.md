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
| Flags hand-checked | 36 checked: 7 confirmed, 20 not confirmed, 9 can't tell (see [`research/`](research/README.md)) |

Demo lake: **Subedeharana Kere, Bengaluru**: 0.94 ac of lake bed turned to grassed land, lasting since the 2025 dry season (reported debris dumping in early 2024).

## Plot Check: before you buy or rent

Drop a pin or search an address at `/check/`. For a 1.2 km square around the pin, JalRekha reads every Sentinel-2 pass since 2019 and answers, for that exact spot:

- **Was it lake water?** Water at the pin in each dry season (Jan–Apr), 2019–2026.
- **Does it get waterlogged?** Water at the pin after each monsoon (Nov–Dec).
- **How close is the lake?** Distance to the largest water extent seen since 2019, and whether the spot falls inside the buffer zones (Karnataka 30 m and the proposed size-based tiers; Hyderabad 30 m / 9 m), measured from that edge.
- **Did it flood?** Sentinel-1 radar flood maps of past events, starting with Bengaluru on 5 Sep 2022 (2.91 km² of standing floodwater outside the lakes).
- **What does it mean?** A level (High risk / Watch / Low risk) set by fixed rules, explained in English, Kannada, Telugu and Hindi by Claude on Amazon Bedrock, with what to verify before paying. Save as PDF or share the link.

It uses the pipeline's most reliable signal (was water there?), not the harder one (was a lake filled?). The hand-check above shows why: satellite change flags are leads, but water history is evidence.

| Piece | AWS |
| --- | --- |
| Address search, reverse geocoding | Amazon Location Service (Places) |
| `POST /check`, `GET /check/<id>`, `GET /geocode` | API Gateway (HTTP) + Lambda |
| One pin per run, 2–4 min | Lambda (container from ECR), invoked asynchronously |
| Imagery | Sentinel-2 L2A and Sentinel-1 GRD from the Registry of Open Data on AWS |
| Plain-language verdict | Amazon Bedrock (Claude), fixed-template fallback |
| Reports and images; status and cache | S3 (private, presigned links); DynamoDB |
| Flood maps, container builds, tests | CodeBuild |

Setup: [`infra/plot/setup.sh`](infra/plot/setup.sh). Code: [`pipeline/jalrekha/plot.py`](pipeline/jalrekha/plot.py), [`verdict.py`](pipeline/jalrekha/verdict.py), [`flood.py`](pipeline/jalrekha/flood.py).

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

- Contains modified Copernicus Sentinel data [2019–2026], via the [Registry of Open Data on AWS](https://registry.opendata.aws/sentinel-2-l2a-cogs/) (Sentinel-2 L2A; Sentinel-1 GRD from `s3://sentinel-s1-l1c`, requester pays) and [Earth Search](https://github.com/element84/earth-search) by Element 84.
- Lake outlines: [ATREE-CSEI, Map of Lakes in Bengaluru Urban](https://data.opencity.in/dataset/map-lakes-streams-bengaluru-urban-within-bbmp-area), CC BY; © OpenStreetMap contributors, ODbL.

## Limitations

- Not a land survey: change is measured against the lake's historical water extent, not the revenue boundary.
- 10 m pixels: a 30 m buffer is three pixels wide; small sheds and walls are missed.
- History starts in 2019 (Sentinel-2 L2A is global from December 2018).
- Legal works (walkways, sewage plants, desilting) also show as change.
- Flags are leads, not findings: of 36 hand-checked, 7 were confirmed (see `research/flags_checked.csv`).
- Plot Check measures buffers from the water seen since 2019, not the notified Full Tank Level or revenue map.
- Radar flood maps miss water between tall buildings and floods that drained before the satellite passed; "not seen" is not "flood-free".

## AI tools used

<!-- The rules require listing these. -->
- Claude Code (Anthropic)
