# JalRekha web app

Next.js (static export) + MapLibre. It reads finished results only (see `contracts/README.md`) and never calls Earth Search.

- `/`: home: the problem, how it works, analysed lakes, evidence workflow, methodology and credits
- `/lakes/`: analysed lakes and the India catalogue: search, status and category filters, sorting, India map
- `/lake/<id>/`: lake analysis: map with dry-season timeline and layers, change summary, buffer (30 m law vs proposed), before/after swipe, flags, methodology, watch
- `/lake/<id>/evidence/`: evidence pack: PDF via print, GeoJSON, KML, scene list, complaint and RTI drafts
- `/lakes/view/?id=…`: a catalogued lake that is queued, not yet analysed
- `/watchlist/`: lakes watched from this browser, with stop watching

```bash
npm install
npm run dev        # syncs ../data/out (or ../data/sample) and ../templates into public/, then serves :3000
npm run build      # static site in out/
```

Env (optional):

- `NEXT_PUBLIC_DATA_URL`: results base URL. Default `/data` (synced files). For live AWS results use the API: `https://tlnp8w02m4.execute-api.us-west-2.amazonaws.com`
- `NEXT_PUBLIC_API_URL`: same API, enables "Watch this lake"

To refresh local data from AWS: `aws s3 cp s3://kerewatch-results-468094683747/ ../data/out --recursive --region us-west-2` then `python ../pipeline/scripts/build_index.py ../data/out`.
