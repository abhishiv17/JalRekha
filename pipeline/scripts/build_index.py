"""Rebuild index.json from lakes/*/summary.json (e.g. after `aws s3 sync` of results).

    python scripts/build_index.py ../data/out
"""

import datetime as dt
import json
import sys
from pathlib import Path


def main(root: Path) -> None:
    lakes = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(root.glob("lakes/*/summary.json"))]
    lakes.sort(key=lambda l: l.get("latest_first_seen") or "", reverse=True)
    lakes.sort(key=lambda l: l.get("flagged_ac", 0), reverse=True)
    generated = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    (root / "index.json").write_text(json.dumps({"generated": generated, "lakes": lakes}, indent=2), encoding="utf-8")
    print(f"{len(lakes)} lakes -> {root / 'index.json'}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
