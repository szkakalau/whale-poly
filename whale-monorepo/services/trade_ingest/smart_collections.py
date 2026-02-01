import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

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
                    smart_collection_id=col.id,
                    wallet=w,
                    snapshot_date=snapshot,
                )
            )
        total_rows += len(wallets)

    return total_rows

