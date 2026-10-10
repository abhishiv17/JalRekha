"""JalRekha API (API Gateway HTTP API -> this Lambda).

Serves results with the same paths the web app reads as static files:
    GET  /index.json              lake list, built from lakes/*/summary.json
    GET  /lakes/<id>/<file...>    302 to a short-lived presigned S3 URL
    POST /watch {lake, email}     store the watcher; SNS emails a confirmation link
    POST /unwatch {lake, email}   remove the watcher and its email subscription

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


def _lakes_for(email: str) -> list[str]:
    """Every lake this person watches (the watchers table: pk = lake, sk = email)."""
    lakes, kw = set(), {"TableName": os.environ["WATCHERS_TABLE"], "ProjectionExpression": "pk",
                        "FilterExpression": "sk = :e", "ExpressionAttributeValues": {":e": {"S": email}}}
    while True:
        page = ddb.scan(**kw)
        lakes.update(i["pk"]["S"] for i in page.get("Items", []))
        if "LastEvaluatedKey" not in page:
            return sorted(lakes)
        kw["ExclusiveStartKey"] = page["LastEvaluatedKey"]


def _subscription(email: str):
    """This email's subscription to the alerts topic: (ARN, confirmed), or None.

    SNS keeps one email subscription per address per topic, so one person watching several lakes
    has one subscription whose filter policy lists all of them.
    """
    for page in sns.get_paginator("list_subscriptions_by_topic").paginate(TopicArn=os.environ["ALERTS_TOPIC_ARN"]):
        for sub in page["Subscriptions"]:
            if sub["Protocol"] == "email" and sub["Endpoint"].lower() == email:
                arn = sub["SubscriptionArn"]
                return arn, arn.startswith("arn:")  # "PendingConfirmation" until they click the link
    return None


def _filter(lakes: list[str]) -> str:
    return json.dumps({"lake": lakes})


def _read(body: str):
    try:
        data = json.loads(body or "{}")
    except json.JSONDecodeError:
        return None, None, _resp(400, {"error": "invalid JSON"})
    lake, email = str(data.get("lake", "")), str(data.get("email", "")).strip().lower()
    if not LAKE_ID.match(lake) or not EMAIL.match(email):
        return None, None, _resp(400, {"error": "lake and a valid email are required"})
    return lake, email, None


def _watch(body: str):
    lake, email, bad = _read(body)
    if bad:
        return bad
    ddb.put_item(
        TableName=os.environ["WATCHERS_TABLE"],
        Item={
            "pk": {"S": lake},
            "sk": {"S": email},
            "created": {"S": datetime.now(timezone.utc).isoformat(timespec="seconds")},
        },
    )
    lakes = _lakes_for(email)
    found = _subscription(email)
    if found is None:
        # SNS sends a confirmation email; alerts arrive only after the person confirms.
        sns.subscribe(TopicArn=os.environ["ALERTS_TOPIC_ARN"], Protocol="email", Endpoint=email,
                      Attributes={"FilterPolicy": _filter(lakes)})
        return _resp(202, {"ok": True, "status": "confirm"})
    arn, confirmed = found
    if not confirmed:
        # A subscription waiting for confirmation can't be changed; the lake is saved and is added
        # the next time they press Watch after confirming.
        return _resp(202, {"ok": True, "status": "pending"})
    sns.set_subscription_attributes(SubscriptionArn=arn, AttributeName="FilterPolicy", AttributeValue=_filter(lakes))
    return _resp(200, {"ok": True, "status": "added", "lakes": lakes})


def _unwatch(body: str):
    lake, email, bad = _read(body)
    if bad:
        return bad
    ddb.delete_item(TableName=os.environ["WATCHERS_TABLE"], Key={"pk": {"S": lake}, "sk": {"S": email}})
    found = _subscription(email)
    if not found or not found[1]:
        return _resp(200, {"ok": True, "subscriptions_removed": 0})  # pending confirmations lapse on their own
    arn, _ = found
    remaining = _lakes_for(email)
    if remaining:
        sns.set_subscription_attributes(SubscriptionArn=arn, AttributeName="FilterPolicy", AttributeValue=_filter(remaining))
        return _resp(200, {"ok": True, "subscriptions_removed": 0, "lakes": remaining})
    sns.unsubscribe(SubscriptionArn=arn)
    return _resp(200, {"ok": True, "subscriptions_removed": 1})


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
    if method == "POST" and path == "/unwatch":
        return _unwatch(event.get("body", ""))
    return _resp(404, {"error": "not found"})
