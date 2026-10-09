"""KereWatch API (API Gateway HTTP API -> this Lambda).

Serves results with the same paths the web app reads as static files:
    GET  /index.json              lake list, built from lakes/*/summary.json
    GET  /lakes/<id>/<file...>    302 to a short-lived presigned S3 URL
    POST /watch {lake, email}     store the watcher; SNS emails a confirmation link

Env: RESULTS_BUCKET, WATCHERS_TABLE, ALERTS_TOPIC_ARN
"""

import json
import os
import re
from datetime import datetime, timezone

import boto3

BUCKET = os.environ["RESULTS_BUCKET"]
s3 = boto3.client("s3")
ddb = boto3.client("dynamodb")
sns = boto3.client("sns")

LAKE_ID = re.compile(r"^[a-z0-9-]{1,64}$")
FILE = re.compile(r"^[A-Za-z0-9_./-]{1,200}$")
EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$")
CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type"}


def _resp(status: int, body=None, headers=None):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json", **CORS, **(headers or {})},
        "body": "" if body is None else json.dumps(body),
    }


def _index():
    lakes = []
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=BUCKET, Prefix="lakes/", Delimiter="/"):
        for prefix in page.get("CommonPrefixes", []):
            try:
                obj = s3.get_object(Bucket=BUCKET, Key=f"{prefix['Prefix']}summary.json")
                lakes.append(json.loads(obj["Body"].read()))
            except s3.exceptions.NoSuchKey:
                continue
    lakes.sort(key=lambda l: l.get("latest_first_seen") or "", reverse=True)
    lakes.sort(key=lambda l: l.get("flagged_ac", 0), reverse=True)
    generated = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return _resp(200, {"generated": generated, "lakes": lakes}, {"Cache-Control": "max-age=300"})


def _file(lake: str, path: str):
    if not LAKE_ID.match(lake) or not FILE.match(path) or ".." in path:
        return _resp(400, {"error": "bad path"})
    url = s3.generate_presigned_url(
        "get_object", Params={"Bucket": BUCKET, "Key": f"lakes/{lake}/{path}"}, ExpiresIn=3600
    )
    return {"statusCode": 302, "headers": {"Location": url, **CORS, "Cache-Control": "max-age=600"}, "body": ""}


def _watch(body: str):
    try:
        data = json.loads(body or "{}")
    except json.JSONDecodeError:
        return _resp(400, {"error": "invalid JSON"})
    lake, email = str(data.get("lake", "")), str(data.get("email", "")).strip().lower()
    if not LAKE_ID.match(lake) or not EMAIL.match(email):
        return _resp(400, {"error": "lake and a valid email are required"})
    ddb.put_item(
        TableName=os.environ["WATCHERS_TABLE"],
        Item={
            "pk": {"S": lake},
            "sk": {"S": email},
            "created": {"S": datetime.now(timezone.utc).isoformat(timespec="seconds")},
        },
    )
    # SNS sends a confirmation email; alerts arrive only after the person confirms.
    sns.subscribe(
        TopicArn=os.environ["ALERTS_TOPIC_ARN"],
        Protocol="email",
        Endpoint=email,
        Attributes={"FilterPolicy": json.dumps({"lake": [lake]})},
    )
    return _resp(202, {"ok": True})


def handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path = event.get("rawPath", "/")
    if method == "OPTIONS":
        return _resp(204)
    if method == "GET" and path == "/index.json":
        return _index()
    m = re.match(r"^/lakes/([^/]+)/(.+)$", path)
    if method == "GET" and m:
        return _file(m.group(1), m.group(2))
    if method == "POST" and path == "/watch":
        return _watch(event.get("body", ""))
    return _resp(404, {"error": "not found"})
