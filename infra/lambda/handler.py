"""Lambda entry point: run one lake and upload its results to S3.

Event: {"lake": "subedeharana-kere", "years": [2019, ..., 2026]}  (years optional)
Env:   RESULTS_BUCKET (required), LAKES_FILE, ALERTS_TOPIC_ARN, LAKES_TABLE (optional)
"""

import json
import os
import shutil
from decimal import Decimal
from pathlib import Path

import boto3

from jalrekha import export
from jalrekha.config import YEARS
from jalrekha.run import run


def _latest_dry(stats: dict) -> str:
    return max(s["season"] for s in stats["seasons"] if s["season"].endswith("-dry"))


def _previous_latest(bucket: str, lake_id: str) -> str | None:
    """Latest dry season in the results already in S3, if any."""
    try:
        obj = boto3.client("s3").get_object(Bucket=bucket, Key=f"lakes/{lake_id}/stats.json")
        return _latest_dry(json.loads(obj["Body"].read()))
    except Exception:  # first run, or unreadable: treat as new
        return None


def _alert_new_flags(lake_dir: Path, lake_id: str, previous_latest: str | None) -> int:
    """Email watchers once, when a newly processed dry season brings new flags.

    Monthly re-scans of the same season don't re-send the same alert.
    """
    topic = os.environ.get("ALERTS_TOPIC_ARN")
    if not topic:
        return 0
    stats = json.loads((lake_dir / "stats.json").read_text(encoding="utf-8"))
    latest = _latest_dry(stats)
    if latest == previous_latest:
        return 0
    flags = json.loads((lake_dir / "flags.geojson").read_text(encoding="utf-8"))["features"]
    new = [f["properties"] for f in flags if f["properties"]["first_seen"] == latest]
    if not new:
        return 0
    area = sum(f["area_ac"] for f in new)
    boto3.client("sns").publish(
        TopicArn=topic,
        Subject=f"JalRekha: new change at {stats['name']}",
        Message=(
            f"JalRekha found {len(new)} new change flag(s) at {stats['name']} "
            f"in the {latest} imagery, about {area:.2f} acres in total.\n\n"
            "This is change detected from satellite imagery, not proof of encroachment. "
            "Open the lake page for images, coordinates and an evidence pack."
        ),
        MessageAttributes={"lake": {"DataType": "String", "StringValue": lake_id}},
    )
    return len(new)


def _store_in_dynamodb(lake_dir: Path, lake_id: str, entry: dict) -> int:
    """Lake summary, per-season statistics and flags, one item each (pk = lake id)."""
    table = os.environ.get("LAKES_TABLE")
    if not table:
        return 0
    ddb = boto3.resource("dynamodb").Table(table)
    stats = json.loads((lake_dir / "stats.json").read_text(encoding="utf-8"), parse_float=Decimal)
    flags = json.loads((lake_dir / "flags.geojson").read_text(encoding="utf-8"), parse_float=Decimal)["features"]
    items = [{"pk": lake_id, "sk": "summary", **json.loads(json.dumps(entry), parse_float=Decimal),
              "as_of": stats["as_of"], "reference_area_ac": stats["reference_area_ac"]}]
    for season in stats["seasons"]:
        row = {k: v for k, v in season.items() if k != "scene_ids" and v is not None}
        items.append({"pk": lake_id, "sk": f"season#{season['season']}", **row, "scenes": len(season["scene_ids"])})
    for f in flags:
        p = {k: v for k, v in f["properties"].items() if k != "scene_ids"}
        items.append({"pk": lake_id, "sk": f"flag#{p['flag_id']}", **p})
    for item in items:
        ddb.put_item(Item=item)
    return len(items)


def handler(event, context):
    lake_id = event["lake"]
    years = event.get("years") or list(YEARS)
    bucket = os.environ["RESULTS_BUCKET"]

    previous_latest = _previous_latest(bucket, lake_id)
    out = Path("/tmp/out")
    shutil.rmtree(out, ignore_errors=True)
    run(lake_id, Path(os.environ["LAKES_FILE"]), out, years)
    lake_dir = out / "lakes" / lake_id
    # Branches run in parallel, so each writes its own index entry; the API
    # lists lakes/*/summary.json instead of sharing one index.json.
    entry = json.loads((out / "index.json").read_text(encoding="utf-8"))["lakes"][0]
    (lake_dir / "summary.json").write_text(json.dumps(entry, indent=2), encoding="utf-8")
    n = export.upload_dir(lake_dir, bucket, prefix=f"lakes/{lake_id}/")
    alerts = _alert_new_flags(lake_dir, lake_id, previous_latest)
    stored = _store_in_dynamodb(lake_dir, lake_id, entry)
    return {"lake": lake_id, "files": n, "bucket": bucket, "new_flags_alerted": alerts, "dynamodb_items": stored}
