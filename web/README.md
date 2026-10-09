# Web app

Next.js (static export) + MapLibre. It reads finished results only (see `contracts/README.md`) and never calls Earth Search.

- `/`: lakes ranked by flagged area and recency, with search
- `/lake/<id>/`: map with year slider and class overlay, area chart, flags, buffer switch (30 m law vs 2025 bill), before/after swipe, "Watch this lake"
- `/lake/<id>/evidence/`: print-ready evidence pack (Save as PDF) with filled complaint and RTI drafts

```bash
npm install
npm run dev        # syncs ../data/out (or ../data/sample) and ../templates into public/, then serves :3000
npm run build      # static site in out/
```

Env (optional):

- `NEXT_PUBLIC_DATA_URL`: results base URL. Default `/data` (synced files). For live AWS results use the API: `https://tlnp8w02m4.execute-api.us-west-2.amazonaws.com`
- `NEXT_PUBLIC_API_URL`: same API, enables "Watch this lake"

To refresh local data from AWS: `aws s3 cp s3://kerewatch-results-468094683747/ ../data/out --recursive --region us-west-2` then `python ../pipeline/scripts/build_index.py ../data/out`.
