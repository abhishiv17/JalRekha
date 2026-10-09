# Data

- `lakes/lakes.geojson`: the 6 lakes in scope (WGS84), built from the [ATREE-CSEI BBMP lakes KML](https://data.opencity.in/dataset/map-lakes-streams-bengaluru-urban-within-bbmp-area) (CC BY) by `pipeline/scripts/kml_to_lakes.py`. Only names, custodian and area are kept; ward contact fields are dropped.
- `sample/`: hand-made outputs for building the web app. **Not results.**
- `out/`, `cache/`: local pipeline output; git-ignored. Real results live in S3.

| id | ATREE name | ATREE area | Why it's in the set |
| --- | --- | --- | --- |
| `subedeharana-kere` | Infrastructure Corridor (alt. Subbedarana kere) | 9.3 ac | Debris dumped early 2024: a dated fill |
| `pattandur-agrahara` | Pattaduru Agrahara kere-2 | 9.0 ac | Dumping reported from 2017: long-running loss |
| `ambalipura-kelagina` | Ambalipura Kelagina kere | 6.1 ac | **To verify:** candidate for the Harlur/Ambalipura pond report; tests the 10 m pixel limit |
| `sadaramangala` | Kodigehalli lake (alt. Sadaramangala) | 40.5 ac | Large loss, date unclear |
| `yele-mallappa-shetty` | Avalahali kere (alt. Yellamallappashetti) | 364.7 ac | Weeds versus real land change on a big lake |
| `jakkur` | Jakkuru lake | 131.0 ac | Control: should stay quiet |

To add a lake, add it to `LAKES` in `pipeline/scripts/kml_to_lakes.py` and re-run:

```bash
cd pipeline
python scripts/kml_to_lakes.py <atree_lakes.kml> ../data/lakes/lakes.geojson
```
