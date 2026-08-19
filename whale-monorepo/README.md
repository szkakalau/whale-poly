# SightWhale (whale-monorepo) — Trade → Whale → Alert → Telegram + Payment

> **What this is**: decision infrastructure for prediction-market traders —
> auditable smart-money intelligence (whale detection + calibrated scoring)
> plus research tools (backtesting, market correlation, position sizing).
> Signals are the hook; the audited dataset is the product. Not a hedge fund,
> not a data API vendor — a subscription tool with a compounding data asset.

## Structure

- `services/`
  - `trade_ingest` publishes `trade_created`
  - `whale_engine` consumes `trade_created` and publishes `whale_trade_created`
  - `alert_engine` consumes `whale_trade_created` and publishes `alert_created`
  - `telegram_bot` consumes `alert_created` and sends to active subscribers
  - `payment` manages plans/subscriptions and Stripe webhooks
  - `unified` — **production mode**: a single FastAPI process replacing the
    services above (in-memory queues, 16 asyncio workers, no Redis/Celery).
    Selected by leaving `REDIS_URL` empty; `REDIS_URL` set → legacy
    multi-service mode.
- `shared/` common config, db, models, logging
- `alembic/` shared migrations for the single Postgres (head = `0018`; owns
  ALL pipeline + blog schema — no runtime `CREATE TABLE` in app code)
- `docker/` docker-compose and Dockerfile
- `services/landing/` Next.js 16 marketing site + dashboard + blog + payment
  proxy (Prisma owns user-side tables; see `prisma/schema.prisma`)

## Quickstart

```bash
cd whale-monorepo
cp .env.example .env
make unified        # unified single-process mode: postgres + one app on :8000
make migrate        # legacy mode only; unified runs alembic on startup
```

## Blog schema

`blog_posts` is owned by Alembic migration `0018` (single source of truth).
`services/landing/src/content/posts/` is only an offline editing workspace —
see its README; live content lives in Postgres.

## Seed plans

Insert plan rows so `/checkout` can create Stripe sessions. Pro is the
`monthly`/`yearly` pair; Elite adds two more rows (Elite monthly $59, Elite
yearly $590):

```sql
INSERT INTO plans (id, name, price_usd, stripe_price_id) VALUES
  ('monthly', 'monthly', 29, 'price_xxx_monthly'),
  ('yearly', 'yearly', 290, 'price_xxx_yearly'),
  ('elite_monthly', 'elite_monthly', 59, 'price_xxx_elite_monthly'),
  ('elite_yearly', 'elite_yearly', 590, 'price_xxx_elite_yearly')
ON CONFLICT (name) DO UPDATE SET price_usd = EXCLUDED.price_usd, stripe_price_id = EXCLUDED.stripe_price_id;
```

## No Stripe yet (mock mode)

Set `PAYMENT_MODE=mock` to bypass Stripe and activate subscriptions immediately on `/checkout`.

## End-to-end test (local)

1) Start Telegram bot and generate activation code in chat
2) Open Landing and use `/subscribe` to start Stripe checkout
3) Stripe calls `POST /webhook` to activate `subscriptions`
4) Send a trade into `POST /ingest/trade`
5) Observe messages in Telegram when alert is generated

APIs:

- Trade Ingest: http://localhost:8010/docs
- Whale Engine: http://localhost:8011/docs
- Alert Engine: http://localhost:8012/docs
- Telegram Bot: http://localhost:8013/docs
- Payment: http://localhost:8014/docs
- Landing: http://localhost:3000/

## Event queues

- `TRADE_CREATED_QUEUE` default `trade_created`
- `WHALE_TRADE_CREATED_QUEUE` default `whale_trade_created`
- `ALERT_CREATED_QUEUE` default `alert_created`

All queues are Redis lists (`RPUSH` + `BLPOP`).

## Polymarket ingestion

`trade-ingest-worker` runs scheduled jobs (Celery beat embedded in worker) to:

- ingest markets every 10 minutes from `POLYMARKET_DATA_API_MARKETS_URL`
- ingest trades every 30 seconds from `POLYMARKET_DATA_API_TRADES_URL`

Trades older than 7 days are ignored to prevent historical backfill during live operation.

## Deployment (Render + Vercel)

- Backend on Render via Blueprint: [render.yaml](file:///Users/castroliu/poly/render.yaml)
- Landing on Vercel (root dir `whale-monorepo/services/landing`)
- Step-by-step: [DEPLOY.md](file:///Users/castroliu/poly/DEPLOY.md)
- One-off Python scripts under `scripts/` (DB backfill, etc.): run **Render Shell** on any backend service from `docker/Dockerfile`—see **Render Shell** in [DEPLOY.md](../DEPLOY.md#render-shell-scripts-and-backfill) (not the Vercel landing app).
