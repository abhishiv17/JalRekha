# JalRekha

**Lakes protect our cities. Let's protect lakes.**

JalRekha reads free satellite photos of every lake, pond and plot, from 2019 to today, and turns what changed into action: a warning before you buy land on a filled lake, dated proof and a ready letter when a lake is being filled, and a public, satellite-checked path to bring lost ponds back.

**Live:** https://main.d25xaqqlm27lpb.amplifyapp.com/ · Built for **WeMakeDevs Environmental Hacks**, Heat and Water track.

![Home page: Bhalswa Lake, Delhi, in 2019 and 2026](docs/screenshots/home.jpg)

> A satellite shows where a lake changed, not who changed it or whether it was allowed. Verify on the ground and in official records.

| | |
| --- | --- |
| Lakes analysed, 2019–2026 | 27, in Delhi, Bengaluru, Hyderabad and Chennai, plus any catalogued lake a visitor asks to track |
| Lakes on the map | 7,178 named lakes across India (OpenStreetMap) |
| Delhi's ponds | 331 found from space; 59 dried up and 31 shrunk since 2019–2021 |
| Flags checked on sharper photos | 46: 14 confirmed, 21 not confirmed, 11 can't tell |

## Features

### 1. A lake's story, step by step

Six steps over the real satellite photo: the lake's edge, every year since 2019, open water in blue, lake bed that became land in orange, the 30-metre no-build zone, then proof to act. Every lake gets the same framing; use the arrows or the arrow keys.

<p><img src="docs/screenshots/home-story.jpg" width="49%" alt="Bhalswa story on the home page"> <img src="docs/screenshots/lake-story.jpg" width="49%" alt="Story on a lake page"></p>

### 2. Lakes we track

Search any lake in India. 27 have results from the full pipeline; any other catalogued lake can be tracked on demand ("Track this lake"), which runs the whole analysis on AWS in a few minutes.

![Lakes list](docs/screenshots/lakes.jpg)

### 3. Lake page: what changed, in plain words

The headline says how much of the lake and its protected edge turned into land, in acres and football pitches, with then-and-now photos. Below: a year-by-year map, a slider to compare any two years, and every flagged spot with how sure we are and whether it held up on sharper photos.

<p><img src="docs/screenshots/lake-page.jpg" width="49%" alt="Bhalswa Lake page"> <img src="docs/screenshots/lake-compare.jpg" width="49%" alt="Compare two years"></p>

![Flagged spots, checked on sharper photos](docs/screenshots/lake-flags.jpg)

### 4. Proof pack and letters

Dated satellite scenes, areas and coordinates for every flag, a map file for Google Earth, and ready complaint and Right to Information letters addressed to the right authority for the lake's state. Save as PDF.

![Evidence pack](docs/screenshots/evidence.jpg)

### 5. Plot Check: was this land part of a lake?

Before you buy or rent, drop a pin. JalRekha reads every Sentinel-2 photo of that spot since 2019 and answers: was it lake water, does it get waterlogged after the monsoon, how close is the lake and its no-build zone, and did it flood (Sentinel-1 radar flood maps of Delhi 2023, Bengaluru 2022, Hyderabad 2020 and Chennai 2015).

![Pick a spot](docs/screenshots/check-pick.jpg)

**While it works**, Jal shows each step live: finding the spot, reading every photo (with a count per season), finding where water has been, checking flood maps and writing the report. A check takes about two minutes.

<p><img src="docs/screenshots/check-thinking-1.jpg" width="32%" alt="Finding the spot"> <img src="docs/screenshots/check-thinking-2.jpg" width="32%" alt="Reading satellite photos"> <img src="docs/screenshots/check-thinking-3.jpg" width="32%" alt="Still reading, season by season"></p>

**The answer**: a level set by fixed rules (High risk / Watch / Low risk), what to check before paying, in English, Kannada, Telugu and Hindi, and the evidence on the map. Shareable link; save as PDF.

<p><img src="docs/screenshots/check-result-map.jpg" width="49%" alt="Plot Check result with map"> <img src="docs/screenshots/check-result.jpg" width="49%" alt="Plot Check verdict and facts"></p>

Plot Check also warns when the pin is on, or within 50 metres of, a pond found from space:

![Plot Check pond warning](docs/screenshots/check-pond-warning.jpg)

### 6. Bring Delhi's ponds back

Not just a count of what was lost. Each dried-up pond gets a way back:

1. **Find**: every pond in Delhi from space (November–January, 2019–2025), with before and after photos.
2. **Adopt**: a resident welfare association, school, college or company takes charge of one.
3. **Route**: a ready letter to the agency that owns the land (DDA, MCD, Delhi Jal Board, PWD, Irrigation and Flood Control, Forest, or the district's District Magistrate), copied to the Wetland Authority of Delhi, and a CSR proposal for companies.
4. **Clock**: each pond shows its stage; agencies have 30 days to answer, in public.
5. **Proof from space**: anyone can ask the satellite to look at a pond now. Water back means "Revived"; a claim the satellite can't see is flagged.

<p><img src="docs/screenshots/ponds-top.jpg" width="49%" alt="Ponds page"> <img src="docs/screenshots/ponds.jpg" width="49%" alt="Map and list of ponds"></p>

<p><img src="docs/screenshots/pond-page.jpg" width="49%" alt="One pond: the path back to water"> <img src="docs/screenshots/pond-adopt.jpg" width="49%" alt="Adopt this pond"></p>

![Public clock: agencies and adopted ponds](docs/screenshots/board.jpg)

### 7. Alerts

Watch a lake and get one email when a new dry season shows more of it turned to land. Every analysed lake is re-checked on the 5th of each month.

![Watchlist](docs/screenshots/watchlist.jpg)

## How the analysis works

1. Sentinel-2 L2A scenes from Earth Search (AWS Open Data, us-west-2); only the lake window is read.
2. Cloud mask (SCL) and building-shadow mask (dark in visible bands but not in SWIR, unlike water).
3. Dry-season (Jan–Apr) and post-monsoon (Nov–Dec) median composites per year; under 3 clear looks = "not enough data".
4. Per-pixel classes: water (MNDWI above a per-lake Otsu threshold, never below 0), floating vegetation, land vegetation, bare/built, mixed.
5. **Weeds versus land:** vegetation inside the lake is floating (still lake) when its SWIR is low, because water lies beneath it. Grass on dry land reflects far more SWIR.
6. Reference footprint = lake outline ∪ water present in every 2019–2020 dry season and connected to the lake.
7. A lake-bed pixel is lost only if it was lake in every baseline dry season and is land in its latest dry seasons. Two seasons in a row = confirmed.
8. Buffer: natural ground inside the 30 m ring that turned bare or built.
9. Flags = 5+ connected lost pixels (500 m²), each with area, first-seen season, persistence, confidence and category.
10. **Ponds:** water (MNDWI > 0.1) in 2 of 3 seasons 2019–2021 is a pond; a gentler test (MNDWI > 0) in 2024–2025 decides if any water is left, so murky water still counts. Drains, canals, the Yamuna and anything outside Delhi's boundary are left out.

Thresholds live in [`pipeline/jalrekha/config.py`](pipeline/jalrekha/config.py) and are the same for every lake.

## Built on AWS

| Service | Use |
| --- | --- |
| Registry of Open Data | Sentinel-2 L2A and Sentinel-1 GRD imagery, read in place |
| Lambda (container, from ECR) | Lake pipeline; Plot Check, Track this lake and pond checks, one run each |
| API Gateway + Lambda | Lake results, Plot Check, pond cases, alerts |
| Step Functions | All lakes in parallel, with retries |
| S3 | Results, images, flags, ponds (private, presigned links) |
| DynamoDB | Lake summaries and flags, Plot Check runs, pond cases, watchers |
| Amazon Location Service | Address search and reverse geocoding |
| Amazon Translate | Plot Check answers in Kannada, Telugu and Hindi |
| Amazon Bedrock | Plain-language explanations (pending account access; fixed templates until then) |
| EventBridge Scheduler + SNS | Monthly re-scan and email alerts |
| CodeBuild | Flood maps, the Delhi pond scan, container builds, tests |
| Amplify Hosting | The web app |

Setup: [`infra/`](infra/README.md) (lake pipeline) and [`infra/plot/setup.sh`](infra/plot/setup.sh) (Plot Check, tracking, ponds).

## Repository layout

```
web/            Next.js app (static export) + MapLibre
pipeline/       Python package `jalrekha`: lakes, Plot Check, flood maps, ponds, story photos
  scripts/      Lake lists, index builder, hand-check kit
infra/          AWS: pipeline Lambda, API, Step Functions; infra/plot: Plot Check, tracking, ponds
data/           Lake outlines, India catalogue, flood maps, Delhi ponds
templates/      Complaint and RTI letter templates
research/       Flags checked on sharper photos
docs/           Screenshots
```

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

## Data credits

- Contains modified Copernicus Sentinel data [2019–2026], via the [Registry of Open Data on AWS](https://registry.opendata.aws/sentinel-2-l2a-cogs/) (Sentinel-2 L2A; Sentinel-1 GRD from `s3://sentinel-s1-l1c`, requester pays) and [Earth Search](https://github.com/element84/earth-search) by Element 84.
- Lake outlines: [ATREE-CSEI, Map of Lakes in Bengaluru Urban](https://data.opencity.in/dataset/map-lakes-streams-bengaluru-urban-within-bbmp-area), CC BY; © OpenStreetMap contributors, ODbL.
- Sharper historical photos for flag checks: Esri World Imagery Wayback.

## Limitations

- Not a land survey: change is measured against the lake's historical water extent, not the revenue boundary.
- 10 m pixels: a 30 m buffer is three pixels wide; small sheds and walls are missed, and ponds smaller than about a fifth of an acre are not found.
- History starts in 2019 (Sentinel-2 L2A is global from December 2018).
- Legal works (walkways, sewage plants, desilting) also show as change.
- Flags are leads, not findings: of 46 checked on sharper photos, 14 were confirmed (see `research/flags_checked.csv`).
- Some ponds fill only in wet years, and some farm plots flood like ponds; check the photos before writing.
- Radar flood maps miss water between tall buildings and floods that drained before the satellite passed; "not seen" is not "flood-free".

## AI tools used

- Claude Code
