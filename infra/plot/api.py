"""Plot Check API Lambda (behind an API Gateway HTTP API).

    GET  /geocode?q=<text>          address search (Amazon Location Service), India only
    POST /check   {"lat", "lon", "address"?}  start a check, or reuse the stored one
    GET  /check/<id>                status, and the report with image links when done
    GET  /index.json                tracked lakes, from lakes/*/summary.json (same as infra/api)
    GET  /lakes/<id>/<file...>      302 to a short-lived presigned S3 URL (same as infra/api)
    POST /track/<osm-id>            start tracking a catalogued lake (or say it is already tracked)
    GET  /track/<osm-id>            status and live steps of that run
    GET  /ponds/cases               every adopted pond: who, which agency, stage, clock, space checks
    GET  /ponds/<pond-id>           one pond's case
    POST /ponds/<pond-id>/adopt     {"name", "kind", "agency"} -> the case and a key to update it
    POST /ponds/<pond-id>/stage     {"key", "stage", "note"?}  move the case forward
    POST /ponds/<pond-id>/check     look at the pond from space now (worker), at most every few hours
    POST /translate {"lang", "texts"} the site's words in Hindi, Kannada or Telugu (Amazon Translate, cached)
    POST /speak     {"lang", "text"}  a link to Jal reading the text aloud (Amazon Polly, cached in S3)

The id is the pin rounded to 4 decimals (about 11 m), so the same spot is
analysed once and shared links stay stable.

Env: PLOT_TABLE, PLOT_BUCKET, WORKER_FUNCTION
"""

import datetime as dt
import json
import os
import re

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

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


LAKE_ID = re.compile(r"^[a-z0-9-]{1,64}$")
LAKE_FILE = re.compile(r"^[A-Za-z0-9_./-]{1,200}$")


def _s3():
    # Regional endpoint: the global one redirects, and the redirect has no CORS headers.
    return boto3.client("s3", region_name=os.environ["AWS_REGION"],
                        config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}))


