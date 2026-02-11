#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-${HEALTH_TRADE_INGEST_API_URL:-https://trade-ingest-api.onrender.com}}"
WHALE_API="${WHALE_API:-${HEALTH_WHALE_ENGINE_API_URL:-https://whale-engine-api.onrender.com}}"
ALERT_API="${ALERT_API:-${HEALTH_ALERT_ENGINE_API_URL:-https://alert-engine-api.onrender.com}}"
PAY_API="${PAY_API:-${HEALTH_PAYMENT_API_URL:-https://payment-api-6wk6.onrender.com}}"
TG_API="${TG_API:-${HEALTH_TELEGRAM_BOT_API_URL:-https://telegram-bot-qk51.onrender.com}}"

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
    else
      local root="${base%/}/"
      local root_code
      root_code=$(curl -s -o /dev/null -w "%{http_code}" "$root" || true)
      if [ "$root_code" != "404" ]; then
        url="$root"
        code="$root_code"
      fi
    fi
  fi
  printf "GET %s ... %s\n" "$url" "$code"
}

echo "== Checking service health =="
for base in "$API_BASE" "$WHALE_API" "$ALERT_API" "$PAY_API" "$TG_API"
do
  health_get "$base"
done

echo "== Injecting test trade =="
resp=$(curl -s -X POST "$API_BASE/ingest/trade" \
  -H "content-type: application/json" \
  -d '{
    "trade_id":"health-test-'$(date +%s)'",
    "market_id":"health-market",
    "market_title":"Health Market",
    "wallet":"0xabc1234567890defabc1234567890defabc12345",
    "side":"buy",
    "amount":40000,
    "price":0.30
  }' || true)
echo "$resp"

echo "== Polymarket reachability (server side is via worker logs) =="
echo "If no alerts follow in Telegram within 2 minutes, check worker logs for:"
echo "  - polymarket_trades_fetched"
echo "  - polymarket_fetch_failed"
