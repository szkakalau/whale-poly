from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.db import get_session
from shared.logging import configure_logging
from shared.models import Alert


configure_logging(settings.log_level)

app = FastAPI(title="alert-engine")


@app.get("/health")
async def health():
  return {"status": "ok"}


@app.get("/alerts")
async def list_alerts(limit: int = Query(100, ge=1, le=1000), session: AsyncSession = Depends(get_session)):
  rows = (await session.execute(select(Alert).order_by(Alert.created_at.desc()).limit(limit))).scalars().all()
  return [
    {
      "id": a.id,
      "whale_trade_id": a.whale_trade_id,
      "market_id": a.market_id,
      "wallet_address": a.wallet_address,
      "whale_score": a.whale_score,
      "alert_type": a.alert_type,
      "created_at": a.created_at,
    }
    for a in rows
  ]


@app.get("/alerts/recent")
async def recent_alerts(minutes: int = Query(60, ge=1, le=1440), session: AsyncSession = Depends(get_session)):
  since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
  rows = (await session.execute(select(Alert).where(Alert.created_at >= since).order_by(Alert.created_at.desc()))).scalars().all()
  return [
    {
      "id": a.id,
      "whale_trade_id": a.whale_trade_id,
      "market_id": a.market_id,
      "wallet_address": a.wallet_address,
      "whale_score": a.whale_score,
      "alert_type": a.alert_type,
      "created_at": a.created_at,
    }
    for a in rows
  ]
