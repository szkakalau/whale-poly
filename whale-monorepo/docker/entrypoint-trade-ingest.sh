#!/usr/bin/env bash
set -e

# Database migrations are handled by the separate db-migrate job in render.yaml.
# This avoids race conditions when trade-ingest-api scales to multiple instances.

echo "==> Starting trade-ingest API..."
exec uvicorn services.trade_ingest.api:app --host 0.0.0.0 --port "${PORT:-8010}" --workers 1
