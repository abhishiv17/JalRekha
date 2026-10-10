![JalRekha home page: a city lake seen from above, with the headline "Lakes protect our cities. Let's protect lakes."](https://raw.githubusercontent.com/abhishiv17/JalRekha/main/docs/blog/home-hero.jpg)

*JalRekha's home page. Live at [main.d25xaqqlm27lpb.amplifyapp.com](https://main.d25xaqqlm27lpb.amplifyapp.com/).*

> **In short:** lakes keep the neighbourhoods around them cooler, soak up the monsoon so streets don't flood, and refill the ground water our borewells depend on. Across Indian cities they are being filled in, a little at a time. JalRekha uses free satellite photos on AWS to show exactly where a lake is turning into land, and then helps people do something about it: check a plot before buying, report it with proof, adopt a dried-up pond, and see from space whether the water comes back.

## Why we started with lakes

It started with one lake in west Bengaluru: **Mallathahalli Lake**, about 33 acres. We wanted to know something simple. Could a free satellite tell us whether this lake was shrinking?

The more we read, the clearer it became why that question matters:

- **Lakes cool the neighbourhood around them.** From space, on a summer morning, Mallathahalli's water is about **6 °C cooler** than the ground around it. Schools, homes and markets next to a lake feel that difference.
- **Lakes are a free flood drain.** In the monsoon, a lake holds water that would otherwise run down the streets.
- **Lakes refill the ground water.** The borewell in a nearby house depends on water soaking in from places like this.

And they are disappearing in ways nobody notices day to day. Nobody fills a lake in one go. It happens a truck of soil at a time: earth pushed in at the edge, then a wall, a road along the shore, sometimes a building. By the time anyone notices, the lake bed is under concrete, a family has bought a plot on it, and the street floods every monsoon without anyone connecting it to the lake that used to be there.

At Mallathahalli, the satellite showed parts of the lake turning into land after 2019. When we compared those spots with sharper photos, we could see what happened: the north-east arm held water in 2013–2014, was drained by 2019, and by 2023 was bare earth crossed by a new road along the shore. Some of that is official lake works, like walkways and embankments. A satellite can show that land changed, not whether it was allowed. But it can show it early, with dates, so the right people can ask.

So the question became: **what if anyone could see this happening while it can still be stopped?**

## What the satellite photos show

The European Space Agency's **Sentinel-2** satellites photograph every part of India every five days, at 10 metres per pixel. The whole archive since 2019 is free on the **Registry of Open Data on AWS**. Water, soil, grass and concrete each reflect light differently, so in these photos you can tell them apart.

For each lake, JalRekha:

1. **Compares summer with summer.** It uses the dry months, January to April, every year since 2019, so a dry year is never mistaken for a lost lake.
2. **Ignores clouds.** If clouds hide a lake too often in a year, it says "not sure" instead of guessing.
3. **Tells water from land, pixel by pixel.** It also tells weeds from grass. Water hyacinth floating on a lake looks green, like a lawn, but the water underneath makes it look different in infrared light. Floating weeds still count as lake.
4. **Only counts change that stays.** A patch counts as "turned into land" only if it was lake in 2019–2020 and stays land for two summers in a row, and is at least 500 m² (about four 30×40 ft house plots).

What it finds looks like this:

- **Soil dumped in at the edge.** Brown earth where there was water or reeds.
- **New roads, walls and walkways** cutting across the old lake edge.
- **Dried-up lake bed growing grass.** That's the first step before it gets built on.
- **Buildings inside the 30-metre zone** around the lake, where building isn't allowed in most states.

![A lake page for Bhalswa Lake, Delhi, next to the slider that compares any two years](https://raw.githubusercontent.com/abhishiv17/JalRekha/main/docs/blog/pair-lake-page.jpg)

*Left: a lake page says in plain words how much of the lake turned into land since 2019, with "then and now" photos. Right: drag the line to compare any two years; orange is the lake bed that became land.*

## The data we pulled together

- **27 lakes tracked closely** in Delhi, Bengaluru, Hyderabad and Chennai, every summer since 2019, re-checked every month.
- **7,178 named lakes across India** on the map (from OpenStreetMap). Anyone can open one and ask JalRekha to start tracking it; the whole analysis runs in a few minutes.
- **Flood maps** from **Sentinel-1 radar**, which sees through monsoon cloud: Delhi in July 2023, Bengaluru in September 2022, Hyderabad in 2020 and Chennai in 2015.
- **Summer heat** from **Landsat 8 and 9**, which measure how hot the ground gets.
- **Every pond in Delhi**, found from space: 331 ponds that held water after the monsoon in 2019–2021. **59 of them now have no water**, about 48 acres. 43 of those are covered in plants rather than built on, so they're the easiest to bring back.

![Bhalswa Lake step by step, next to the list of places where Mallathahalli Lake turned into land](https://raw.githubusercontent.com/abhishiv17/JalRekha/main/docs/blog/pair-story-spots.jpg)

*Left: every lake page walks through six steps on the real satellite photo, from the lake's edge to the proof. Right: each place where a lake turned into land, with its size, the year it was first seen, and whether it was confirmed on sharper photos.*

## We double-checked what the satellite told us

A 10-metre pixel can be fooled. Bright green algae on water can look like grass, and a muddy shoreline can look like dumped soil. So we didn't just trust it.

Across the lakes we track, the satellite marked **46 places** where it thought the lake had turned into land. We looked at every one of them again on **sharper historical photos** (Esri World Imagery Wayback and Google Earth Pro), year by year:

| What we found | Places |
| --- | --- |
| **Really turned into land:** soil dumped in, a road, a wall or a building where there was water | **14** |
| **Still water:** usually weeds or algae at the edge that fooled the satellite | **21** |
| **Couldn't tell** from the photos available | **11** |

That's an honest result, and it shaped the product. Every lake page now shows which places were confirmed on sharper photos, and the numbers we put forward only count those: **15.4 acres of lake bed confirmed lost across 6 lakes**.

It even changed our own home page. We had written that 8 acres of Bhalswa Lake in Delhi had turned into land. On the sharper photos, a long strip along the south-east shore really had gone from water to pushed-in earth. But part of what the satellite marked was still water, covered in bright green algae. So we rewrote it to say only what the photos show.

![Bhalswa Lake on sharper photos in 2019 and 2026, with the places the satellite marked outlined in orange](https://raw.githubusercontent.com/abhishiv17/JalRekha/main/docs/blog/pair-bhalswa-check.jpg)

*Bhalswa Lake, Delhi, on sharper photos. In 2019 (left) the south-east shore is water and reeds. By 2026 (right) the long orange strip is bare, pushed-in earth. The bright green patch at the top is algae on water, not land.*

## From finding out to fixing it

Showing what was lost is a report. We wanted JalRekha to change what happens next, so every finding leads to an action for a specific person:

![What changes with JalRekha: four rows comparing today with JalRekha for home buyers, residents, local groups and city agencies](https://raw.githubusercontent.com/abhishiv17/JalRekha/main/docs/blog/what-changes.jpg)

*The home page puts it side by side: how it happens today, and what changes with JalRekha.*

**For home buyers: Plot Check.** Drop a pin on a plot before you pay. JalRekha reads every satellite photo of that spot since 2019 and answers four questions: did lake water ever stand here, does it get waterlogged after the monsoon, how close is the lake's no-build zone, and did it flood. A check takes about two minutes, and Jal, our turtle guide, shows each step as it works. When fewer people buy filled lake land, filling a lake stops paying. That tackles the cause, not just the symptom.

![Plot Check reading satellite photos, next to a real result near Hauz Khas Lake](https://raw.githubusercontent.com/abhishiv17/JalRekha/main/docs/blog/pair-plot-check.jpg)

*Left: Plot Check reading every photo, season by season. Right: a real answer for a spot near Hauz Khas Lake, Delhi: "High risk: water has been on this spot or right next to it", with what to ask the seller.*

**For residents: proof and a ready letter.** Every lake has a proof pack: dated satellite photos, a map file for Google Earth, and a complaint and Right to Information letter already filled in, addressed to the right authority for that state.

**For local groups and companies: adopt a pond.** A resident welfare association, school, college or company can adopt one of Delhi's dried-up ponds. JalRekha writes the letter to the agency that owns the land (DDA, MCD, Delhi Jal Board and others, or the District Magistrate if nobody knows), copied to the Wetland Authority of Delhi. Companies get a one-page proposal for their CSR (corporate social responsibility) budget.

![Delhi's dried-up ponds on a map with before and after photos, next to one pond's page with "Adopt this pond"](https://raw.githubusercontent.com/abhishiv17/JalRekha/main/docs/blog/pair-ponds.jpg)

*Left: Delhi's dried-up ponds, with 2019 and 2025 satellite photos of each. Right: one pond's page, with its path back to water and the form to adopt it.*

**For city agencies and funders: a public clock, checked from space.** Every adopted pond shows how far it has got: adopted, letter sent, answered, inspected, work started, water back. If an agency hasn't answered in 30 days, it shows as overdue, for everyone to see. And anyone can press **"Look from space now"**: JalRekha reads every clear satellite photo of that pond from the last 75 days. If water is back, the pond is marked revived. If someone says the work is done but the satellite sees no water, that's shown too.

**For everyone: alerts.** Watch a lake and get one email when it shrinks again.

![A lake's proof pack with ready letters, next to the public clock for adopted ponds](https://raw.githubusercontent.com/abhishiv17/JalRekha/main/docs/blog/pair-proof-clock.jpg)

*Left: a lake's proof pack, with dated photos and letters ready to send. Right: the public clock, showing which agencies have answered.*

## Lakes keep a city cool, in any language

Landsat's heat sensor makes the cooling easy to see. Across 21 lakes, lake water on summer mornings is usually about **6 °C cooler** than the ground around it. Where part of a lake was filled in, that ground got hotter: **+2.8 °C** at Bhalswa, **+6.2 °C** at Mallathahalli.

The people who live next to these lakes don't all read English. So every page can switch to **हिन्दी, ಕನ್ನಡ or తెలుగు**, and Jal can walk you through any page and read it aloud in an Indian voice.

![Bhalswa Lake's summer heat map, next to Plot Check in Hindi](https://raw.githubusercontent.com/abhishiv17/JalRekha/main/docs/blog/pair-heat-language.jpg)

*Left: Bhalswa Lake is a cool blue strip in hotter ground; red is the hottest. Right: Plot Check in Hindi.*

## What it runs on

![JalRekha's architecture on AWS](https://raw.githubusercontent.com/abhishiv17/JalRekha/main/docs/blog/architecture.png)

*Satellite photos are read straight from AWS Open Data; nothing runs all the time.*

| What it does | AWS service |
| --- | --- |
| Satellite photos, read where they are stored | Registry of Open Data on AWS: Sentinel-2, Sentinel-1, Landsat 8/9 (S3) |
| Analyse one lake, one plot or one pond per run | AWS Lambda (container images in Amazon ECR) |
| All lakes in parallel, with retries | AWS Step Functions |
| Re-check every lake each month | Amazon EventBridge Scheduler |
| One email when a lake changes | Amazon SNS |
| The website's API: lake results, Plot Check, pond cases, translation, voice | Amazon API Gateway + AWS Lambda |
| Address search on the map | Amazon Location Service |
| Big one-off jobs: the whole-Delhi pond scan, flood maps, builds and tests | AWS CodeBuild |
| Results, photos and Jal's recorded voice | Amazon S3 |
| Lake results, Plot Check runs, pond cases, saved translations | Amazon DynamoDB |
| Every page in Hindi, Kannada and Telugu | Amazon Translate |
| Jal's voice | Amazon Polly |
| Hosting the website | AWS Amplify Hosting |
| Logs and live progress | Amazon CloudWatch |

## Tech stack

| Part | Built with |
| --- | --- |
| Website | Next.js 15, React 19, TypeScript, static export |
| Maps | MapLibre GL, OpenStreetMap |
| Satellite analysis | Python 3.12: pystac-client, odc-stac, rasterio, rioxarray, xarray, NumPy, SciPy, scikit-image |
| Shapes and maps | Shapely, pyproj, OpenStreetMap (Overpass, Nominatim) |
| Images | Pillow |
| AWS access | boto3, AWS CLI |
| Tests | pytest (42 tests) |
| Checking results | Esri World Imagery Wayback, Google Earth Pro |
| Code | GitHub |

## Problems we faced, and how we solved them

**Problems with the satellite data**

- **Clouds and winter smog hide lakes.** Some years there are only a few clear photos. *Fix:* JalRekha only judges a year with enough clear looks, and otherwise says "not sure" rather than guessing.
- **Weeds look like grass from space.** Lakes covered in water hyacinth looked like they'd turned into land. *Fix:* we use infrared light, where water under weeds still shows up, so floating weeds count as lake.
- **The satellite gets fooled at the edges.** Algae and mud at the shoreline looked like dumped soil. *Fix:* we checked every place it marked against sharper photos, and the site only counts the ones that were confirmed.
- **Rice fields look like ponds.** In north-west Delhi, fields are flooded in October, just like ponds. *Fix:* we look at ponds from November to January, after the harvest.

**Technical problems**

- **Satellite libraries are too big for a normal Lambda.** GDAL, rasterio and friends go far past Lambda's zip size limit. *Fix:* we package the analysis as a container image in Amazon ECR and run it on Lambda.
- **An analysis takes two minutes, but an API call can only wait 30 seconds.** API Gateway times out long before a Plot Check finishes. *Fix:* the API starts the worker in the background and returns at once. The worker saves each step to DynamoDB, and the page asks every few seconds, so people watch Jal work through the steps instead of a frozen screen.
- **Scanning all of Delhi was too big for Lambda.** It's a 5,000 × 5,300 pixel grid over seven years, longer than Lambda's 15-minute limit. *Fix:* it runs as a CodeBuild job, which finishes in about 15 minutes and saves straight to S3.
- **The map wouldn't load our satellite images.** Links to S3's global address redirect to a regional address, and that redirect blocks images from other websites (CORS). *Fix:* we sign links against the regional address directly.
- **The same image worked in one place but not on the map.** A photo loaded normally first was cached without CORS permission, so the map refused it later. *Fix:* the map asks for its own copy of each image with CORS turned on.
- **Two deploys at once left the worker on an old version.** Two container builds overlapped and one failed with "ResourceConflictException". *Fix:* one deploy at a time, then we compare the image the Lambda runs with the latest one in ECR.
- **A static website can't know about lakes tracked tomorrow.** The site is built ahead of time, one page per lake, so a lake someone asks to track later had no page. *Fix:* one extra page reads the lake's id from the link and loads its results live.
- **Scripts written on Windows broke on Linux.** Windows line endings made our shell scripts fail inside CodeBuild. *Fix:* a `.gitattributes` rule that always keeps scripts in Linux format.
- **Two AWS accounts, two lake lists.** The live site was reading lake results from an older API that only knew 13 lakes. *Fix:* one API now serves the lake list, results and checks for all 27 lakes.

## How AWS made it easier

- **Getting the data: the Registry of Open Data on AWS.** Years of Sentinel-2, Sentinel-1 and Landsat photos, free and readable straight from S3, in the same region as our code. We never downloaded or stored the archive; each run reads only the small window around one lake.
- **Running the analysis: Lambda with container images, and Step Functions.** Each lake, plot or pond is one short run, and Step Functions runs all lakes side by side with retries. Nothing sits idle between runs.
- **Heavy jobs on demand: CodeBuild.** The whole-Delhi pond scan, flood maps, container builds and tests each ran as a job on a large machine, then switched off.
- **Finding places: Amazon Location Service.** Address and landmark search across India, so people can type a colony name instead of finding their plot on a map.
- **Reaching people in their language: Amazon Translate and Amazon Polly.** The whole site in Hindi, Kannada and Telugu, and an Indian voice (Kajal) for Jal.
- **Keeping it simple to run: DynamoDB, S3, SNS and EventBridge Scheduler.** On-demand storage, private files with short-lived links, a monthly re-check and one email when a lake changes, with no servers to look after.
- **Shipping it: Amplify Hosting.** Push to GitHub, and the site rebuilds and goes live.

## What we learned

1. **Check the photos, not just the numbers.** Our first results looked impressive. Looking at the actual before-and-after photos showed us where they were wrong, and made the final numbers ones we could stand behind.
2. **"We couldn't see it" is an answer.** Saying "not sure" when clouds hide a lake is better than a confident guess.
3. **Finding a problem isn't solving it.** The map was the easy part. The letter to the right office, the public clock, and the satellite checking afterwards are what can actually bring the water back.

## Team

- **[Afreen Hossain](https://www.wemakedevs.org/afreen007)**: UI, AWS, and Plot Check
- **[Abhishek M. Shivanagoudar](https://www.wemakedevs.org/abhishekshiv)**: UI, AWS, and the lake tracking
- **[Akshay R](https://www.wemakedevs.org/imakii)**: video, Delhi's ponds, and the watchlist

## Try it

- **Live site:** [main.d25xaqqlm27lpb.amplifyapp.com](https://main.d25xaqqlm27lpb.amplifyapp.com/)
- **Code:** [github.com/abhishiv17/JalRekha](https://github.com/abhishiv17/JalRekha)

Drop a pin on a plot you know, find the lake nearest your home, or open Delhi's dried-up ponds and pick one near you.

*Satellites show that land changed, not who changed it or whether it was allowed. Always check on the ground and in official records before acting.*

*Built for WeMakeDevs Environmental Hacks, Heat and Water track. Contains modified Copernicus Sentinel data (2019–2026) and Landsat data courtesy of the U.S. Geological Survey, both via the Registry of Open Data on AWS. Lake outlines © OpenStreetMap contributors.*
