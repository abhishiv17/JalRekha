"""Plot Check API Lambda (behind an API Gateway HTTP API).

    GET  /geocode?q=<text>          address search (Amazon Location Service), India only
    POST /check   {"lat", "lon", "address"?}  start a check, or reuse the stored one
    GET  /check/<id>                status, and the report with image links when done

The id is the pin rounded to 4 decimals (about 11 m), so the same spot is
analysed once and shared links stay stable.

Env: PLOT_TABLE, PLOT_BUCKET, WORKER_FUNCTION
"""

import datetime as dt
import json
import os

import boto3
from botocore.config import Config

INDIA = (6.0, 68.0, 37.5, 97.5)  # south, west, north, east
STALE_DAYS = 30  # re-run a stored check after this long (new imagery)
RUNNING_TIMEOUT_S = 20 * 60  # a "running" check older than this has died

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
}

_table = None


def table():
    global _table
    if _table is None:
        _table = boto3.resource("dynamodb").Table(os.environ["PLOT_TABLE"])
    return _table


def _resp(status: int, body) -> dict:
    return {"statusCode": status, "headers": {"Content-Type": "application/json", **CORS},
            "body": json.dumps(body, ensure_ascii=False, default=str)}


def _age_s(iso: str | None) -> float:
    if not iso:
        return float("inf")
    return (dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(iso)).total_seconds()


def plot_id(lat: float, lon: float) -> str:
    return f"{lat:.4f}_{lon:.4f}"


def geocode(q: str) -> list[dict]:
    """Landmarks (lakes, layouts, apartments) from text search, then street addresses."""
    places = boto3.client("geo-places")
    common = {"MaxResults": 4, "Language": "en", "PoliticalView": "IND"}
    s, w, n, e = INDIA
    found = places.search_text(QueryText=q[:200], Filter={"BoundingBox": [w, s, e, n], "IncludeCountries": ["IND"]},
                               **common).get("ResultItems", [])
    found += places.geocode(QueryText=q[:200], Filter={"IncludeCountries": ["IND"]}, **common).get("ResultItems", [])
    out, seen = [], set()
    for it in found:
        if not it.get("Position") or it["Title"] in seen:
            continue
        seen.add(it["Title"])
        out.append({"label": it["Title"], "lat": it["Position"][1], "lon": it["Position"][0], "type": it.get("PlaceType")})
    return out[:6]


def reverse_label(lat: float, lon: float) -> str | None:
    try:
        res = boto3.client("geo-places").reverse_geocode(QueryPosition=[lon, lat], MaxResults=1,
                                                         Language="en", PoliticalView="IND")
        items = res.get("ResultItems", [])
        return items[0]["Title"] if items else None
    except Exception as e:  # the label is a nicety; never block a check on it
        print(f"reverse geocode failed: {e!r}")
        return None


def start_check(lat: float, lon: float, address: str | None) -> dict:
    pid = plot_id(lat, lon)
    item = table().get_item(Key={"id": pid}).get("Item")
    if item:
        fresh = item["status"] == "done" and _age_s(item.get("finished")) < STALE_DAYS * 86400
        busy = item["status"] in ("queued", "running") and _age_s(item.get("created")) < RUNNING_TIMEOUT_S
        if fresh or busy:
            return {"id": pid, "status": item["status"], "reused": True}

    address = address or reverse_label(lat, lon)
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    table().put_item(Item={"id": pid, "status": "queued", "lat": str(lat), "lon": str(lon),
                           "address": address or "", "created": now})
    boto3.client("lambda").invoke(
        FunctionName=os.environ["WORKER_FUNCTION"],
        InvocationType="Event",
        Payload=json.dumps({"id": pid, "lat": round(lat, 4), "lon": round(lon, 4), "address": address}),
    )
    return {"id": pid, "status": "queued", "reused": False}


def get_check(pid: str) -> dict | None:
    item = table().get_item(Key={"id": pid}).get("Item")
    if not item:
        return None
    out = {"id": pid, "status": item["status"], "address": item.get("address") or None,
           "lat": float(item["lat"]), "lon": float(item["lon"]), "created": item.get("created")}
    if item["status"] == "error":
        out["error"] = item.get("error")
    if item["status"] in ("queued", "running"):
        out["progress"] = {
            "step": item.get("step", "queued"),
            "done": int(item.get("done", 0)),
            "total": int(item.get("total", 0)),
            "log": item.get("log", []),
        }
    if item["status"] in ("queued", "running") and _age_s(item.get("created")) > RUNNING_TIMEOUT_S:
        out["status"] = "error"
        out["error"] = "The check took too long; start it again."
    if item["status"] == "done":
        report = json.loads(item["report"])
        # Regional endpoint: the global one redirects, and the redirect has no CORS headers.
        s3 = boto3.client("s3", region_name=os.environ["AWS_REGION"],
                          config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}))
        for img in report["facts"].get("images", {}).values():
            img["url"] = s3.generate_presigned_url(
                "get_object", Params={"Bucket": os.environ["PLOT_BUCKET"], "Key": f"plots/{pid}/{img['path']}"},
                ExpiresIn=3600)
        out["report"] = report
    return out


def handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path = event.get("rawPath", "/")
    if method == "OPTIONS":
        return {"statusCode": 204, "headers": CORS, "body": ""}
    try:
        if method == "GET" and path == "/geocode":
            q = (event.get("queryStringParameters") or {}).get("q", "").strip()
            return _resp(200, {"results": geocode(q) if len(q) >= 3 else []})

        if method == "POST" and path == "/check":
            body = json.loads(event.get("body") or "{}")
            lat, lon = float(body["lat"]), float(body["lon"])
            s, w, n, e = INDIA
            if not (s <= lat <= n and w <= lon <= e):
                return _resp(400, {"error": "Plot Check covers India only."})
            address = (body.get("address") or "").strip()[:300] or None
            return _resp(202, start_check(lat, lon, address))

        if method == "GET" and path.startswith("/check/"):
            found = get_check(path.removeprefix("/check/"))
            return _resp(200, found) if found else _resp(404, {"error": "No such check."})

        return _resp(404, {"error": "Not found."})
    except (KeyError, ValueError, json.JSONDecodeError) as e:
        return _resp(400, {"error": f"Bad request: {e}"})
