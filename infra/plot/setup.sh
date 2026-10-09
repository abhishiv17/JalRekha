#!/usr/bin/env bash
# Plot Check on AWS (us-west-2, next to the Sentinel-2 imagery). Safe to re-run.
#
#   bash infra/plot/setup.sh base      # S3, DynamoDB, ECR, IAM roles, CodeBuild project
#   bash infra/plot/setup.sh build MODE [VAR=value ...]   # upload source, run a CodeBuild job, wait
#   bash infra/plot/setup.sh lambdas   # worker (container) + API (zip) Lambdas, HTTP API
#
# Run from the repo root with AWS credentials for the target account.
set -euo pipefail
export MSYS_NO_PATHCONV=1  # Git Bash: keep "/aws/..." log group names as they are
export AWS_REGION=${AWS_REGION:-us-west-2} AWS_DEFAULT_REGION=${AWS_REGION:-us-west-2} AWS_PAGER=""
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION=$AWS_REGION
BUCKET=jalrekha-plot-$ACCOUNT
TABLE=jalrekha-plot-checks
HERE=infra/plot
TMP=.jalrekha-setup  # relative, so both Git Bash and the Windows AWS CLI can read it
mkdir -p "$TMP"

policy() {  # fill ${ACCOUNT} ${REGION} ${BUCKET} in a policy file
  sed -e "s/\${ACCOUNT}/$ACCOUNT/g" -e "s/\${REGION}/$REGION/g" -e "s/\${BUCKET}/$BUCKET/g" "$HERE/iam/$1"
}

role() {  # role name, trust file, policy file
  if ! aws iam get-role --role-name "$1" >/dev/null 2>&1; then
    aws iam create-role --role-name "$1" --assume-role-policy-document "file://$HERE/iam/$2" \
      --tags Key=Project,Value=jalrekha >/dev/null
    echo "created role $1"
  fi
  policy "$3" > "$TMP/$3"
  aws iam put-role-policy --role-name "$1" --policy-name "$1" --policy-document "file://$TMP/$3"
}

base() {
  if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
    aws s3api create-bucket --bucket "$BUCKET" --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
    echo "created bucket $BUCKET"
  fi
  aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration \
    '{"CORSRules":[{"AllowedMethods":["GET","HEAD"],"AllowedOrigins":["*"],"AllowedHeaders":["*"],"MaxAgeSeconds":3600}]}'
  aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration \
    '{"Rules":[{"ID":"expire-source","Status":"Enabled","Filter":{"Prefix":"src/"},"Expiration":{"Days":7}}]}'
  aws s3api put-bucket-tagging --bucket "$BUCKET" --tagging 'TagSet=[{Key=Project,Value=jalrekha}]'

  if ! aws dynamodb describe-table --table-name "$TABLE" >/dev/null 2>&1; then
    aws dynamodb create-table --table-name "$TABLE" --billing-mode PAY_PER_REQUEST \
      --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH \
      --tags Key=Project,Value=jalrekha >/dev/null
    echo "created table $TABLE"
  fi

  if ! aws ecr describe-repositories --repository-names jalrekha-plot >/dev/null 2>&1; then
    aws ecr create-repository --repository-name jalrekha-plot --image-scanning-configuration scanOnPush=true \
      --tags Key=Project,Value=jalrekha >/dev/null
    aws ecr put-lifecycle-policy --repository-name jalrekha-plot --lifecycle-policy-text \
      '{"rules":[{"rulePriority":1,"selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":3},"action":{"type":"expire"}}]}' >/dev/null
    echo "created ECR repo jalrekha-plot"
  fi

  role jalrekha-codebuild codebuild-trust.json codebuild-policy.json
  role jalrekha-plot-worker lambda-trust.json worker-policy.json
  role jalrekha-plot-api lambda-trust.json api-policy.json

  if ! aws codebuild batch-get-projects --names jalrekha-build --query 'projects[0].name' --output text | grep -q jalrekha-build; then
    sleep 10  # a new IAM role takes a moment before CodeBuild can assume it
    aws codebuild create-project --name jalrekha-build \
      --source "type=S3,location=$BUCKET/src/jalrekha.zip,buildspec=infra/plot/buildspec.yml" \
      --artifacts type=NO_ARTIFACTS \
      --environment "type=LINUX_CONTAINER,image=aws/codebuild/amazonlinux-x86_64-standard:5.0,computeType=BUILD_GENERAL1_MEDIUM,privilegedMode=true,environmentVariables=[{name=PLOT_BUCKET,value=$BUCKET}]" \
      --service-role "arn:aws:iam::$ACCOUNT:role/jalrekha-codebuild" \
      --timeout-in-minutes 45 --tags key=Project,value=jalrekha >/dev/null
    echo "created CodeBuild project jalrekha-build"
  fi
  echo "base ready: bucket $BUCKET, table $TABLE"
}