def lake_index() -> dict:
    s3, bucket, lakes = _s3(), os.environ["PLOT_BUCKET"], []
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix="lakes/", Delimiter="/"):
        for prefix in page.get("CommonPrefixes", []):
            try:
                lakes.append(json.loads(s3.get_object(Bucket=bucket, Key=f"{prefix['Prefix']}summary.json")["Body"].read()))
            except s3.exceptions.NoSuchKey:
                continue
    lakes.sort(key=lambda l: l.get("latest_first_seen") or "", reverse=True)
    lakes.sort(key=lambda l: l.get("flagged_ac", 0), reverse=True)
    return {"generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "lakes": lakes}


def lake_file(lake: str, path: str) -> dict:
    if not LAKE_ID.match(lake) or not LAKE_FILE.match(path) or ".." in path:
        return _resp(400, {"error": "bad path"})
    url = _s3().generate_presigned_url(
        "get_object", Params={"Bucket": os.environ["PLOT_BUCKET"], "Key": f"lakes/{lake}/{path}"}, ExpiresIn=3600)
    return {"statusCode": 302, "headers": {"Location": url, **CORS, "Cache-Control": "max-age=600"}, "body": ""}


TRACK_ID = re.compile(r"^osm-[wr]\d{1,12}$")

# ---- Pond cases: a lost pond, an adopter, the agency that owns the land, a clock, proof from space.

POND_ID = re.compile(r"^(delhi)-b?\d{1,7}$")
STAGES = ["adopted", "sent", "answered", "inspected", "work_started", "water_back"]
AGENCIES = {"dda", "mcd", "djb", "pwd", "ifc", "forest", "revenue", "unsure"}
ADOPTERS = {"rwa", "school", "college", "company", "ngo", "person"}
ANSWER_DAYS = 30  # an agency that hasn't answered a letter in this long is overdue
CHECK_EVERY_S = 6 * 3600
_ponds: dict[str, dict] = {}


def _pond(city: str, pond_id: str) -> dict | None:
    """The pond's properties from the scan (cached for the life of the Lambda)."""
    if city not in _ponds:
        body = _s3().get_object(Bucket=os.environ["PLOT_BUCKET"], Key=f"ponds/{city}/ponds.geojson")["Body"].read()
        _ponds[city] = {f["properties"]["id"]: f["properties"] for f in json.loads(body)["features"]}
    return _ponds[city].get(pond_id)


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def _hash(key: str) -> str:
    import hashlib

    return hashlib.sha256(key.encode()).hexdigest()


def public_case(item: dict) -> dict:
    """What anyone may see of a case, with the clock and the satellite's verdict worked out."""
    history = json.loads(item.get("history", "[]"))
    checks = json.loads(item.get("checks", "[]"))
    out = {k: item.get(k) for k in ("pond_id", "city", "name", "kind", "agency", "district", "stage", "created")}
    out["history"] = history
    out["checks"] = checks
    out["check_status"] = item.get("check_status")
    sent = next((h["at"] for h in history if h["stage"] == "sent"), None)
    if item.get("stage") == "sent" and sent:
        waited = int(_age_s(sent) // 86400)
        out["waiting_days"] = waited
        out["overdue"] = waited > ANSWER_DAYS
    latest = next((c for c in reversed(checks) if c.get("verdict") in ("water", "some_water", "dry")), None)
    if latest:
        out["space"] = {"verdict": latest["verdict"], "date": latest.get("latest_clear"), "wet_share": latest.get("wet_share")}
        claimed = next((h["at"] for h in history if h["stage"] == "water_back"), None)
        out["revived"] = latest["verdict"] == "water"
        # Claimed water back, but a later clear look from space finds none.
        out["claim_not_seen"] = bool(claimed and latest["verdict"] == "dry" and latest.get("checked", "") > claimed)
    if item.get("check_status") == "running" and _age_s(item.get("check_started")) > RUNNING_TIMEOUT_S:
        out["check_status"] = "error"
    for c in checks:
        if c.get("photo"):
            c["photo_url"] = _s3().generate_presigned_url(
                "get_object", Params={"Bucket": os.environ["PLOT_BUCKET"], "Key": c["photo"]}, ExpiresIn=3600)
    return out


def pond_cases() -> list[dict]:
    items, kw = [], {"FilterExpression": "begins_with(#i, :p)", "ExpressionAttributeNames": {"#i": "id"},
                     "ExpressionAttributeValues": {":p": "pond#"}}
    while True:
        page = table().scan(**kw)
        items += page.get("Items", [])
        if "LastEvaluatedKey" not in page:
            break
        kw["ExclusiveStartKey"] = page["LastEvaluatedKey"]
    return [public_case(i) for i in items if i.get("stage")]


def adopt(pond_id: str, body: dict) -> dict:
    import secrets

    city = POND_ID.match(pond_id).group(1)
    pond = _pond(city, pond_id)
    if not pond:
        return _resp(404, {"error": "No such pond."})
    name = (body.get("name") or "").strip()[:120]
    kind, agency = body.get("kind"), body.get("agency")
    if len(name) < 3 or kind not in ADOPTERS or agency not in AGENCIES:
        return _resp(400, {"error": "Give your group's name, what kind of group it is, and the agency."})
    pid = f"pond#{pond_id}"
    old = table().get_item(Key={"id": pid}).get("Item")
    if old and old.get("stage"):
        return _resp(409, {"error": f"{old.get('name')} already looks after this pond.", "case": public_case(old)})
    key = secrets.token_urlsafe(18)
    now = _now()
    item = {"id": pid, "pond_id": pond_id, "city": city, "name": name, "kind": kind, "agency": agency,
            "district": pond.get("district") or "", "stage": "adopted", "created": now, "key_hash": _hash(key),
            "history": json.dumps([{"stage": "adopted", "at": now, "note": f"Adopted by {name}"}]),
            "checks": (old or {}).get("checks", "[]")}
    table().put_item(Item=item)
    return _resp(201, {"case": public_case(item), "key": key})


def move_stage(pond_id: str, body: dict) -> dict:
    pid = f"pond#{pond_id}"
    item = table().get_item(Key={"id": pid}).get("Item")
    if not item or not item.get("stage"):
        return _resp(404, {"error": "Nobody has adopted this pond yet."})
    if _hash(str(body.get("key", ""))) != item.get("key_hash"):
        return _resp(403, {"error": "Only the group that adopted this pond can update it."})
    stage = body.get("stage")
    if stage not in STAGES or STAGES.index(stage) <= STAGES.index(item["stage"]):
        return _resp(400, {"error": "A case only moves forward."})
    history = json.loads(item.get("history", "[]")) + [
        {"stage": stage, "at": _now(), "note": (body.get("note") or "").strip()[:500]}]
    table().update_item(Key={"id": pid}, UpdateExpression="SET #s = :s, #h = :h",
                        ExpressionAttributeNames={"#s": "stage", "#h": "history"},
                        ExpressionAttributeValues={":s": stage, ":h": json.dumps(history)})
    item.update(stage=stage, history=json.dumps(history))
    return _resp(200, {"case": public_case(item)})


def start_pond_check(pond_id: str) -> dict:
    city = POND_ID.match(pond_id).group(1)
    if not _pond(city, pond_id):
        return _resp(404, {"error": "No such pond."})
    pid = f"pond#{pond_id}"
    item = table().get_item(Key={"id": pid}).get("Item") or {}
    if item.get("check_status") == "running" and _age_s(item.get("check_started")) < RUNNING_TIMEOUT_S:
        return _resp(202, {"check_status": "running"})
    last = json.loads(item.get("checks", "[]"))
    if last and _age_s(last[-1].get("checked")) < CHECK_EVERY_S:
        return _resp(200, {"check_status": "done", "fresh": True})
    now = _now()
    if item:
        table().update_item(Key={"id": pid}, UpdateExpression="SET check_status = :r, check_started = :t",
                            ExpressionAttributeValues={":r": "running", ":t": now})
    else:  # a check before anyone adopts: keep it, so the adopter starts with it
        table().put_item(Item={"id": pid, "pond_id": pond_id, "city": city, "check_status": "running", "check_started": now})
    boto3.client("lambda").invoke(
        FunctionName=os.environ["WORKER_FUNCTION"], InvocationType="Event",
        Payload=json.dumps({"mode": "pond", "id": pid, "pond_id": pond_id, "city": city}))
    return _resp(202, {"check_status": "running"})


def _body(event: dict) -> dict:
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        import base64

        raw = base64.b64decode(raw).decode("utf-8")
    return json.loads(raw)


def pond_route(method: str, path: str, event: dict) -> dict | None:
    if method == "GET" and path == "/ponds/cases":
        return _resp(200, {"cases": pond_cases(), "answer_days": ANSWER_DAYS})
    m = re.match(r"^/ponds/([^/]+)(?:/(adopt|stage|check))?$", path)
    if not m:
        return None
    pond_id, action = m.group(1), m.group(2)
    if not POND_ID.match(pond_id):
        return _resp(400, {"error": "Not a pond id."})
    body = _body(event) if method == "POST" else {}
    if method == "GET" and not action:
        item = table().get_item(Key={"id": f"pond#{pond_id}"}).get("Item")
        return _resp(200, {"case": public_case(item) if item else None})
    if method == "POST" and action == "adopt":
        return adopt(pond_id, body)
    if method == "POST" and action == "stage":
        return move_stage(pond_id, body)
    if method == "POST" and action == "check":
        return start_pond_check(pond_id)
    return _resp(405, {"error": "Method not allowed."})


def _tracked(lake_id: str) -> bool:
    try:
        _s3().head_object(Bucket=os.environ["PLOT_BUCKET"], Key=f"lakes/{lake_id}/summary.json")
        return True
    except Exception:
        return False


def start_track(lake_id: str) -> dict:
    if _tracked(lake_id):
        return {"id": lake_id, "status": "done"}
    pid = f"lake#{lake_id}"
    item = table().get_item(Key={"id": pid}).get("Item")
    if item and item["status"] in ("queued", "running") and _age_s(item.get("created")) < RUNNING_TIMEOUT_S:
        return {"id": lake_id, "status": item["status"]}
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    table().put_item(Item={"id": pid, "status": "queued", "created": now})
    boto3.client("lambda").invoke(
        FunctionName=os.environ["WORKER_FUNCTION"], InvocationType="Event",
        Payload=json.dumps({"mode": "lake", "id": pid, "lake_id": lake_id}),
    )
    return {"id": lake_id, "status": "queued"}


def get_track(lake_id: str) -> dict:
    item = table().get_item(Key={"id": f"lake#{lake_id}"}).get("Item")
    if not item:
        return {"id": lake_id, "status": "done" if _tracked(lake_id) else "none"}
    out = {"id": lake_id, "status": item["status"], "created": item.get("created")}
    if item["status"] in ("queued", "running"):
        if _age_s(item.get("created")) > RUNNING_TIMEOUT_S:
            out.update(status="error", error="Tracking took too long; start it again.")
        else:
            out["progress"] = {"step": item.get("step", "queued"), "done": int(item.get("done", 0)),
                               "total": int(item.get("total", 0)), "log": item.get("log", [])}
    if item["status"] == "error":
        out["error"] = item.get("error")
    return out


# --- The site in four languages, and Jal's voice ---------------------------------------------
# Every string is translated once by Amazon Translate and kept in the table (id "i18n#<lang>#<hash>"),
# so a page that has been read before costs nothing. Speech is made once by Amazon Polly and kept in
# S3 (speech/<voice>/<hash>.mp3); the API answers with a short-lived link to it.

TRANSLATE_LANGS = {"hi", "kn", "te"}
MAX_TEXTS, MAX_TEXT_CHARS, MAX_SPEECH_CHARS = 60, 600, 900
# Names that must stay as they are in every language.
KEEP = re.compile(r"\b(JalRekha|Jal|Plot Check|Sentinel-[12]|AWS|Amazon [A-Z][a-z]+|OpenStreetMap|RTI|KTCDA)\b")
# Polly's Indian voice speaks Indian English and Hindi; there is no Kannada or Telugu voice,
# so the site reads those with the visitor's own device voice.
VOICES = {"en": ("en-IN", "Kajal"), "hi": ("hi-IN", "Kajal")}


def _protect(text: str) -> str:
    from html import escape

    out, pos = [], 0
    for m in KEEP.finditer(text):
        out.append(escape(text[pos:m.start()], quote=False))
        out.append(f'<span translate="no">{escape(m.group(0), quote=False)}</span>')
        pos = m.end()
    out.append(escape(text[pos:], quote=False))
    return "".join(out)


def _unprotect(html_text: str) -> str:
    from html import unescape

    return unescape(re.sub(r"</?span[^>]*>", "", html_text))


def translate_texts(lang: str, texts: list[str]) -> list[str]:
    from concurrent.futures import ThreadPoolExecutor

    keys = [f"i18n#{lang}#{_hash(t)}" for t in texts]
    found: dict[str, str] = {}
    unique = list(dict.fromkeys(keys))
    db = boto3.resource("dynamodb")
    for i in range(0, len(unique), 100):
        res = db.batch_get_item(RequestItems={os.environ["PLOT_TABLE"]: {
            "Keys": [{"id": k} for k in unique[i:i + 100]], "ProjectionExpression": "#i, #t",
            "ExpressionAttributeNames": {"#i": "id", "#t": "text"}}})
        for item in res["Responses"].get(os.environ["PLOT_TABLE"], []):
            found[item["id"]] = item["text"]

    missing = {k: t for k, t in zip(keys, texts) if k not in found}
    if missing:
        tr = boto3.client("translate")

        def one(item):
            key, text = item
            r = tr.translate_text(Text=_protect(text), SourceLanguageCode="en", TargetLanguageCode=lang)
            return key, _unprotect(r["TranslatedText"])

        with ThreadPoolExecutor(max_workers=8) as pool:
            done = list(pool.map(one, missing.items()))
        with table().batch_writer() as batch:
            for key, text in done:
                batch.put_item(Item={"id": key, "text": text, "lang": lang, "created": _now()})
                found[key] = text
    return [found[k] for k in keys]


def speech_link(lang: str, text: str) -> dict | None:
    if lang not in VOICES:
        return None
    code, voice = VOICES[lang]
    s3, bucket = _s3(), os.environ["PLOT_BUCKET"]
    key = f"speech/{voice}-{code}/{_hash(text)}.mp3"
    try:
        s3.head_object(Bucket=bucket, Key=key)
    except ClientError:
        polly = boto3.client("polly")
        # The most natural engine first; fall back if this region doesn't offer it.
        for engine, who in (("generative", voice), ("neural", voice), ("standard", "Aditi")):
            try:
                audio = polly.synthesize_speech(Text=text, OutputFormat="mp3", VoiceId=who, Engine=engine,
                                                LanguageCode=code)
                break
            except ClientError:
                if engine == "standard":
                    raise
        s3.put_object(Bucket=bucket, Key=key, Body=audio["AudioStream"].read(), ContentType="audio/mpeg",
                      CacheControl="max-age=31536000")
    url = s3.generate_presigned_url("get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=3600)
    return {"url": url, "voice": voice}


def language_route(method: str, path: str, event: dict) -> dict | None:
    if method != "POST" or path not in ("/translate", "/speak"):
        return None
    body = _body(event)
    lang = str(body.get("lang", ""))
    try:
        return _language(path, lang, body)
    except ClientError as e:  # Translate or Polly said no: the site keeps English / the device voice
        print(f"{path} failed: {e!r}"[:500])
        return _resp(503, {"error": "Translation or speech is unavailable right now."})


def _language(path: str, lang: str, body: dict) -> dict:
    if path == "/translate":
        texts = body.get("texts")
        if lang not in TRANSLATE_LANGS or not isinstance(texts, list) or not 0 < len(texts) <= MAX_TEXTS:
            return _resp(400, {"error": f"Send lang (hi, kn or te) and 1 to {MAX_TEXTS} texts."})
        if not all(isinstance(t, str) and 0 < len(t) <= MAX_TEXT_CHARS for t in texts):
            return _resp(400, {"error": f"Each text must be 1 to {MAX_TEXT_CHARS} characters."})
        return _resp(200, {"lang": lang, "texts": translate_texts(lang, texts)})
    text = str(body.get("text", "")).strip()
    if not 0 < len(text) <= MAX_SPEECH_CHARS:
        return _resp(400, {"error": f"Send 1 to {MAX_SPEECH_CHARS} characters of text."})
    link = speech_link(lang, text)
    return _resp(200, link) if link else _resp(404, {"error": "No voice for this language; use the device voice."})


def handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path = event.get("rawPath", "/")
    if method == "OPTIONS":
        return {"statusCode": 204, "headers": CORS, "body": ""}
    try:
        r = language_route(method, path, event)
        if r:
            return r

        if path.startswith("/ponds/"):
            r = pond_route(method, path, event)
            if r:
                return r

        t = re.match(r"^/track/([^/]+)$", path)
        if t:
            if not TRACK_ID.match(t.group(1)):
                return _resp(400, {"error": "Not a catalogue lake id."})
            return _resp(202, start_track(t.group(1))) if method == "POST" else _resp(200, get_track(t.group(1)))

        if method == "GET" and path == "/index.json":
            r = _resp(200, lake_index())
            r["headers"]["Cache-Control"] = "max-age=300"
            return r

        m = re.match(r"^/lakes/([^/]+)/(.+)$", path)
        if method == "GET" and m:
            return lake_file(m.group(1), m.group(2))

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
