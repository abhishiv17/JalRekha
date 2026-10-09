# Pipeline Lambda: one lake per invocation.
# Build from the repo root:
#   docker build -f infra/lambda/Dockerfile -t kerewatch-pipeline .
FROM public.ecr.aws/lambda/python:3.12

# GDAL inside the rasterio wheel needs expat, which the minimal base image lacks.
RUN dnf install -y expat && dnf clean all

COPY pipeline/requirements.txt ${LAMBDA_TASK_ROOT}/
RUN grep -v "^pytest" ${LAMBDA_TASK_ROOT}/requirements.txt > /tmp/req.txt \
    && pip install --no-cache-dir -r /tmp/req.txt

COPY pipeline/jalrekha ${LAMBDA_TASK_ROOT}/jalrekha
COPY data/lakes ${LAMBDA_TASK_ROOT}/data/lakes
COPY infra/lambda/handler.py ${LAMBDA_TASK_ROOT}/

ENV LAKES_FILE=${LAMBDA_TASK_ROOT}/data/lakes/lakes.geojson
CMD ["handler.handler"]
