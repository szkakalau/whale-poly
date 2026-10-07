"""Startup pipeline reconciliation for unified (in-memory) mode (CR-R1).

In unified mode the queues live in process memory. If the process restarts
mid-flight, queued events are lost. This module re-enqueues the work that the
database proves is still outstanding:

  0. delivery rows left 'pending' by a crash mid-send (older than
     RECONCILE_STALE_PENDING_AFTER_SECONDS) are reset to 'failed' so stage 3
     can replay them.
  1. trades_raw rows (recent window) that never became whale_trades
     → re-enqueued into the `trade_created` queue.
  2. whale_trades rows (recent window) that have no alert row
     → re-enqueued into the `whale_trade_created` queue.
  3. alerts (recent window) whose delivery ledger row exists but is not 'sent'
     for an active subscriber → re-enqueued into the `alert_created` queue.

Why stage 0 runs FIRST, and why every stage owns its own transaction
--------------------------------------------------------------------
Stage 1 is the only stage that touches a multi-GB table (`trades_raw` is
2.5M rows / 6.1 GB in production) and it was the historical failure point.
It used ``trade_id NOT IN (SELECT trade_id FROM whale_trades)``, which
Postgres plans as a per-row linear probe of a *materialised* sub-select
instead of an anti-join — the 56.5k rows in the 48h window are each compared
against all 63k whale_trade ids:

    Limit (cost=4638578.27)                       ← NOT IN  (current form)
      Filter: (NOT (ANY (trade_id = (SubPlan 1).col1)))
      SubPlan 1 -> Materialize -> Seq Scan on whale_trades

    Limit (cost=5299.53)                          ← NOT EXISTS
      Nested Loop Anti Join
        -> Index Scan using ix_trades_raw_timestamp
        -> Index Only Scan using ix_whale_trades_trade_id

That is a ~875x cost difference, and it was fatal: the statement exceeded the
`statement_timeout` this module sets for itself, and because every stage
shared ONE session the cancellation rolled the transaction back and skipped
every subsequent stage. The observable symptom was that
`pipeline_reconciliation_done` never once appeared in production logs —
reconciliation died at stage 1 on all six restarts on 2026-10-05/07, so the
restart-recovery path was silently dead. Stage 1/2 now use a correlated
`NOT EXISTS` (measured 1.5 s / 0.6 s).

Two structural rules follow from that incident:

  * **Stage 0 runs first, in its own transaction.** It is the only stage whose
    failure mode is permanent: a 'pending' row is deliberately not
    re-claimable, so without the release a single crash mid-send strands that
    alert forever. Nothing that runs later may be able to prevent it.
  * **Every stage owns its session and its own error handling**, so a slow or
    failing stage degrades only itself. Per-stage failures are logged as
    `reconcile_stage_failed` and listed in `failed_stages`; the run still ends
    with `pipeline_reconciliation_done`.

Note also that `async with SessionLocal()` closes (and therefore *rolls back*)
on exit — it does not commit. Any stage that writes must commit explicitly;
stage 0 does.

Reprocessing is safe and idempotent: whale_trades/alerts/deliveries are all
guarded by unique constraints, so re-processing an already-handled event is a
no-op. NOTE: the deliveries dedup is only idempotent for *successful* sends —
a delivery that failed is deliberately re-claimable (status='failed'), so
stage 3 replays it instead of letting its claim row mask the failure forever.
Alert-side cooldown state also lives in memory, so a restart naturally resets
it — the catch-up re-evaluates recent trades under fresh state, which is the
desired behaviour.

Env knobs:
  RECONCILE_WINDOW_HOURS      — look-back window (default 48)
  RECONCILE_MAX_ITEMS         — max items re-enqueued per stage (default 2000)
  RECONCILE_STALE_PENDING_AFTER_SECONDS — claim-release age (default 600)
"""
import json
import logging
import os
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, text, update

from shared.config import settings
from shared.db import SessionLocal
from shared.models import Alert, Delivery, Subscription, TradeRaw, WhaleTrade, WhaleTradeHistory

logger = logging.getLogger("unified.reconcile")

