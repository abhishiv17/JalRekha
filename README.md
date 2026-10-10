# JalRekha

**See how our lakes change over time.**

JalRekha is a satellite-powered lake monitoring and environmental evidence platform. It compares historical Sentinel-2 imagery, dry season against dry season, to find persistent change in lake beds and their buffer zones, and turns it into dated, reproducible evidence that communities can use for environmental action.

Built for **WeMakeDevs Environmental Hacks**, Heat and Water track (floods, groundwater, droughts). Lakes absorb monsoon floodwater and recharge groundwater; every acre filled weakens both.

> Satellite-detected change is not proof of illegal encroachment. Verify on the ground and in official records.

## What it does

Discover a lake → compare historical satellite observations → inspect detected changes → examine the buffer zone → download an evidence pack → watch for new change.

| Status | Lakes |
| --- | --- |
| Analysed (full pipeline, 2019–2026) | 27 lakes in Delhi, Bengaluru, Hyderabad and Chennai, plus any catalogued lake a visitor asks to track ("Track this lake") |
| Delhi's ponds | 331 found from space; 59 dried up and 31 shrunk since 2019–2021 (`/ponds/`) |
| Catalogued, queued for analysis | 7,165 named lakes across 35 states and union territories (OpenStreetMap) |
| Flags checked on sharper photos | 46 checked: 14 confirmed, 21 not confirmed, 11 can't tell (see [`research/`](research/README.md)) |

Demo lake: **Subedeharana Kere, Bengaluru**: 0.94 ac of lake bed turned to grassed land, lasting since the 2025 dry season (reported debris dumping in early 2024).

## Plot Check: before you buy or rent

Drop a pin or search an address at `/check/`. For a 1.2 km square around the pin, JalRekha reads every Sentinel-2 pass since 2019 and answers, for that exact spot:

- **Was it lake water?** Water at the pin in each dry season (Jan–Apr), 2019–2026.
- **Does it get waterlogged?** Water at the pin after each monsoon (Nov–Dec).
- **How close is the lake?** Distance to the largest water extent seen since 2019, and whether the spot falls inside the buffer zones (Karnataka 30 m and the proposed size-based tiers; Hyderabad 30 m / 9 m), measured from that edge.
- **Did it flood?** Sentinel-1 radar flood maps of past events, starting with Bengaluru on 5 Sep 2022 (2.91 km² of standing floodwater outside the lakes).
- **What does it mean?** A level (High risk / Watch / Low risk) set by fixed rules, explained in English, Kannada, Telugu and Hindi, with what to verify before paying. The explanation is written by Claude on Amazon Bedrock once the account has model access (requested; AWS currently answers "Error 002"); until then it comes from a fixed English template translated by Amazon Translate. Save as PDF or share the link.

It uses the pipeline's most reliable signal (was water there?), not the harder one (was a lake filled?). The hand-check above shows why: satellite change flags are leads, but water history is evidence.

| Piece | AWS |
| --- | --- |
| Address search, reverse geocoding | Amazon Location Service (Places) |
| `POST /check`, `GET /check/<id>`, `GET /geocode` | API Gateway (HTTP) + Lambda |
| One pin per run, 2–4 min | Lambda (container from ECR), invoked asynchronously |
| Imagery | Sentinel-2 L2A and Sentinel-1 GRD from the Registry of Open Data on AWS |
| Plain-language verdict | Amazon Bedrock (Claude, pending account access), then Amazon Translate, then fixed templates |
| Reports and images; status and cache | S3 (private, presigned links); DynamoDB |
| Flood maps, container builds, tests | CodeBuild |

Setup: [`infra/plot/setup.sh`](infra/plot/setup.sh). Code: [`pipeline/jalrekha/plot.py`](pipeline/jalrekha/plot.py), [`verdict.py`](pipeline/jalrekha/verdict.py), [`flood.py`](pipeline/jalrekha/flood.py).

## Bring Delhi's ponds back

`/ponds/` turns the pond scan into action, one pond at a time:

