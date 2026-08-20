"""Startup pipeline reconciliation for unified (in-memory) mode (CR-R1).

In unified mode the queues live in process memory. If the process restarts
mid-flight, queued events are lost. This module re-enqueues the work that the
database proves is still outstanding:

  1. trades_raw rows (recent window) that never became whale_trades
     → re-enqueued into the `trade_created` queue.
  2. whale_trades rows (recent window) that have no alert row
     → re-enqueued into the `whale_trade_created` queue.

Reprocessing is safe and idempotent: whale_trades/alerts/deliveries are all
guarded by unique constraints, so re-processing an already-handled event is a
no-op. Alert-side cooldown state also lives in memory, so a restart naturally
resets it — the catch-up re-evaluates recent trades under fresh state, which
is the desired behaviour.

Env knobs:
  RECONCILE_WINDOW_HOURS  — look-back window (default 48)
  RECONCILE_MAX_ITEMS     — max items re-enqueued per stage (default 2000)
"""
import json
import logging
import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text

from shared.config import settings
from shared.db import SessionLocal
from shared.models import Alert, TradeRaw, WhaleTrade

logger = logging.getLogger("unified.reconcile")

# Startup reconciliation runs BEFORE uvicorn binds its port. On large prod
# tables these anti-join queries can run for tens of minutes, blocking the
# port from ever opening, so Render's port scan times out and the deploy
# fails (observed 2026-08-20: 5+ orphan queries, 50 min each). Bound each
# statement server-side; if it is cancelled, the caller catches the error
# and startup proceeds without reconciliation.
RECONCILE_STATEMENT_TIMEOUT_MS = int(os.getenv("RECONCILE_STATEMENT_TIMEOUT_MS", "20000"))


async def reconcile_pipeline_on_startup(redis) -> dict[str, int]:
    window_hours = float(os.getenv("RECONCILE_WINDOW_HOURS", "48"))
    max_items = int(os.getenv("RECONCILE_MAX_ITEMS", "2000"))
    since = datetime.now(timezone.utc) - timedelta(hours=window_hours)
    summary = {"reconciled_raw_trades": 0, "reconciled_whale_trades": 0}

    async with SessionLocal() as session:
        await session.execute(
            text(f"SET LOCAL statement_timeout = {RECONCILE_STATEMENT_TIMEOUT_MS}")
        )
        # Stage 1: raw trades that never produced a whale_trade.
        raw_ids = (
            await session.execute(
                select(TradeRaw.trade_id)
                .where(TradeRaw.timestamp >= since)
                .where(~TradeRaw.trade_id.in_(select(WhaleTrade.trade_id)))
                .order_by(TradeRaw.timestamp)
                .limit(max_items)
            )
        ).scalars().all()
        for i in range(0, len(raw_ids), 50):
            chunk = [json.dumps({"trade_id": tid}) for tid in raw_ids[i : i + 50]]
            await redis.rpush(settings.trade_created_queue, *chunk)
        summary["reconciled_raw_trades"] = len(raw_ids)

        # Stage 2: whale_trades that never produced an alert.
        wt_ids = (
            await session.execute(
                select(WhaleTrade.id)
                .where(WhaleTrade.created_at >= since)
                .where(~WhaleTrade.id.in_(select(Alert.whale_trade_id)))
                .order_by(WhaleTrade.created_at)
                .limit(max_items)
            )
        ).scalars().all()
        for i in range(0, len(wt_ids), 50):
            chunk = [json.dumps({"whale_trade_id": wid}) for wid in wt_ids[i : i + 50]]
            await redis.rpush(settings.whale_trade_created_queue, *chunk)
        summary["reconciled_whale_trades"] = len(wt_ids)

    logger.info(
        "pipeline_reconciliation_done raw=%d whale=%d window_h=%s",
        summary["reconciled_raw_trades"],
        summary["reconciled_whale_trades"],
        window_hours,
    )
    return summary
