# Whale Monorepo (Trade → Whale → Alert → Telegram + Payment)

## Structure

- `services/`
  - `trade_ingest` publishes `trade_created`
  - `whale_engine` consumes `trade_created` and publishes `whale_trade_created`
  - `alert_engine` consumes `whale_trade_created` and publishes `alert_created`
  - `telegram_bot` consumes `alert_created` and sends to active subscribers
  - `payment` manages plans/subscriptions and Stripe webhooks
- `shared/` common config, db, models, logging
- `alembic/` shared migrations for the single Postgres
- `docker/` docker-compose and Dockerfile

## Quickstart

```bash
cd whale-monorepo
cp .env.example .env
make up
make migrate
```

## Seed plans

Insert two plan rows so `/checkout` can create Stripe sessions:

```sql
INSERT INTO plans (id, name, price_usd, stripe_price_id) VALUES
  ('monthly', 'monthly', 20, 'price_xxx_monthly'),
  ('yearly', 'yearly', 200, 'price_xxx_yearly')
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
