import json
from datetime import datetime, timezone

from fastapi import Depends, FastAPI
from pydantic import BaseModel
from redis.asyncio import Redis
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.db import get_session
from shared.logging import configure_logging
from shared.models import Market, TradeRaw


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


@app.post("/ingest/trade")
async def ingest_trade(payload: TradeIn, session: AsyncSession = Depends(get_session)):
  ts = payload.timestamp or datetime.now(timezone.utc)
  if ts.tzinfo is None:
    ts = ts.replace(tzinfo=timezone.utc)

  if payload.market_title:
    await session.execute(
      insert(Market)
      .values(id=payload.market_id, title=payload.market_title, status=None)
      .on_conflict_do_update(index_elements=[Market.id], set_={"title": payload.market_title})
    )

  await session.execute(
    insert(TradeRaw)
    .values(
      trade_id=payload.trade_id,
      market_id=payload.market_id,
      wallet=payload.wallet.lower(),
      side=payload.side.lower(),
      amount=payload.amount,
      price=payload.price,
      timestamp=ts,
    )
    .on_conflict_do_nothing(index_elements=[TradeRaw.trade_id])
  )
  await session.commit()

  redis = Redis.from_url(settings.redis_url, decode_responses=True)
  try:
    await redis.rpush(settings.trade_created_queue, json.dumps({"trade_id": payload.trade_id}))
  finally:
    await redis.aclose()

  return {"ok": True}

