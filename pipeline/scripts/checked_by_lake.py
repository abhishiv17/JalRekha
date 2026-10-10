"""Sum the flags checked on sharper photos (research/flags_checked.csv) per lake, for the ranking.

    python scripts/checked_by_lake.py <data API URL> ../research/flags_checked.csv ../web/public/insights/checked.json
"""

import csv
import json
import sys
from collections import defaultdict
from urllib.request import urlopen

FIELD = {"confirmed": "confirmed_ac", "not confirmed": "not_confirmed_ac"}


def main(api: str, csv_path: str, out: str) -> None:
    with urlopen(f"{api.rstrip('/')}/index.json", timeout=60) as r:
        ids = {l["name"]: l["id"] for l in json.load(r)["lakes"]}
    by_lake = defaultdict(lambda: {"checked": 0, "confirmed_ac": 0.0, "not_confirmed_ac": 0.0, "unclear_ac": 0.0})
    with open(csv_path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            lake = ids.get(row["lake"])
            if not lake:
                print(f"no tracked lake called {row['lake']!r}; skipped")
                continue
            o = by_lake[lake]
            o["checked"] += 1
            o[FIELD.get(row["verdict"], "unclear_ac")] += float(row["area_ac"] or 0)
    result = {k: {f: round(v, 2) if isinstance(v, float) else v for f, v in o.items()} for k, o in sorted(by_lake.items())}
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=1)
        f.write("\n")
    print(f"{len(result)} lakes in {out}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
