"""Run the lake pipeline for several lakes and publish each one to S3 the way the
results API reads them: lakes/<id>/... plus lakes/<id>/summary.json (its index entry).

    python scripts/run_lakes.py --bucket <bucket> --jobs 3 najafgarh-jheel bhalswa ...

A lake that fails (too few clear seasons, no scenes) is reported and skipped.
"""

import argparse
import json
import tempfile
import traceback
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from jalrekha import export
from jalrekha.config import YEARS
from jalrekha.lakes import DEFAULT_LAKES_FILE
from jalrekha.run import run


def one(lake: str, bucket: str) -> str:
    out = Path(tempfile.mkdtemp())
    try:
        run(lake, DEFAULT_LAKES_FILE, out, list(YEARS), None)
        index = json.loads((out / "index.json").read_text(encoding="utf-8"))
        entry = next(l for l in index["lakes"] if l["id"] == lake)
        (out / "lakes" / lake / "summary.json").write_text(json.dumps(entry, indent=2), encoding="utf-8")
        n = export.upload_dir(out / "lakes" / lake, bucket, f"lakes/{lake}/")
        return f"OK   {lake}: {entry['flagged_ac']} acres flagged, {n} files"
    except BaseException as e:  # SystemExit from run() included: report, don't stop the others
        traceback.print_exc()
        return f"FAIL {lake}: {e!r}"


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("lakes", nargs="+")
    p.add_argument("--bucket", required=True)
    p.add_argument("--jobs", type=int, default=2)
    args = p.parse_args()
    results = []
    with ProcessPoolExecutor(max_workers=args.jobs) as pool:
        futures = [pool.submit(one, lake, args.bucket) for lake in args.lakes]
        for f in as_completed(futures):
            print(f.result(), flush=True)
            results.append(f.result())
    print("\n".join(sorted(results)))


if __name__ == "__main__":
    main()
