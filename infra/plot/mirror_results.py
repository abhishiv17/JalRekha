"""Copy lake results from another JalRekha results API into this account's bucket.

    python infra/plot/mirror_results.py <source API URL> <bucket>

Reads <API>/index.json, then each lake's files the way the web app does
(stats, flags, outline, bounds, summary, and every season's images and water
outline), and writes them to s3://<bucket>/lakes/<id>/. Lakes already in the
bucket are overwritten. Used to bring the first 13 lakes next to new ones, so
one API serves them all.
"""

import json
import sys
import urllib.request

import boto3

TYPES = {".json": "application/json", ".geojson": "application/geo+json", ".png": "image/png"}


def get(url: str) -> bytes | None:
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            return r.read()
    except Exception as e:
        print(f"  missing {url.rsplit('/lakes/', 1)[-1]}: {e}")
        return None


def main(api: str, bucket: str) -> None:
    api = api.rstrip("/")
    s3 = boto3.client("s3")
    index = json.loads(get(f"{api}/index.json"))
    for lake in index["lakes"]:
        lid = lake["id"]
        stats_raw = get(f"{api}/lakes/{lid}/stats.json")
        if not stats_raw:
            continue
        files = {"stats.json": stats_raw}
        for name in ("flags.geojson", "reference.geojson", "bounds.json"):
            body = get(f"{api}/lakes/{lid}/{name}")
            if body:
                files[name] = body
        files["summary.json"] = json.dumps(lake, indent=2).encode()
        for season in (s["season"] for s in json.loads(stats_raw)["seasons"]):
            for name in (f"truecolor/{season}.png", f"overlay/{season}.png", f"water/{season}.geojson"):
                body = get(f"{api}/lakes/{lid}/{name}")
                if body:
                    files[name] = body
        for name, body in files.items():
            ext = name[name.rindex("."):]
            s3.put_object(Bucket=bucket, Key=f"lakes/{lid}/{name}", Body=body,
                          ContentType=TYPES.get(ext, "application/octet-stream"))
        print(f"{lid}: {len(files)} files")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