1. **Find**: every pond in Delhi from Sentinel-2 (Nov–Jan medians, 2019–2025, clipped to Delhi's boundary), with before and after photos ([`ponds.py`](pipeline/jalrekha/ponds.py)).
2. **Adopt**: a resident welfare association, school, college or company takes charge of a dried-up pond.
3. **Route**: a ready letter to the agency that owns the land (DDA, MCD, DJB, PWD, Irrigation and Flood Control, Forest, or the district's District Magistrate), copied to the Wetland Authority of Delhi, and a CSR proposal for companies.
4. **Clock**: each pond shows its stage, and `/ponds/board/` shows each agency's letters, answers and overdue cases (30 days).
5. **Proof**: anyone can ask the satellite to look at a pond now (every clear pass of the last 75 days, [`pondcheck.py`](pipeline/jalrekha/pondcheck.py)); water back means "Revived", a claim the satellite can't see is flagged.
6. **Prevent**: Plot Check warns when a pin is on, or within 50 m of, a pond.

Cases live in DynamoDB behind the Plot Check API (`/ponds/cases`, `/ponds/<id>/adopt|stage|check`); space checks run on the worker Lambda.

## In your language, with Jal as your guide

People who live beside these lakes don't all read English, and a satellite map needs explaining. So:

- **Four languages.** The language menu in the header (or "Read this in" on the home page) shows every page in English, हिन्दी, ಕನ್ನಡ or తెలుగు. Text is translated by **Amazon Translate** through the Plot Check API (`POST /translate`) and kept in DynamoDB, so each phrase is translated once; the site also ships phrase books built from its own pages (`web/scripts/i18n-bundle.mjs`) and remembers answers in the browser. Lake names, "JalRekha" and "Jal" stay as they are. If the API can't be reached, the page stays in English rather than breaking.
- **Jal, the guide.** Switch on "Jal guide" in the header, or pick a language when Jal offers a walk-through. Jal follows you down the page, lights up the part it is talking about, explains it in plain words from that lake's own numbers, and reads it aloud: **Amazon Polly** (Kajal, Indian English and Hindi; `POST /speak`, cached in S3) or, for Kannada and Telugu, which Polly has no voice for, the device's own voice. Back and Next step through the page; `?guide=1` on any link opens it with Jal on.
- Every speech bubble on the site has a listen button too.

How it works: [`PageTranslator.tsx`](web/src/components/PageTranslator.tsx) swaps the text on screen for its translation and keeps the English beside it (React keeps working, switching back is exact); [`JalGuide.tsx`](web/src/components/JalGuide.tsx) reads what each section wants Jal to say from `data-jal`; [`speech.ts`](web/src/lib/speech.ts) and [`translate.ts`](web/src/lib/translate.ts) talk to the API in [`infra/plot/api.py`](infra/plot/api.py).

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

## Built on AWS (verified 10 Oct 2026)

Two AWS accounts, both us-west-2: the lake pipeline (below, `kerewatch-*`) and the Plot Check API (`jalrekha-plot-*`), which also serves the site's lake data, pond cases, translation and Jal's voice.

| Service | Use | Status |
| --- | --- | --- |
| Registry of Open Data (Sentinel-2 COGs) | All imagery, read in place | Live |
| Lambda (container) | Pipeline, one lake per run, ~2 min | Live |
| Step Functions | All lakes in parallel, retries | Live; the 5 most recent runs succeeded |
| S3 | Results, images, flags | Live |
| DynamoDB | Lake summaries, season statistics, flags (291 items); watchers | Live |
| EventBridge Scheduler | Monthly re-scan, 5th at 03:00 IST | Live |
| SNS | Email alerts, once per new dry season | Live |
| API Gateway + Lambda | Results, `/watch`, `/unwatch` | Live |
| Amplify Hosting | Web app | Live: https://main.d25xaqqlm27lpb.amplifyapp.com/ |
| Amazon Translate | The site in Hindi, Kannada and Telugu (`/translate`), Plot Check verdicts | Live in the Plot Check account |
| Amazon Polly | Jal's voice in Indian English and Hindi (`/speak`, cached in S3) | Plot Check account |
| Amazon Location Service | Address search for Plot Check | Live |

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
- Flags are leads, not findings: of 46 checked on sharper photos, 14 were confirmed (see `research/flags_checked.csv`).
- Plot Check measures buffers from the water seen since 2019, not the notified Full Tank Level or revenue map.
- Radar flood maps miss water between tall buildings and floods that drained before the satellite passed; "not seen" is not "flood-free".

## AI tools used

<!-- The rules require listing these. -->
- Claude Code (Anthropic): writing and reviewing code, copy and translations of Jal's own controls
- Claude (Anthropic): AI-assisted review of 35 of the 46 flag image chips (`research/flags_checked.csv`, `checked_by`)
- Amazon Translate and Amazon Polly are part of the product, not tools used to build it