# Startup reconciliation runs BEFORE uvicorn binds its port. On large prod
# tables these anti-join queries can run for tens of minutes, blocking the
# port from ever opening, so Render's port scan times out and the deploy
# fails (observed 2026-08-20: 5+ orphan queries, 50 min each). Bound each
# statement server-side; if it is cancelled, that stage is skipped and the
# remaining stages still run.
RECONCILE_STATEMENT_TIMEOUT_MS = int(os.getenv("RECONCILE_STATEMENT_TIMEOUT_MS", "20000"))

# How old a 'pending' delivery claim must be before stage 0 releases it.
#
# A claim is held from the moment it is written until the send finishes. The
# send may legitimately sit in `asyncio.sleep(delay_seconds)` first, and the
# slowest tier delays by 5 minutes (`user_plans.free.alerts_delay: 5m`; PRO and
# ELITE are 0m), plus up to a 30 s send timeout. So the longest window in which
# a *live* claim can legitimately exist is ~330 s.
#
# This value must exceed that window, otherwise a rolling deploy can steal a
# claim that the outgoing container is still holding: the new container would
# see a 2-minute-old 'pending' row, flip it to 'failed', replay and send it —
# and the old container, which does not re-check the ledger before sending,
# would then deliver the same alert a second time. A duplicate alert to a
# paying subscriber is worse than a delayed replay, so the default is a
# deliberately generous 600 s.
#
# The trade-off: a claim orphaned by a crash is not released until the *next*
# restart (reconciliation only runs at startup), so it can lag one deploy. That
# is the safe direction — the alert is still replayed, just later.
STALE_PENDING_AFTER_SECONDS = int(
    os.getenv("RECONCILE_STALE_PENDING_AFTER_SECONDS", "600")
)

# The longest a *live* claim can legitimately be held: the slowest tier delays
# by 5 minutes (300 s) and a send may then take up to its 30 s timeout.
MAX_LEGITIMATE_INFLIGHT_SECONDS = 300 + 30


def stale_pending_release_stmt(cutoff: datetime):
    """The stage-0 UPDATE: release 'pending' claims older than ``cutoff``.

    Filters to ``status='pending'`` only, so a 'sent' row can never be
    downgraded, and to ``updated_at < cutoff``, so a claim still held by a live
    container is left alone.
    """
    return (
        update(Delivery)
        .where(Delivery.status == "pending")
        .where(Delivery.updated_at < cutoff)
        .values(
            status="failed",
            error="reconcile_stale_pending",
            updated_at=func.now(),
        )
    )


def raw_trades_missing_stmt(since: datetime, max_items: int):
    """Stage 1: raw trades with no corresponding whale_trade.

    Deliberately a correlated NOT EXISTS rather than NOT IN — see the module
    docstring for why NOT IN cost ~875x more and killed reconciliation in prod.
    """
    no_whale_trade = ~(
        select(WhaleTrade.trade_id)
        .where(WhaleTrade.trade_id == TradeRaw.trade_id)
        .exists()
    )
    return (
        select(TradeRaw.trade_id)
        .where(TradeRaw.timestamp >= since)
        .where(no_whale_trade)
        .order_by(TradeRaw.timestamp)
        .limit(max_items)
    )


def whale_trades_missing_stmt(since: datetime, max_items: int):
    """Stage 2: whale_trades with no corresponding alert. Same anti-join rule."""
    no_alert = ~(
        select(Alert.whale_trade_id)
        .where(Alert.whale_trade_id == WhaleTrade.id)
        .exists()
    )
    return (
        select(WhaleTrade.id)
        .where(WhaleTrade.created_at >= since)
        .where(no_alert)
        .order_by(WhaleTrade.created_at)
        .limit(max_items)
    )


