#!/usr/bin/env bash
set -e

echo "==> Running alembic upgrade head..."
alembic upgrade head

echo "==> Starting trade-ingest API..."
exec uvicorn services.trade_ingest.api:app --host 0.0.0.0 --port "${PORT:-8010}" --workers 1
