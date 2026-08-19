#!/usr/bin/env bash
set -euo pipefail

# Read-only health check (no synthetic trade injection — see CR-H1).
# Verifies each service /health endpoint is reachable.

API_BASE="${API_BASE:-${HEALTH_TRADE_INGEST_API_URL:-https://sightwhale.onrender.com}}"
WHALE_API="${WHALE_API:-${HEALTH_WHALE_ENGINE_API_URL:-https://sightwhale.onrender.com/whale}}"
ALERT_API="${ALERT_API:-${HEALTH_ALERT_ENGINE_API_URL:-https://sightwhale.onrender.com/alert}}"
PAY_API="${PAY_API:-${HEALTH_PAYMENT_API_URL:-https://sightwhale.onrender.com/payment}}"
TG_API="${TG_API:-${HEALTH_TELEGRAM_BOT_API_URL:-https://sightwhale.onrender.com/telegram}}"

health_get() {
  local base="$1"
  local url="${base%/}/health"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || true)
  if [ "$code" = "404" ]; then
    local alt="${base%/}/healthz"
    local alt_code
    alt_code=$(curl -s -o /dev/null -w "%{http_code}" "$alt" || true)
    if [ "$alt_code" != "404" ]; then
      url="$alt"
      code="$alt_code"
    fi
  fi
  printf "GET %s ... %s\n" "$url" "$code"
}

echo "== Checking service health =="
for base in "$API_BASE" "$WHALE_API" "$ALERT_API" "$PAY_API" "$TG_API"
do
  health_get "$base"
done

echo "== Pipeline freshness =="
echo "Check the unified /health response (DB + worker heartbeats), or run:"
echo "  python scripts/check_last_hour_activity.py"
