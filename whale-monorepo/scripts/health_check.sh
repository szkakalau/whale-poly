#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-${HEALTH_TRADE_INGEST_API_URL:-https://trade-ingest-api.onrender.com}}"
WHALE_API="${WHALE_API:-${HEALTH_WHALE_ENGINE_API_URL:-https://whale-engine-api.onrender.com}}"
ALERT_API="${ALERT_API:-${HEALTH_ALERT_ENGINE_API_URL:-https://alert-engine-api.onrender.com}}"
PAY_API="${PAY_API:-${HEALTH_PAYMENT_API_URL:-https://payment-api.onrender.com}}"
TG_API="${TG_API:-${HEALTH_TELEGRAM_BOT_API_URL:-https://telegram-bot.onrender.com}}"

echo "== Checking service health =="
for url in \
  "$API_BASE/health" \
  "$WHALE_API/health" \
  "$ALERT_API/health" \
  "$PAY_API/healthz" \
  "$TG_API/health"
do
  printf "GET %s ... " "$url"
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || true)
  echo "$code"
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
