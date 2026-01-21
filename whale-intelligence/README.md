# Whale Intelligence

Paid intelligence product that tracks, scores, and delivers high-conviction whale activity in Polymarket via private Telegram bot delivery.

## Setup

- Requires Node.js (>=18), PostgreSQL, and a Telegram bot token.
- Fill `.env` based on `.env.example`.

### Install

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
```

### Run locally

```bash
npm run dev
```

## Env Variables

- `DATABASE_URL`: PostgreSQL connection string
- `TELEGRAM_BOT_TOKEN`: Telegram bot token
- `PORT`: Express server port
- `ACCESS_TOKEN_TTL_MINUTES`: One-time access token TTL (<= 15 minutes)
- `POLYMARKET_TRADES_URL`: Public Polymarket trades API URL (no API key)
- `POLYMARKET_MARKETS_URL`: Polymarket markets metadata endpoint
- `POLYMARKET_ORDERBOOK_URL`: Polymarket orderbook snapshots endpoint
- `POLYMARKET_SETTLEMENTS_URL`: Polymarket settlements endpoint
- `STRIPE_SECRET_KEY`: Stripe secret key for webhook signature verification
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret
- `STRIPE_PRICE_FREE`: Stripe Price ID for Free tier (optional, if using Stripe for free plan)
- `STRIPE_PRICE_PRO`: Stripe Price ID for Pro ($39/month)
- `STRIPE_PRICE_ELITE`: Stripe Price ID for Elite ($129/month)
- `FREE_ALERT_DELAY_MINUTES`: Delay window for Free tier alerts (default 90)
- `MARKET_ALERT_RATE_LIMIT_MINUTES`: Rate limit per market (default 15)

## What is intentionally NOT implemented

- Auto-trading and order execution
- Telegram groups or channels (delivery via private bot DMs)
- Bot payments
- Historical queries via bot
- Dashboards or admin UI
- Speculative features beyond fixed MVP rules

## Notes

- Bot is a private delivery pipe only.
- Ensure the trades API URL is reachable; ingestion handles failures gracefully.
 - Stripe webhook updates `users.plan` and `users.status`, which controls Telegram delivery:
   - Free: delayed whale alerts, no score
   - Pro: real-time whale alerts with score
   - Elite: real-time whale + conviction signals and smart address features (future)
