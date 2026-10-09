# Hand-check: is each flag real?

The pipeline only says "change detected". Before the video, a person checks every flag against high-resolution historical imagery and records a verdict. The result goes on screen as **"N of M flags confirmed by hand"**: the strongest proof we can show judges, and it must be real, never estimated.

Regenerate this kit after any pipeline run: `cd pipeline && python scripts/make_checklist.py ../data/out ../research`

## What you need

- **Google Earth Pro** (free desktop app; it has the historical imagery slider. The web version doesn't.)
- `flags_to_check.kml`: every flag as an orange outline
- `flags_to_check.csv`: one row per flag; fill in the last four columns (open it in Google Sheets or Excel)

## For each flag (about 3–5 minutes)

1. In Google Earth Pro: **File › Open › flags_to_check.kml**. Double-click a flag in the left panel to fly to it.
2. Turn on **View › Historical Imagery** (the clock icon). A time slider appears at the top.
3. Slide to the **earliest image from 2019 or before**, then to the **latest image**. Also stop on an image around the flag's `first_seen` year.
4. Compare what is **inside the orange outline** across those dates.
5. Fill the row:

| Column | What to write |
| --- | --- |
| `verdict` | `confirmed`, `not confirmed` or `can't tell` (rules below) |
| `what_you_see` | A few words: "debris dumped on lake edge", "new road", "weeds only", "same in all images" |
| `imagery_dates_compared` | e.g. `2019-02, 2022-01, 2025-03` (dates shown on the slider) |
| `checked_by` | Your name |

## Verdict rules (apply the same way to every flag)

- **confirmed**: in the high-resolution imagery, the area inside the outline was water or lake vegetation earlier, and is now bare ground, fill, debris, a road, a structure, or dry grassed land. The change is visible, whether or not it's legal.
- **not confirmed**: the area looks the same across dates (still water or the same weeds), or the change is something the pipeline shouldn't count (a shadow, a cloud artefact, seasonal water level only).
- **can't tell**: no clear high-resolution image for the right years, or the change is too small to judge at that resolution.

Works such as desilting, bunds, walkways or sewage plants still count as **confirmed change**: JalRekha reports change, not legality. Write "works" in `what_you_see` so we can say so on screen (Bellandur is the main case).

## The score

`confirmed / (confirmed + not confirmed)`, leaving out `can't tell`, which is reported separately. Example line for the video: **"27 of 31 checked flags confirmed by hand; 5 couldn't be judged."** Use the real numbers.

## Order of work (most valuable first)

1. **Subedeharana Kere** (1 flag) and **Ameenpur Lake** (9): the real-fill examples for the video.
2. **Jakkur** (5): is the east-side buffer flag the construction site we think it is?
3. **Bellandur** (top 10 of 49 by area): confirm they're works, not fill.
4. The rest.

## Other research jobs before recording

- [ ] **Bellandur**: find a news source for why the lake was drained and excavated from 2021 before saying it on camera.
- [ ] **Hyderabad context**: a source on lake-buffer demolitions there (for "the method drives action"); check the specific lakes before naming any.
- [ ] **Harlur pond**: confirm whether Ambalipura Kelagina Kere is the pond in the Deccan Herald report; if not, find the right outline.
- [ ] **Buffer law**: re-check the KTCDA amendment's status on recording day; show "as of <date>" on screen.
- [ ] **Letters**: confirm the custodian office for each lake you show in the evidence-pack demo.
- [ ] **Credits**: README data credits (Copernicus Sentinel, ATREE-CSEI CC BY, OpenStreetMap ODbL).
