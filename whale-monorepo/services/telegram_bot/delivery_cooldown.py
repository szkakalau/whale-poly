"""Per-source delivery cooldown (Phase B) + digest buffer (Phase C) for Telegram alerts."""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from enum import Enum
from math import log10
from redis.asyncio import Redis

from services.telegram_bot.recipients import AlertRecipient
from shared.config import settings

logger = logging.getLogger("telegram_bot.delivery_cooldown")


class CooldownAction(str, Enum):
  PROCEED = "proceed"
  QUEUED = "queued"
  FLUSH_ONLY = "flush_only"


@dataclass
class CooldownHandleResult:
  action: CooldownAction
  backlog_raws: list[str] | None = None
  flush_combined_text: str | None = None
  flushed_raws: list[str] | None = None


_SKIP_COOLDOWN_SOURCES = frozenset({"admin", "health", "broadcast"})


def recipients_for_cooldown(group: list[AlertRecipient]) -> list[AlertRecipient]:
  return [r for r in group if r.source_type not in _SKIP_COOLDOWN_SOURCES]


def cd2_key(telegram_id: str, source_type: str, source_id: str) -> str:
  return f"cd2:{telegram_id}:{source_type}:{source_id}"


def digest_list_key(telegram_id: str) -> str:
  return f"dig2:{telegram_id}"


def compute_effective_fields(payload: dict) -> tuple[float, float]:
  """Returns (whale_score, notional_usd) for logging."""
  try:
    score = float(payload.get("whale_score") or payload.get("score") or 0.0)
  except (TypeError, ValueError):
    score = 0.0
  try:
    notional = float(payload.get("size") or payload.get("amount") or 0.0)
  except (TypeError, ValueError):
    notional = 0.0
  return score, notional


def compute_effective_score(payload: dict) -> float:
  score, notional = compute_effective_fields(payload)
  cap = float(settings.cooldown_v2_notional_cap_usd)
  floor = float(settings.cooldown_v2_notional_floor_usd)
  notional = max(notional, floor)
  notional = min(notional, cap)
  return score + log10(notional) * 5.0


def base_cooldown_seconds(effective_score: float) -> int:
  if effective_score >= 95.0:
    return 60
  if effective_score >= 90.0:
    return 120
  if effective_score >= 85.0:
    return 300
  if effective_score >= 80.0:
    return 600
  return 900


def tier_cooldown_multiplier(plan: str) -> float:
  p = (plan or "FREE").upper()
  if p == "FREE":
    return 2.0
  if p == "ELITE":
    return 0.5
  return 1.0


def cooldown_seconds_for_plan(effective_score: float, plan: str) -> int:
  """Wall-clock gap between pushes for this signal strength + subscription tier. Keep in sync with landing `alertCooldown.ts`."""

  base_sec = base_cooldown_seconds(effective_score)
  mult = tier_cooldown_multiplier(plan)
  return max(int(base_sec * mult), int(settings.cooldown_v2_min_seconds))


def plan_allows_bypass(plan: str) -> bool:
  return (plan or "FREE").upper() in ("PRO", "ELITE")


async def _read_cd_state(redis: Redis, key: str) -> tuple[float | None, float | None]:
  mapping = await redis.hgetall(key)
  if not mapping:
    return None, None
  try:
    last_at = float(mapping.get("last_at") or 0.0)
    last_score = float(mapping.get("last_score") or 0.0)
    return last_at, last_score
  except (TypeError, ValueError):
    return None, None


async def record_push_for_group(
  redis: Redis,
  telegram_id: str,
  group: list[AlertRecipient],
  effective_score: float,
  now_ts: float | None = None,
) -> None:
  scorable = recipients_for_cooldown(group)
  if not scorable or not settings.alert_cooldown_v2_enabled:
    return
  ts = float(now_ts if now_ts is not None else time.time())
  for r in scorable:
    key = cd2_key(telegram_id, r.source_type, r.source_id)
    await redis.hset(key, mapping={"last_at": str(ts), "last_score": str(effective_score)})
    await redis.expire(key, int(settings.cooldown_v2_state_ttl_seconds))


async def _any_source_allows_send(
  redis: Redis,
  telegram_id: str,
  group: list[AlertRecipient],
  effective_score: float,
  cooldown_sec: int,
  bypass: bool,
  delta: float,
  now_ts: float,
) -> bool:
  scorable = recipients_for_cooldown(group)
  if not scorable:
    return True

  for r in scorable:
    key = cd2_key(telegram_id, r.source_type, r.source_id)
    last_at, last_score = await _read_cd_state(redis, key)
    if last_at is None:
      return True
    if now_ts - last_at >= float(cooldown_sec):
      return True
    if bypass and effective_score > last_score + delta:
      logger.debug(
        "cooldown_v2_bypass tid=%s key=%s eff=%s last_score=%s",
        telegram_id,
        key,
        effective_score,
        last_score,
      )
      return True
  return False


def _max_effective_from_raws(raws: list[str]) -> float:
  best = 0.0
  for raw in raws:
    try:
      payload = json.loads(raw)
      best = max(best, compute_effective_score(payload))
    except Exception:
      continue
  return best


async def handle_cooldown_before_send(
  redis: Redis,
  telegram_id: str,
  plan_name: str,
  payload: dict,
  payload_raw: str,
  matched_group: list[AlertRecipient],
  format_digest_fn,
) -> CooldownHandleResult:
  if not settings.alert_cooldown_v2_enabled:
    return CooldownHandleResult(CooldownAction.PROCEED, backlog_raws=[])

  scorable = recipients_for_cooldown(matched_group)
  if not scorable:
    return CooldownHandleResult(CooldownAction.PROCEED, backlog_raws=[])

  effective = compute_effective_score(payload)
  now_ts = time.time()
  cooldown_sec = cooldown_seconds_for_plan(effective, plan_name)
  bypass = plan_allows_bypass(plan_name)
  delta = float(settings.cooldown_v2_bypass_delta)

  allows = await _any_source_allows_send(
    redis,
    telegram_id,
    matched_group,
    effective,
    cooldown_sec,
    bypass,
    delta,
    now_ts,
  )

  dkey = digest_list_key(telegram_id)

  if not allows:
    await redis.rpush(dkey, payload_raw)
    n = int(await redis.llen(dkey))
    logger.info(
      "cooldown_v2_queued tid=%s eff=%s cd_sec=%s depth=%s",
      telegram_id,
      round(effective, 2),
      cooldown_sec,
      n,
    )
    if n >= int(settings.cooldown_v2_digest_max):
      items = await redis.lrange(dkey, 0, -1)
      await redis.delete(dkey)
      body = format_digest_fn(items, telegram_id)
      return CooldownHandleResult(
        CooldownAction.FLUSH_ONLY,
        flush_combined_text=body,
        flushed_raws=list(items),
      )
    return CooldownHandleResult(CooldownAction.QUEUED)

  backlog = await redis.lrange(dkey, 0, -1)
  if backlog:
    await redis.delete(dkey)
    logger.info("cooldown_v2_backlog_merged tid=%s n=%s", telegram_id, len(backlog))
  return CooldownHandleResult(CooldownAction.PROCEED, backlog_raws=list(backlog))


async def record_after_digest_flush(
  redis: Redis,
  telegram_id: str,
  matched_group: list[AlertRecipient],
  flushed_raws: list[str],
) -> None:
  if not flushed_raws:
    return
  eff = _max_effective_from_raws(flushed_raws)
  await record_push_for_group(redis, telegram_id, matched_group, eff, time.time())
