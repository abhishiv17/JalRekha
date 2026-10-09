"""Plot Check worker Lambda: the water history of one pin.

Invoked asynchronously by the API Lambda.
Event: {"id": "12.9649_77.4948", "lat": 12.9649, "lon": 77.4948, "address": "..."}
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


def handler(event, context):
    table = boto3.resource("dynamodb").Table(os.environ["PLOT_TABLE"])
    bucket = os.environ["PLOT_BUCKET"]
    pid, lat, lon = event["id"], float(event["lat"]), float(event["lon"])
    started = time.time()
    _set(table, pid, status="running", started=_now())
    try:
        facts, arrays = analyse(lat, lon)
        facts["address"] = event.get("address")
        out = Path(tempfile.mkdtemp()) / pid
        facts["images"] = write_images(out, arrays)
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
