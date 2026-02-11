import json
from datetime import datetime, timezone

from fastapi import FastAPI
from pydantic import BaseModel
from redis.asyncio import Redis
from shared.config import settings
from shared.logging import configure_logging


configure_logging(settings.log_level)

app = FastAPI(title="trade-ingest")


class TradeIn(BaseModel):
  trade_id: str
  market_id: str
  market_title: str | None = None
  wallet: str
  side: str
  amount: float
  price: float
  timestamp: datetime | None = None


@app.get("/health")
async def health():
  return {"status": "ok"}


@app.get("/")
async def root():
  return {"status": "ok"}


@app.post("/ingest/trade")
async def ingest_trade(payload: TradeIn):
  ts = payload.timestamp or datetime.now(timezone.utc)
  if ts.tzinfo is None:
    ts = ts.replace(tzinfo=timezone.utc)

  redis = Redis.from_url(settings.redis_url, decode_responses=True)
  try:
    await redis.rpush(
      settings.trade_ingest_incoming_queue,
      json.dumps(
        {
          "trade_id": payload.trade_id,
          "market_id": payload.market_id,
          "market_title": payload.market_title,
          "wallet": payload.wallet.lower(),
          "side": payload.side.lower(),
          "amount": payload.amount,
          "price": payload.price,
          "timestamp": ts.isoformat(),
        }
      ),
    )
  finally:
    await redis.aclose()

  return {"ok": True, "queued": True}
