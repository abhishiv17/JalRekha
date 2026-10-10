"""Plot Check worker Lambda: the water history of one pin.

Invoked asynchronously by the API Lambda.
Event: {"id": "12.9649_77.4948", "lat": 12.9649, "lon": 77.4948, "address": "..."}
   or: {"mode": "lake", "id": "lake#osm-w123", "lake_id": "osm-w123"}  ("Track this lake")
   or: {"mode": "pond", "id": "pond#delhi-822", "pond_id": "delhi-822", "city": "delhi"}
       (is there water in this pond now? proof of a revival)
Env:   PLOT_BUCKET, PLOT_TABLE, JALREKHA_DATA, BEDROCK_MODEL (optional)

Writes s3://PLOT_BUCKET/plots/<id>/ (report.json, images) and the report
into the DynamoDB item, so the API can answer without reading S3.
"""

import datetime as dt
import json
import mimetypes
import os
import tempfile
import time
from pathlib import Path

import boto3

from jalrekha.plot import analyse, write_images
from jalrekha.pondcheck import check as pond_check
from jalrekha.track import track
from jalrekha.verdict import verdict


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def _set(table, pid: str, **fields) -> None:
    names = {f"#{k}": k for k in fields}
    values = {f":{k}": v for k, v in fields.items()}
    table.update_item(
        Key={"id": pid},
        UpdateExpression="SET " + ", ".join(f"#{k} = :{k}" for k in fields),
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )


def _progress(table, pid: str):
    """Save each step for the page to show while the check runs (last 40 lines)."""
    lines: list[str] = []

    def say(step: str, line: str, done=None, total=None):
        lines.append(line)
        fields = {"step": step, "log": lines[-40:]}
        if done is not None:
            fields.update(done=done, total=total)
        try:
            _set(table, pid, **fields)
        except Exception as e:  # progress is a nicety; never fail the check on it
            print(f"progress update failed: {e!r}")
    return say


def track_handler(event, table) -> dict:
    """Track one catalogued lake on demand; results go to lakes/<id>/ in the bucket."""
    pid, lake_id = event["id"], event["lake_id"]
    _set(table, pid, status="running", started=_now())
    say = _progress(table, pid)
    try:
        entry = track(lake_id, os.environ["PLOT_BUCKET"], say)
        _set(table, pid, status="done", finished=_now(), flagged_ac=str(entry["flagged_ac"]))
        print(f"{lake_id}: tracked, {entry['flagged_ac']} acres flagged")
        return {"id": pid, "flagged_ac": entry["flagged_ac"]}
    except Exception as e:
        _set(table, pid, status="error", error=f"{type(e).__name__}: {e}"[:1000], finished=_now())
        raise


def pond_handler(event, table) -> dict:
    """A fresh look from space at one pond; the result and a photo go on its case."""
    from shapely.geometry import shape

    pid, pond_id, city = event["id"], event["pond_id"], event["city"]
    bucket = os.environ["PLOT_BUCKET"]
    s3 = boto3.client("s3")
    _set(table, pid, check_status="running", check_started=_now())
    try:
        feats = json.loads(s3.get_object(Bucket=bucket, Key=f"ponds/{city}/ponds.geojson")["Body"].read())["features"]
        f = next(f for f in feats if f["properties"]["id"] == pond_id)
        result, jpg = pond_check(shape(f["geometry"]))
        if jpg:
            key = f"ponds/{city}/checks/{pond_id}/{result['latest_clear']}.jpg"
            s3.put_object(Bucket=bucket, Key=key, Body=jpg, ContentType="image/jpeg")
            result["photo"] = key
        item = table.get_item(Key={"id": pid}).get("Item") or {}
        history = json.loads(item.get("checks", "[]"))
        history = (history + [result])[-12:]
        _set(table, pid, check_status="done", checks=json.dumps(history))
        print(f"{pond_id}: {result['verdict']} ({result.get('wet_share')})")
        return {"id": pid, "verdict": result["verdict"]}
    except Exception as e:
        _set(table, pid, check_status="error", check_error=f"{type(e).__name__}: {e}"[:500])
        raise


def handler(event, context):
    table = boto3.resource("dynamodb").Table(os.environ["PLOT_TABLE"])
    if event.get("mode") == "lake":
        return track_handler(event, table)
    if event.get("mode") == "pond":
        return pond_handler(event, table)
    bucket = os.environ["PLOT_BUCKET"]
    pid, lat, lon = event["id"], float(event["lat"]), float(event["lon"])
    started = time.time()
    _set(table, pid, status="running", started=_now())
    say = _progress(table, pid)
    try:
        facts, arrays = analyse(lat, lon, progress=say)
        facts["address"] = event.get("address")
        out = Path(tempfile.mkdtemp()) / pid
        facts["images"] = write_images(out, arrays)
        say("explain", "Writing your report in English, Kannada, Telugu and Hindi")
        report = {
            "id": pid,
            "facts": facts,
            "verdict": verdict(facts),
            "made": _now(),
            "seconds": round(time.time() - started),
        }
        (out / "report.json").write_text(json.dumps(report, ensure_ascii=False), encoding="utf-8")

        s3 = boto3.client("s3")
        for path in out.rglob("*"):
            if path.is_file():
                key = f"plots/{pid}/{path.relative_to(out).as_posix()}"
                s3.upload_file(str(path), bucket, key,
                               ExtraArgs={"ContentType": mimetypes.guess_type(path.name)[0] or "application/octet-stream"})
        _set(table, pid, status="done", level=report["verdict"]["level"], finished=_now(),
             report=json.dumps(report, ensure_ascii=False))
        print(f"{pid}: {report['verdict']['level']} in {report['seconds']} s")
        return {"id": pid, "level": report["verdict"]["level"]}
    except Exception as e:
        _set(table, pid, status="error", error=f"{type(e).__name__}: {e}"[:1000], finished=_now())
        raise
