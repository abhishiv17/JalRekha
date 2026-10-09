#!/usr/bin/env bash
# Jobs run on AWS CodeBuild (Linux), started by infra/plot/setup.sh:
#   MODE=flood  Sentinel-1 flood map -> s3://$PLOT_BUCKET/floods/
#   MODE=test   pipeline tests
#   MODE=plot   one Plot Check (LAT, LON) -> s3://$PLOT_BUCKET/debug/
#   MODE=image  worker container -> ECR, then point the Lambda at it
set -euo pipefail
: "${MODE:?}" "${PLOT_BUCKET:?}"

pip_install() { pip install -q -r pipeline/requirements.txt "anthropic[bedrock]"; }

case "$MODE" in
  flood)
    pip_install
    (cd pipeline && python -m jalrekha.flood --event "${EVENT:-blr-2022-09}" --out /tmp/floods)
    aws s3 cp --recursive /tmp/floods "s3://$PLOT_BUCKET/floods/"
    ;;
  test)
    pip_install
    (cd pipeline && python -m pytest -q)
    ;;
  plot)
    pip_install
    (cd pipeline && python -m jalrekha.plot --lat "$LAT" --lon "$LON" --out /tmp/plot)
    aws s3 cp --recursive /tmp/plot "s3://$PLOT_BUCKET/debug/plot/"
    ;;
  image)
    account=$(aws sts get-caller-identity --query Account --output text)
    repo="$account.dkr.ecr.$AWS_REGION.amazonaws.com/jalrekha-plot"
    aws ecr get-login-password | docker login --username AWS --password-stdin "${repo%%/*}"
    docker build --platform linux/amd64 --provenance=false -f infra/plot/Dockerfile -t "$repo:latest" .
    docker push "$repo:latest"
    if aws lambda get-function --function-name jalrekha-plot-worker >/dev/null 2>&1; then
      aws lambda update-function-code --function-name jalrekha-plot-worker --image-uri "$repo:latest" >/dev/null
      echo "updated jalrekha-plot-worker"
    fi
    ;;
  *)
    echo "unknown MODE $MODE"; exit 1 ;;
esac
