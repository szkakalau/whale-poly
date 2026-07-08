#!/usr/bin/env bash
set -e

# Run migrations before starting the server.
echo "==> Running alembic upgrade head..."
alembic upgrade head

echo "==> Starting unified SightWhale..."
exec uvicorn services.unified.app:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1
