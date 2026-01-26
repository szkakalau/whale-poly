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

After `payment-api` is live, configure Stripe webhook endpoint to:

- `https://<payment-api-domain>/webhook`

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