async def release_stale_pending_claims() -> int:
    """Reset orphaned 'pending' delivery claims so stage 3 can replay them.

    A 'pending' row is not re-claimable by design (the retry contract relies on
    'failed'), so without this a crash between the claim and the terminal
    result strands one alert forever. The update:

      * filters to status='pending' only, so a 'sent' row can never be
        downgraded (P3 preserved);
      * filters on age, so a claim still held by a live container is left
        alone (see STALE_PENDING_AFTER_SECONDS);
      * commits explicitly — `async with SessionLocal()` rolls back on exit.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=STALE_PENDING_AFTER_SECONDS)
    async with SessionLocal() as session:
        await session.execute(
            text(f"SET LOCAL statement_timeout = {RECONCILE_STATEMENT_TIMEOUT_MS}")
        )
        result = await session.execute(stale_pending_release_stmt(cutoff))
        released = int(result.rowcount or 0)
        await session.commit()
    if released:
        logger.warning(
            "reconcile_released_stale_pending count=%d age_gt_s=%d",
            released,
            STALE_PENDING_AFTER_SECONDS,
        )
    return released


async def _reenqueue_missing_whale_trades(redis, since: datetime, max_items: int) -> int:
    """Stage 1: raw trades that never produced a whale_trade."""
    async with SessionLocal() as session:
        await session.execute(
            text(f"SET LOCAL statement_timeout = {RECONCILE_STATEMENT_TIMEOUT_MS}")
        )
        raw_ids = (
            await session.execute(raw_trades_missing_stmt(since, max_items))
        ).scalars().all()
    for i in range(0, len(raw_ids), 50):
        chunk = [json.dumps({"trade_id": tid}) for tid in raw_ids[i : i + 50]]
        await redis.rpush(settings.trade_created_queue, *chunk)
    return len(raw_ids)


async def _reenqueue_missing_alerts(redis, since: datetime, max_items: int) -> int:
    """Stage 2: whale_trades that never produced an alert."""
    async with SessionLocal() as session:
        await session.execute(
            text(f"SET LOCAL statement_timeout = {RECONCILE_STATEMENT_TIMEOUT_MS}")
        )
        wt_ids = (
            await session.execute(whale_trades_missing_stmt(since, max_items))
        ).scalars().all()
    for i in range(0, len(wt_ids), 50):
        chunk = [json.dumps({"whale_trade_id": wid}) for wid in wt_ids[i : i + 50]]
        await redis.rpush(settings.whale_trade_created_queue, *chunk)
    return len(wt_ids)


async def _reenqueue_undelivered_alerts(redis, since: datetime, max_items: int) -> int:
    """Stage 3: alerts whose delivery never succeeded for an active subscriber.

    Stage 2 only rebuilds the Alert row; a delivery that failed *after* the
    alert was written (the alert→Telegram blind spot) used to be unrecoverable
    once its in-memory queue entry died with the process. This stage replays it.

    Bounded and de-amplified on purpose:

      * same window + RECONCILE_MAX_ITEMS cap, same statement_timeout;
      * restricted to active/trialing subscribers with an unexpired period;
      * only pairs that actually reached the delivery stage (a ledger row
        exists) and whose ledger row is not 'sent'. Alerts that were
        legitimately filtered before delivery have no row and are NOT
        re-enqueued, so they are not multiplied;
      * Alert.whale_trade_id is unique, so N undelivered subscribers yield ONE
        re-enqueue per alert (the fan-out loop re-resolves recipients).
    """
    undelivered = (
        select(Delivery.whale_trade_id)
        .join(Subscription, Subscription.telegram_id == Delivery.telegram_id)
        .where(Delivery.status != "sent")
        .where(Subscription.status.in_(["active", "trialing"]))
        .where(Subscription.current_period_end > datetime.now(timezone.utc))
    )
    async with SessionLocal() as session:
        await session.execute(
            text(f"SET LOCAL statement_timeout = {RECONCILE_STATEMENT_TIMEOUT_MS}")
        )
        alert_rows = (
            await session.execute(
                select(
                    Alert.whale_trade_id,
                    Alert.market_id,
                    Alert.wallet_address,
                    Alert.whale_score,
                    Alert.alert_type,
                    Alert.created_at,
                )
                .where(Alert.created_at >= since)
                .where(Alert.whale_trade_id.in_(undelivered))
                .order_by(Alert.created_at)
                .limit(max_items)
            )
        ).all()

        if not alert_rows:
            return 0

        wt_ids = [str(r[0]) for r in alert_rows]
        # Best-effort enrichment so a recovered alert renders like the
        # original (trade size / side / action type).
        trade_by_id: dict[str, dict] = {}
        hist_rows = (
            await session.execute(
                select(
                    WhaleTrade.id,
                    WhaleTrade.action_type,
                    WhaleTradeHistory.trade_usd,
                    WhaleTradeHistory.side,
                    WhaleTradeHistory.price,
                )
                .outerjoin(
                    WhaleTradeHistory,
                    WhaleTradeHistory.trade_id == WhaleTrade.trade_id,
                )
                .where(WhaleTrade.id.in_(wt_ids))
            )
        ).all()
    for wt_id, action_type, trade_usd, side, price in hist_rows:
        trade_by_id[str(wt_id)] = {
            "action_type": action_type,
            "trade_usd": float(trade_usd) if trade_usd is not None else None,
            "side": side,
            "price": float(price) if price is not None else None,
        }

    payloads: list[str] = []
    for whale_trade_id, market_id, wallet_address, whale_score, alert_type, created_at in alert_rows:
        extra = trade_by_id.get(str(whale_trade_id), {})
        payloads.append(
            json.dumps({
                "whale_trade_id": str(whale_trade_id),
                "market_id": str(market_id),
                "raw_token_id": str(market_id),
                "wallet_address": str(wallet_address),
                "whale_score": int(whale_score) if whale_score is not None else 0,
                "alert_type": str(alert_type),
                "action_type": extra.get("action_type") or "",
                "side": extra.get("side") or "UNKNOWN",
                "size": extra.get("trade_usd") or 0,
                "price": extra.get("price"),
                "created_at": created_at.isoformat() if created_at else None,
                "reconciled": True,
            })
        )
    for i in range(0, len(payloads), 50):
        await redis.rpush(settings.alert_created_queue, *payloads[i : i + 50])
    return len(payloads)


async def _run_stage(
    name: str,
    summary: dict,
    fn: Callable[[], Awaitable[int]],
) -> None:
    """Run one stage in isolation: its failure must not stop the others."""
    try:
        summary[name] = await fn()
    except Exception:  # noqa: BLE001 — one bad stage must not abort the rest
        summary[name] = 0
        summary["failed_stages"].append(name)
        logger.exception("reconcile_stage_failed stage=%s", name)


async def reconcile_pipeline_on_startup(redis) -> dict:
    window_hours = float(os.getenv("RECONCILE_WINDOW_HOURS", "48"))
    max_items = int(os.getenv("RECONCILE_MAX_ITEMS", "2000"))
    since = datetime.now(timezone.utc) - timedelta(hours=window_hours)
    summary: dict = {
        "reconciled_stale_pending": 0,
        "reconciled_raw_trades": 0,
        "reconciled_whale_trades": 0,
        "reconciled_alerts": 0,
        "failed_stages": [],
    }

    # Stage 0 first and unconditionally: it is the only stage whose failure
    # mode is permanent (see module docstring).
    await _run_stage(
        "reconciled_stale_pending",
        summary,
        release_stale_pending_claims,
    )
    await _run_stage(
        "reconciled_raw_trades",
        summary,
        lambda: _reenqueue_missing_whale_trades(redis, since, max_items),
    )
    await _run_stage(
        "reconciled_whale_trades",
        summary,
        lambda: _reenqueue_missing_alerts(redis, since, max_items),
    )
    await _run_stage(
        "reconciled_alerts",
        summary,
        lambda: _reenqueue_undelivered_alerts(redis, since, max_items),
    )

    logger.info(
        "pipeline_reconciliation_done raw=%d whale=%d stale_pending=%d alerts=%d "
        "window_h=%s failed_stages=%s",
        summary["reconciled_raw_trades"],
        summary["reconciled_whale_trades"],
        summary["reconciled_stale_pending"],
        summary["reconciled_alerts"],
        window_hours,
        ",".join(summary["failed_stages"]) or "none",
    )
    return summary
