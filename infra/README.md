# Infrastructure (AWS, us-west-2)

Everything runs in **us-west-2**, where the Sentinel-2 imagery lives.

| Piece | What it does |
| --- | --- |
| S3 `kerewatch-results-<account>` | Pipeline outputs (see `contracts/README.md`) |
| DynamoDB `kerewatch-lakes`, `kerewatch-watchers` | Lake summaries and flags; email subscriptions per lake |
| ECR `kerewatch-pipeline` + Lambda `kerewatch-pipeline` | Container image running one lake per invocation |
| Step Functions `kerewatch-run-all` | Map over lakes, one branch each, with retries |
| EventBridge Scheduler | Monthly re-scan that starts the state machine |
| SNS `kerewatch-alerts` | Email when a watched lake gets a new flag |
| API Gateway + Lambda | Serves lake data to the web app; builds the evidence pack |
| Amplify Hosting | The Next.js app in `web/` |

## Created (2026-10-09, account 468094683747, us-west-2)

| Resource | Name / URI | Notes |
| --- | --- | --- |
| Budget | `kerewatch-monthly` | $10/month; email at 50%, 100% actual and 100% forecast |
| S3 | `kerewatch-results-468094683747` | Private (all public access blocked), SSE-S3 |
| DynamoDB | `kerewatch-lakes` | On-demand; `pk` = lake id, `sk` = `summary`, `season#<season>` or `flag#<flag id>` |
| DynamoDB | `kerewatch-watchers` | On-demand; `pk` = lake id, `sk` = subscriber email |
| ECR | `468094683747.dkr.ecr.us-west-2.amazonaws.com/kerewatch-pipeline` | Scan on push; keeps the newest 5 images |
| Lambda | `kerewatch-pipeline` | Container image `kerewatch-pipeline:lakes-13-202610092229` (same code as the earlier `:latest`, plus Mallathahalli in the lake list); 3008 MB, 900 s; one lake per run (~105 s per lake); alerts once per new dry season |
| Lambda | `kerewatch-api` | Zip (`api/handler.py`); serves `index.json`, `lakes/<id>/<file>` (302 to presigned S3), `POST /watch` |
| API Gateway (HTTP) | `https://tlnp8w02m4.execute-api.us-west-2.amazonaws.com` | Routes everything to `kerewatch-api`; CORS open for GET/POST |
| Step Functions | `kerewatch-run-all` | Map over lakes (max 6 at once), retries, failures caught per lake |
| EventBridge Scheduler | `kerewatch-monthly-rescan` | 03:00 IST on the 5th of each month → `kerewatch-run-all` (13 lakes) |
| S3 `lakes/<id>/checks.json` | Per-lake flag verification | From `research/flags_checked.csv`; the web app shows each flag's verdict. Re-upload after new checks |
| SNS | `kerewatch-alerts` | Email per lake via subscription filter policy `{"lake": [<id>]}` |
| IAM roles | `kerewatch-pipeline-lambda`, `kerewatch-api-lambda`, `kerewatch-states`, `kerewatch-scheduler` | Least privilege; policies in `iam/` |

Run all lakes now: `aws stepfunctions start-execution --region us-west-2 --state-machine-arn arn:aws:states:us-west-2:468094683747:stateMachine:kerewatch-run-all --input file://stepfunctions/input.example.json`

All resources are tagged `Project=kerewatch`. Pass `--region us-west-2` on every command (the CLI default is ap-south-1).

## Build and push the pipeline image

```bash
# from the repo root
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-west-2.amazonaws.com
docker build --platform linux/amd64 -f infra/lambda/Dockerfile -t kerewatch-pipeline .
docker tag kerewatch-pipeline:latest <account>.dkr.ecr.us-west-2.amazonaws.com/kerewatch-pipeline:latest
docker push <account>.dkr.ecr.us-west-2.amazonaws.com/kerewatch-pipeline:latest
```

Lambda settings: 3008 MB memory, 900 s timeout, 2048 MB ephemeral storage, env `RESULTS_BUCKET`. Time one lake-year early; if a lake runs past 15 minutes, split the Map by year.

## Step Functions

`stepfunctions/state_machine.asl.json` with `${PipelineFunctionArn}` replaced. Start with `stepfunctions/input.example.json`.

## Fallback

If the Lambda isn't ready, run `python -m jalrekha.run --lake <id> --s3-bucket <bucket>` on a laptop with the same code, and show the Lambda running one lake in the video.
