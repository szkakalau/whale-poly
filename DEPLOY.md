# Deployment Guide (whale-monorepo)

This repository has been consolidated into a Docker Compose–based monorepo.

Core paths:

- Backend services: [services](file:///Users/castroliu/poly/whale-monorepo/services)
- Shared config/db/models: [shared](file:///Users/castroliu/poly/whale-monorepo/shared)
- Alembic migrations: [alembic](file:///Users/castroliu/poly/whale-monorepo/alembic)
- Compose: [docker-compose.yml](file:///Users/castroliu/poly/whale-monorepo/docker/docker-compose.yml)

## Local

```bash
cd whale-monorepo
cp .env.example .env
make up
make migrate
```

## Production (high level)

Recommended deployment shape:

- Postgres: managed DB (Render/Supabase/RDS)
- Redis: managed Redis (Render/Upstash)
- One container per service (web services) + workers for Celery consumers

Secrets and required env:

- `DATABASE_URL`, `REDIS_URL`
- `TELEGRAM_BOT_TOKEN`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

Ingestion env:

- `POLYMARKET_DATA_API_TRADES_URL`
- `POLYMARKET_DATA_API_MARKETS_URL`
- `HTTPS_PROXY` (optional)

Migrations:

- Run `alembic upgrade head` using the monorepo Python image (same dependency set as the APIs/workers).

## Render (backend)

This repo includes a Render Blueprint file at [render.yaml](file:///Users/castroliu/poly/render.yaml).

1) Push the repo to GitHub
2) In Render dashboard: New → Blueprint → select the repo
3) Render will provision:
   - Postgres (`whale-postgres`)
   - Key Value (Redis-compatible) (`whale-redis`)
   - Web services: `trade-ingest-api`, `whale-engine-api`, `alert-engine-api`, `telegram-bot`, `payment-api`
   - Workers: `trade-ingest-worker`, `whale-engine-worker`, `alert-engine-worker`
4) In Render, set required environment variables on these services:
   - `TELEGRAM_BOT_TOKEN`
   - `BOT_USER_HASH_SECRET`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `POLYMARKET_DATA_API_TRADES_URL` (optional; defaults exist in `.env.example`)
   - `POLYMARKET_DATA_API_MARKETS_URL` (optional; defaults exist in `.env.example`)
5) Run migrations once:
   - Render → Shell (any python web service) → `cd /app && alembic upgrade head`
6) Seed plans (monthly/yearly) in Postgres

### No Stripe yet (mock mode)

If you don't have Stripe set up yet, you can still test the full Telegram subscription + alert flow.

1) Set `PAYMENT_MODE=mock` on the `payment-api` service (and redeploy)
2) Leave `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` empty
3) Seed `plans` with any placeholder `stripe_price_id` values
4) When a user submits activation code + plan, `POST /checkout` activates the subscription immediately and returns `LANDING_SUCCESS_URL`

After `payment-api` is live, configure Stripe webhook endpoint to:

- `https://<payment-api-domain>/webhook`

### Render Shell (scripts and backfill)

Backend containers use `WORKDIR /app` and include `scripts/` from the monorepo root (`render.yaml` → `rootDir: whale-monorepo`, `dockerfilePath: docker/Dockerfile`).

1. **Open Shell on a Python backend service**, not the Vercel landing app. Use any service built from `whale-monorepo/docker/Dockerfile`, for example `trade-ingest-api`, `whale-engine-api`, `whale-engine-worker`, `trade-ingest-worker`, `alert-engine-api`, `telegram-bot`, or `payment-api`. The landing frontend (Node/Vercel, root `whale-monorepo/services/landing`) does **not** contain these Python scripts.

2. **Verify the scripts directory** before running maintenance commands:

```bash
pwd
ls -la /app/scripts
```

If `/app/scripts` is missing, you are on the wrong container, or the deployed image was built from a revision that did not include `whale-monorepo/scripts/`—fix by pushing the files and **redeploying** a backend service, then open Shell again.

3. **Backfill `whale_trade_history` and recompute PnL** (requires `DATABASE_URL` as on other services; run from `/app`):

```bash
python scripts/backfill_whale_trade_history_from_raw_for_profiles.py
python scripts/recompute_whale_trade_history_pnl.py
```

Optional full raw backfill (can be large):

```bash
python scripts/backfill_trade_history.py --all
```

## Vercel (landing)

Landing lives at [services/landing](file:///Users/castroliu/poly/whale-monorepo/services/landing).

1) Create a new Vercel project from the same GitHub repo
2) Set Root Directory to `whale-monorepo/services/landing`
3) Add environment variable:
   - `PAYMENT_API_BASE_URL=https://<payment-api-domain>`
4) Deploy

Stripe redirect URLs:

- Set Render `LANDING_SUCCESS_URL` to `https://<vercel-domain>/success`
- Set Render `LANDING_CANCEL_URL` to `https://<vercel-domain>/cancel`
