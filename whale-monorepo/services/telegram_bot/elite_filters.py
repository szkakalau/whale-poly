"""Phase E: optional ELITE-only delivery filters (effective floor + top-% among followed whales)."""

from __future__ import annotations

import logging
import math
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from services.telegram_bot.delivery_cooldown import compute_effective_score
from services.telegram_bot.recipients import AlertRecipient
from shared.config import settings
from shared.models import User, WhaleFollow, WhaleStats

logger = logging.getLogger("telegram_bot.elite_filters")


def _has_direct_whale_follow(matched_group: list[AlertRecipient], wallet: str) -> bool:
  w = (wallet or "").lower()
  if not w:
    return False
  return any(r.source_type == "whale" and (r.source_id or "").lower() == w for r in matched_group)


async def elite_delivery_allowed(
  session: AsyncSession,
  telegram_id: str,
  wallet: str,
  payload: dict,
  plan_name: str,
  matched_group: list[AlertRecipient],
) -> bool:
  if not settings.elite_delivery_filters_enabled:
    return True
  if (plan_name or "").upper() != "ELITE":
    return True

  effective = compute_effective_score(payload)
  floor = float(settings.elite_min_effective_score)
  if floor > 0.0 and effective < floor:
    logger.info(
      "elite_filter_drop_effective tid=%s wallet=%s eff=%s floor=%s",
      telegram_id,
      (wallet or "")[:10],
      round(effective, 2),
      floor,
    )
    return False

  pct = float(settings.elite_top_percent_of_follows)
  if pct <= 0.0 or not _has_direct_whale_follow(matched_group, wallet):
    return True

  user_id = (
    await session.execute(
      select(User.id).where(or_(User.telegram_id == str(telegram_id), User.id == str(telegram_id)))
    )
  ).scalars().first()
  if not user_id:
    return True

  follow_wallets = (
    await session.execute(
      select(WhaleFollow.wallet).where(WhaleFollow.user_id == str(user_id)).where(WhaleFollow.enabled.is_(True))
    )
  ).scalars().all()
  wallets_norm = [str(w).lower() for w in follow_wallets if w]
  n = len(wallets_norm)
  if n <= 1:
    return True

  wallets_lower_set = list(dict.fromkeys(wallets_norm))
  stats_rows = (
    await session.execute(
      select(WhaleStats.wallet_address, WhaleStats.whale_score).where(
        func.lower(WhaleStats.wallet_address).in_(wallets_lower_set)
      )
    )
  ).all()
  score_by_wallet = {str(wa or "").lower(): int(ws or 0) for wa, ws in stats_rows}

  scores_sorted = sorted(score_by_wallet.get(w, 0) for w in wallets_norm)
  k = max(1, math.ceil((pct / 100.0) * n))
  k = min(k, n)
  threshold = scores_sorted[n - k]
  try:
    payload_score = int(
      float(payload.get("whale_score") or payload.get("score") or 0),
    )
  except (TypeError, ValueError):
    payload_score = 0
  cur = score_by_wallet.get((wallet or "").lower(), payload_score)

  if cur < threshold:
    logger.info(
      "elite_filter_drop_top_pct tid=%s cur=%s thr=%s n_follows=%s pct=%s",
      telegram_id,
      cur,
      threshold,
      n,
      pct,
    )
    return False
  return True
