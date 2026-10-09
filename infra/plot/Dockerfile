# Plot Check worker Lambda: one pin per invocation.
# Built by CodeBuild (infra/plot/codebuild.sh) from the repo root:
#   docker build -f infra/plot/Dockerfile -t jalrekha-plot .
FROM public.ecr.aws/lambda/python:3.12

# GDAL inside the rasterio wheel needs expat, which the minimal base image lacks.
RUN dnf install -y expat && dnf clean all

COPY pipeline/requirements.txt ${LAMBDA_TASK_ROOT}/
RUN grep -v "^pytest" ${LAMBDA_TASK_ROOT}/requirements.txt > /tmp/req.txt \
    && pip install --no-cache-dir -r /tmp/req.txt "anthropic[bedrock]"

COPY pipeline/jalrekha ${LAMBDA_TASK_ROOT}/jalrekha
COPY data/catalog/india.json ${LAMBDA_TASK_ROOT}/data/catalog/india.json
COPY data/floods ${LAMBDA_TASK_ROOT}/data/floods
COPY infra/plot/worker.py ${LAMBDA_TASK_ROOT}/

ENV JALREKHA_DATA=${LAMBDA_TASK_ROOT}/data
CMD ["worker.handler"]