upload_source() {
  python "$HERE/pack_source.py" "$TMP/jalrekha.zip"
  aws s3 cp --quiet "$TMP/jalrekha.zip" "s3://$BUCKET/src/jalrekha.zip"
}

build() {  # MODE [NAME=value ...]
  local mode=$1; shift
  upload_source
  local vars="[{\"name\":\"MODE\",\"value\":\"$mode\"}"
  for kv in "$@"; do vars+=",{\"name\":\"${kv%%=*}\",\"value\":\"${kv#*=}\"}"; done
  vars+="]"
  local id
  id=$(aws codebuild start-build --project-name jalrekha-build --environment-variables-override "$vars" \
    --query build.id --output text)
  echo "CodeBuild $mode: $id"
  local status=IN_PROGRESS
  while [ "$status" = IN_PROGRESS ]; do
    sleep 20
    status=$(aws codebuild batch-get-builds --ids "$id" --query 'builds[0].buildStatus' --output text)
  done
  local group stream
  group=$(aws codebuild batch-get-builds --ids "$id" --query 'builds[0].logs.groupName' --output text)
  stream=$(aws codebuild batch-get-builds --ids "$id" --query 'builds[0].logs.streamName' --output text)
  aws logs get-log-events --log-group-name "$group" --log-stream-name "$stream" --limit 60 \
    --query 'events[].message' --output text | tr '\t' '\n' | tail -40
  echo "CodeBuild $mode: $status"
  [ "$status" = SUCCEEDED ]
}

lambdas() {
  local repo="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/jalrekha-plot:latest"
  if ! aws lambda get-function --function-name jalrekha-plot-worker >/dev/null 2>&1; then
    aws lambda create-function --function-name jalrekha-plot-worker --package-type Image \
      --code "ImageUri=$repo" --role "arn:aws:iam::$ACCOUNT:role/jalrekha-plot-worker" \
      --memory-size 3008 --timeout 900 --ephemeral-storage Size=2048 \
      --environment "Variables={PLOT_BUCKET=$BUCKET,PLOT_TABLE=$TABLE}" \
      --tags Project=jalrekha >/dev/null
    aws lambda wait function-active-v2 --function-name jalrekha-plot-worker
    echo "created worker Lambda"
  fi
  # One attempt per check: a failed check is marked "error" and the user can retry.
  aws lambda put-function-event-invoke-config --function-name jalrekha-plot-worker \
    --maximum-retry-attempts 0 --maximum-event-age-in-seconds 3600 >/dev/null

  python -c "import zipfile; z=zipfile.ZipFile('$TMP/api.zip','w',zipfile.ZIP_DEFLATED); z.write('$HERE/api.py','api.py'); z.close()"
  if ! aws lambda get-function --function-name jalrekha-plot-api >/dev/null 2>&1; then
    aws lambda create-function --function-name jalrekha-plot-api --runtime python3.12 --handler api.handler \
      --zip-file "fileb://$TMP/api.zip" --role "arn:aws:iam::$ACCOUNT:role/jalrekha-plot-api" \
      --memory-size 256 --timeout 15 \
      --environment "Variables={PLOT_BUCKET=$BUCKET,PLOT_TABLE=$TABLE,WORKER_FUNCTION=jalrekha-plot-worker}" \
      --tags Project=jalrekha >/dev/null
    aws lambda wait function-active-v2 --function-name jalrekha-plot-api
    echo "created API Lambda"
  else
    aws lambda update-function-code --function-name jalrekha-plot-api --zip-file "fileb://$TMP/api.zip" >/dev/null
    echo "updated API Lambda"
  fi

  local api_id
  api_id=$(aws apigatewayv2 get-apis --query "Items[?Name=='jalrekha-plot'].ApiId" --output text)
  if [ -z "$api_id" ]; then
    api_id=$(aws apigatewayv2 create-api --name jalrekha-plot --protocol-type HTTP \
      --target "arn:aws:lambda:$REGION:$ACCOUNT:function:jalrekha-plot-api" \
      --cors-configuration 'AllowOrigins=*,AllowMethods=GET,POST,OPTIONS,AllowHeaders=content-type' \
      --tags Project=jalrekha --query ApiId --output text)
    aws lambda add-permission --function-name jalrekha-plot-api --statement-id apigw \
      --action lambda:InvokeFunction --principal apigateway.amazonaws.com \
      --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT:$api_id/*" >/dev/null
    echo "created HTTP API"
  fi
  echo "API: https://$api_id.execute-api.$REGION.amazonaws.com"
}

case "${1:-}" in
  base) base ;;
  build) shift; build "$@" ;;
  lambdas) lambdas ;;
  *) echo "usage: $0 base | build MODE [VAR=value ...] | lambdas"; exit 1 ;;
esac
