#!/usr/bin/env bash
set -e

# Run migrations with a simple file-based lock to prevent concurrent runs.
# Render Blueprint does not support type: job (only web/pserv/worker/cron/keyvalue).
LOCK_DIR="/tmp/alembic.lock"
if mkdir "$LOCK_DIR" 2>/dev/null; then
  trap 'rm -rf "$LOCK_DIR"' EXIT
  echo "==> Running alembic upgrade head..."
  alembic upgrade head
else
  echo "==> Skipping alembic (another instance is running migrations)..."
  # Wait for the lock holder to finish, then proceed
  while [ -d "$LOCK_DIR" ]; do sleep 1; done
fi

echo "==> Starting trade-ingest API..."
exec uvicorn services.trade_ingest.api:app --host 0.0.0.0 --port "${PORT:-8010}" --workers 1
