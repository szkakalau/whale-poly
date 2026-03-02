import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
import uuid

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import text

from shared.models import (
    SmartCollection,
    SmartCollectionWhale,
    WhaleProfile,
    WhaleScore,
)


def _parse_rule(rule_json: str) -> dict[str, Any]:
    try:
        data = json.loads(rule_json)
    except Exception:
        return {}
    if not isinstance(data, dict):
        return {}
    return data


async def _select_wallets_for_rule(session: AsyncSession, rule_json: str) -> list[str]:
    rule = _parse_rule(rule_json)
    min_score = rule.get("min_score")
    min_total_volume = rule.get("min_total_volume")
    min_total_trades = rule.get("min_total_trades")
    top_n_by_score = rule.get("top_n_by_score")

    stmt = (
        select(WhaleProfile.wallet_address)
        .join(WhaleScore, WhaleScore.wallet_address == WhaleProfile.wallet_address)
    )

    if isinstance(min_score, (int, float)):
        stmt = stmt.where(WhaleScore.final_score >= int(min_score))

    if isinstance(min_total_volume, (int, float, str)):
        try:
            v = Decimal(str(min_total_volume))
            stmt = stmt.where(WhaleProfile.total_volume >= v)
        except Exception:
            pass

    if isinstance(min_total_trades, (int, float)):
        stmt = stmt.where(WhaleProfile.total_trades >= int(min_total_trades))

    stmt = stmt.order_by(WhaleScore.final_score.desc())

    if isinstance(top_n_by_score, (int, float)) and int(top_n_by_score) > 0:
        stmt = stmt.limit(int(top_n_by_score))

    rows = (await session.execute(stmt)).scalars().all()
    return [str(w).lower() for w in rows if w]


async def ensure_smart_collection_tables(session: AsyncSession) -> None:
    try:
        await session.execute(text("select to_regclass('public.smart_collections')"))
        await session.execute(text("select to_regclass('public.smart_collection_whales')"))
        await session.execute(text("select to_regclass('public.smart_collection_subscriptions')"))
        # Try creating if missing (PostgreSQL)
        await session.execute(text("""
        CREATE TABLE IF NOT EXISTS smart_collections (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(256) NOT NULL,
          description VARCHAR(512),
          rule_json TEXT NOT NULL,
          enabled BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )"""))
        await session.execute(text("""
        CREATE TABLE IF NOT EXISTS smart_collection_whales (
          id VARCHAR(64) PRIMARY KEY,
          smart_collection_id VARCHAR(64) NOT NULL,
          wallet VARCHAR(128) NOT NULL,
          snapshot_date TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT smart_collection_wallet_unique UNIQUE (smart_collection_id, wallet, snapshot_date)
        )"""))
        await session.execute(text("CREATE INDEX IF NOT EXISTS ix_scw_collection_id ON smart_collection_whales (smart_collection_id)"))
        await session.execute(text("CREATE INDEX IF NOT EXISTS ix_scw_wallet ON smart_collection_whales (wallet)"))
        await session.execute(text("CREATE INDEX IF NOT EXISTS ix_scw_snapshot_date ON smart_collection_whales (snapshot_date)"))
        await session.execute(text("""
        CREATE TABLE IF NOT EXISTS smart_collection_subscriptions (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          smart_collection_id VARCHAR(64) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT user_smart_collection_unique UNIQUE (user_id, smart_collection_id)
        )"""))
        await session.execute(text("CREATE INDEX IF NOT EXISTS ix_scs_user_id ON smart_collection_subscriptions (user_id)"))
        await session.execute(text("CREATE INDEX IF NOT EXISTS ix_scs_collection_id ON smart_collection_subscriptions (smart_collection_id)"))
    except Exception:
        # SQLite fallback
        await session.execute(text("""
        CREATE TABLE IF NOT EXISTS smart_collections (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          rule_json TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at TEXT,
          updated_at TEXT
        )"""))
        await session.execute(text("""
        CREATE TABLE IF NOT EXISTS smart_collection_whales (
          id TEXT PRIMARY KEY,
          smart_collection_id TEXT NOT NULL,
          wallet TEXT NOT NULL,
          snapshot_date TEXT NOT NULL,
          created_at TEXT,
          updated_at TEXT,
          CONSTRAINT smart_collection_wallet_unique UNIQUE (smart_collection_id, wallet, snapshot_date)
        )"""))
        await session.execute(text("CREATE INDEX IF NOT EXISTS ix_scw_collection_id ON smart_collection_whales (smart_collection_id)"))
        await session.execute(text("CREATE INDEX IF NOT EXISTS ix_scw_wallet ON smart_collection_whales (wallet)"))
        await session.execute(text("CREATE INDEX IF NOT EXISTS ix_scw_snapshot_date ON smart_collection_whales (snapshot_date)"))
        await session.execute(text("""
        CREATE TABLE IF NOT EXISTS smart_collection_subscriptions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          smart_collection_id TEXT NOT NULL,
          created_at TEXT,
          updated_at TEXT,
          CONSTRAINT user_smart_collection_unique UNIQUE (user_id, smart_collection_id)
        )"""))
        await session.execute(text("CREATE INDEX IF NOT EXISTS ix_scs_user_id ON smart_collection_subscriptions (user_id)"))
        await session.execute(text("CREATE INDEX IF NOT EXISTS ix_scs_collection_id ON smart_collection_subscriptions (smart_collection_id)"))


async def rebuild_smart_collections(session: AsyncSession) -> int:
    now = datetime.now(timezone.utc)
    snapshot = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)

    collections = (
        await session.execute(
            select(SmartCollection).where(SmartCollection.enabled.is_(True))
        )
    ).scalars().all()

    total_rows = 0

    for col in collections:
        wallets = await _select_wallets_for_rule(session, col.rule_json)

        await session.execute(
            delete(SmartCollectionWhale)
            .where(SmartCollectionWhale.smart_collection_id == col.id)
            .where(SmartCollectionWhale.snapshot_date == snapshot)
        )

        for w in wallets:
            session.add(
                SmartCollectionWhale(
                    id=uuid.uuid4().hex,
                    smart_collection_id=col.id,
                    wallet=w,
                    snapshot_date=snapshot,
                )
            )
        total_rows += len(wallets)

    return total_rows
