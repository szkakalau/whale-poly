# services/whale_engine/vw.py

import json
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from shared.models.models import MarketVwMetrics, MarketVwSnapshot

logger = logging.getLogger(__name__)


def _normalize_outcome(outcome: Optional[str]) -> Optional[str]:
    """Normalize Polymarket outcome names to 'yes' or 'no'.

    Polymarket binary markets use either "Yes"/"No" or "Up"/"Down" convention.
    This normalizes both to lowercase for consistent handling.
    """
    if not outcome:
        return None
    o = outcome.strip().lower()
    if o in ("yes", "up", "y", "1"):
        return "yes"
    if o in ("no", "down", "n", "0"):
        return "no"
    return None  # Unknown outcome — skip


def _calc_vw_prices(trades: list[tuple]) -> Optional[dict]:
    """
    从交易列表计算 VW 价格和交易量。
    trades: [(outcome: str, amount: Decimal, price: Decimal), ...]
      - amount: outcome token 数量（如 "100 个 YES token"）
      - price: 每个 token 价格（0-1 USD）
    返回: { yes_vw_price, no_vw_price, yes_volume_usd, no_volume_usd } 或 None

    VW 公式: Σ(amount × price) / Σ(amount)
      分子 = USD 成交额，分母 = token 数量（用作权重）
    """
    yes_token_sum = Decimal("0")   # Σ(amount) — token count
    no_token_sum = Decimal("0")
    yes_turnover = Decimal("0")    # Σ(amount × price) — USD value
    no_turnover = Decimal("0")

    for outcome, amount, price in trades:
        direction = _normalize_outcome(outcome)
        if direction is None:
            continue
        usd = amount * price
        if direction == "yes":
            yes_turnover += usd
            yes_token_sum += amount
        elif direction == "no":
            no_turnover += usd
            no_token_sum += amount

    if yes_token_sum == 0 and no_token_sum == 0:
        return None

    result = {
        "yes_volume_usd": yes_turnover,   # USD 成交额（用于展示）
        "no_volume_usd": no_turnover,
        "yes_vw_price": (yes_turnover / yes_token_sum) if yes_token_sum > 0 else None,
        "no_vw_price": (no_turnover / no_token_sum) if no_token_sum > 0 else None,
    }
    return result


def _calc_divergence(
    yes_vw_price: Optional[Decimal],
    no_vw_price: Optional[Decimal],
    yes_market_price: Optional[Decimal],
) -> Optional[Decimal]:
    """计算 VW divergence = VW_yes_share - Price_yes。
    单方向市场：缺失方向 VW 当作 0。"""
    if yes_market_price is None:
        return None
    yvp = yes_vw_price or Decimal("0")
    nvp = no_vw_price or Decimal("0")
    total = yvp + nvp
    if total == 0:
        return None
    vw_yes_share = yvp / total
    return vw_yes_share - yes_market_price


def _calc_uai(
    yes_vw_price: Optional[Decimal],
    no_vw_price: Optional[Decimal],
    yes_market_price: Optional[Decimal],
    extreme_threshold: Decimal,
) -> Optional[Decimal]:
    """计算冷门厌恶指数 UAI。单方向市场：缺失方向 VW 当作 0。"""
    if yes_market_price is None:
        return None
    yvp = yes_vw_price or Decimal("0")
    nvp = no_vw_price or Decimal("0")
    total_vw = yvp + nvp
    if total_vw == 0:
        return None

    # 确定冷门方（价格 < 0.5 的一方）
    if yes_market_price < Decimal("0.5"):
        underdog_price = yes_market_price
        underdog_vw_share = yvp / total_vw
    elif yes_market_price > Decimal("0.5"):
        underdog_price = Decimal("1") - yes_market_price
        underdog_vw_share = nvp / total_vw
    else:
        return None  # 正好 0.5，无冷门方

    if underdog_price < extreme_threshold:
        return None

    return underdog_vw_share / underdog_price


def _calc_velocity(
    divergence_now: Optional[Decimal],
    divergence_past: Optional[Decimal],
    minutes: int,
) -> Optional[Decimal]:
    """计算偏离度变化速率（每分钟）"""
    if divergence_now is None or divergence_past is None:
        return None
    return (divergence_now - divergence_past) / Decimal(str(minutes))


def _determine_signal(
    divergence: Decimal, threshold: Decimal
) -> tuple[str, int]:
    """根据偏离度判定信号方向和强度"""
    abs_div = abs(divergence)
    strength = min(100, int(float(abs_div) * 200))

    if divergence > threshold:
        return ("bullish", strength)
    elif divergence < -threshold:
        return ("bearish", strength)
    return ("neutral", strength)


async def _get_market_price(session: AsyncSession, market_id: str) -> Optional[Decimal]:
    """
    获取市场最新 YES 价格（快照）。
    支持多种 outcome 命名：Yes/Up → yes 方向，No/Down → no 方向。
    若只有 no 方向成交，用 yes = 1 - no 推导。
    """
    result = await session.execute(
        text("""
            SELECT price FROM trades_raw
            WHERE market_id = :mid AND outcome IN ('Yes', 'Up', 'yes', 'YES')
            ORDER BY timestamp DESC LIMIT 1
        """),
        {"mid": market_id},
    )
    row = result.fetchone()
    if row:
        return row[0]

    # Fallback: derive from last NO/Down trade price
    result = await session.execute(
        text("""
            SELECT price FROM trades_raw
            WHERE market_id = :mid AND outcome IN ('No', 'Down', 'no', 'NO')
            ORDER BY timestamp DESC LIMIT 1
        """),
        {"mid": market_id},
    )
    row = result.fetchone()
    if row:
        return Decimal("1") - row[0]

    return None


async def _get_previous_snapshot(
    session: AsyncSession, market_id: str, minutes_ago: int
) -> Optional[Decimal]:
    """获取 N 分钟前的 divergence 快照值"""
    result = await session.execute(
        text("""
            SELECT vw_divergence FROM market_vw_snapshots
            WHERE market_id = :mid AND snapshot_at <= :cutoff
            ORDER BY snapshot_at DESC LIMIT 1
        """),
        {"mid": market_id, "cutoff": datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)},
    )
    row = result.fetchone()
    return row[0] if row else None


async def _get_last_alert_time(redis: Redis, market_id: str) -> Optional[float]:
    """获取该市场上次推送时间（unix timestamp）"""
    key = f"vw_alert_last:{market_id}"
    val = await redis.get(key)
    return float(val) if val else None


async def _set_last_alert_time(redis: Redis, market_id: str):
    """记录本次推送时间"""
    key = f"vw_alert_last:{market_id}"
    await redis.set(key, str(datetime.now(timezone.utc).timestamp()))


async def compute_vw_metrics(session: AsyncSession, redis: Redis, config: dict) -> int:
    """
    主计算函数：对活跃市场计算 VW 指标并写入 DB，突变时推送 Redis。
    返回成功计算的市场数。
    """
    window_days = config.get("computation_window_days", 7)
    min_24h_vol = Decimal(str(config.get("min_24h_volume_usd", 10000)))
    min_alert_vol = Decimal(str(config.get("min_alert_volume_usd", 50000)))
    divergence_threshold = Decimal(str(config.get("divergence_threshold", 0.10)))
    velocity_threshold = Decimal(str(config.get("velocity_5m_threshold", 0.03)))
    warmup_snapshots = config.get("new_market_warmup_snapshots", 3)
    cooldown_minutes = config.get("alert_cooldown_minutes", 30)
    uai_extreme = Decimal(str(config.get("uai_extreme_price_threshold", 0.02)))

    # 1. 找到最近 10 分钟内有交易且 24h 量达标的活跃市场
    # 用 CTE 先算 24h vol，避免 WHERE 10min 过滤吃掉 SUM 24h 的数据
    result = await session.execute(
        text("""
            WITH vol_24h AS (
                SELECT market_id, SUM(amount * price) AS vol
                FROM trades_raw
                WHERE timestamp > NOW() - INTERVAL '24 hours'
                GROUP BY market_id
            )
            SELECT DISTINCT t.market_id, COALESCE(v.vol, 0) AS vol_24h
            FROM trades_raw t
            JOIN markets m ON t.market_id = m.id
            LEFT JOIN vol_24h v ON t.market_id = v.market_id
            WHERE t.timestamp > NOW() - INTERVAL '10 minutes'
              AND (m.status IS NULL OR m.status != 'closed')
              AND COALESCE(v.vol, 0) >= :min_vol
        """),
        {"min_vol": min_24h_vol},
    )
    # Build dict: market_id → vol_24h
    active_markets = {row[0]: row[1] for row in result.fetchall()}

    if not active_markets:
        return 0

    computed_count = 0
    now = datetime.now(timezone.utc)

    for market_id, vol_24h in active_markets.items():
        try:
            # 使用参数化查询避免 SQL 注入：:days * INTERVAL '1 day' 支持绑定参数
            trade_result = await session.execute(
                text("""
                    SELECT outcome, amount, price
                    FROM trades_raw
                    WHERE market_id = :mid
                      AND timestamp > NOW() - (:days * INTERVAL '1 day')
                """),
                {"mid": market_id, "days": int(window_days)},
            )
            trades = [(row[0], row[1], row[2]) for row in trade_result.fetchall()]

            vw_data = _calc_vw_prices(trades)
            if vw_data is None:
                continue

            # 2b. 获取市场价格
            yes_market_price = await _get_market_price(session, market_id)
            if yes_market_price is None:
                continue

            # 2c. 计算指标
            divergence = _calc_divergence(
                vw_data["yes_vw_price"],
                vw_data["no_vw_price"],
                yes_market_price,
            )
            if divergence is None:
                continue

            uai = _calc_uai(
                vw_data["yes_vw_price"],
                vw_data["no_vw_price"],
                yes_market_price,
                uai_extreme,
            )

            # Velocity（查询历史快照）
            past_5m = await _get_previous_snapshot(session, market_id, 5)
            past_15m = await _get_previous_snapshot(session, market_id, 15)
            past_1h = await _get_previous_snapshot(session, market_id, 60)

            # 统计近24h快照数量判断是否预热完毕
            snapshot_count = await session.execute(
                text("""
                    SELECT COUNT(*) FROM market_vw_snapshots
                    WHERE market_id = :mid
                      AND snapshot_at >= NOW() - INTERVAL '24 hours'
                """),
                {"mid": market_id},
            )
            warmup_done = snapshot_count.scalar() >= warmup_snapshots

            velocity_5m = _calc_velocity(divergence, past_5m, 5) if warmup_done else None
            velocity_15m = _calc_velocity(divergence, past_15m, 15) if warmup_done else None
            velocity_1h = _calc_velocity(divergence, past_1h, 60) if warmup_done else None

            # 2d. 信号判定
            signal_direction, signal_strength = _determine_signal(divergence, divergence_threshold)

            # 突变检测
            is_mutation = (
                velocity_5m is not None and abs(velocity_5m) >= velocity_threshold
            )
            if is_mutation:
                signal_strength = min(100, int(signal_strength * 1.5))

            # 确定市场状态（基于 24h 成交量）
            total_vol = vw_data["yes_volume_usd"] + vw_data["no_volume_usd"]
            vol_24h_dec = Decimal(str(vol_24h))
            status = "active" if vol_24h_dec >= min_24h_vol else "dormant"

            # 2e. UPSERT market_vw_metrics
            await session.execute(
                text("""
                    INSERT INTO market_vw_metrics (
                        market_id, total_volume_usd, yes_volume_usd, no_volume_usd,
                        yes_vw_price, no_vw_price,
                        yes_market_price, no_market_price,
                        vw_divergence, uai,
                        vw_velocity_5m, vw_velocity_15m, vw_velocity_1h,
                        signal_direction, signal_strength, status, computed_at
                    ) VALUES (
                        :mid, :tv, :yv, :nv,
                        :yvp, :nvp,
                        :ymp, :nmp,
                        :div, :uai,
                        :v5, :v15, :v1h,
                        :sd, :ss, :st, :now
                    )
                    ON CONFLICT (market_id) DO UPDATE SET
                        total_volume_usd = EXCLUDED.total_volume_usd,
                        yes_volume_usd = EXCLUDED.yes_volume_usd,
                        no_volume_usd = EXCLUDED.no_volume_usd,
                        yes_vw_price = EXCLUDED.yes_vw_price,
                        no_vw_price = EXCLUDED.no_vw_price,
                        yes_market_price = EXCLUDED.yes_market_price,
                        no_market_price = EXCLUDED.no_market_price,
                        vw_divergence = EXCLUDED.vw_divergence,
                        uai = EXCLUDED.uai,
                        vw_velocity_5m = EXCLUDED.vw_velocity_5m,
                        vw_velocity_15m = EXCLUDED.vw_velocity_15m,
                        vw_velocity_1h = EXCLUDED.vw_velocity_1h,
                        signal_direction = EXCLUDED.signal_direction,
                        signal_strength = EXCLUDED.signal_strength,
                        status = EXCLUDED.status,
                        computed_at = EXCLUDED.computed_at
                """),
                {
                    "mid": market_id,
                    "tv": total_vol,
                    "yv": vw_data["yes_volume_usd"],
                    "nv": vw_data["no_volume_usd"],
                    "yvp": vw_data["yes_vw_price"],
                    "nvp": vw_data["no_vw_price"],
                    "ymp": yes_market_price,
                    "nmp": Decimal("1") - yes_market_price,
                    "div": divergence,
                    "uai": uai,
                    "v5": velocity_5m,
                    "v15": velocity_15m,
                    "v1h": velocity_1h,
                    "sd": signal_direction,
                    "ss": signal_strength,
                    "st": status,
                    "now": now,
                },
            )

            # 2f. INSERT snapshot
            await session.execute(
                text("""
                    INSERT INTO market_vw_snapshots (
                        market_id, vw_divergence, uai,
                        yes_vw_price, no_vw_price,
                        yes_market_price,
                        total_volume_usd, snapshot_at
                    ) VALUES (
                        :mid, :div, :uai,
                        :yvp, :nvp,
                        :ymp,
                        :tv, :now
                    )
                """),
                {
                    "mid": market_id,
                    "div": divergence,
                    "uai": uai,
                    "yvp": vw_data["yes_vw_price"],
                    "nvp": vw_data["no_vw_price"],
                    "ymp": yes_market_price,
                    "tv": total_vol,
                    "now": now,
                },
            )

            # 查询上一次信号方向（用于检测方向翻转）
            prev_dir_result = await session.execute(
                text("SELECT signal_direction FROM market_vw_metrics WHERE market_id = :mid"),
                {"mid": market_id},
            )
            prev_dir_row = prev_dir_result.fetchone()
            prev_direction = prev_dir_row[0] if prev_dir_row else None
            direction_changed = (
                prev_direction is not None
                and prev_direction != signal_direction
                and signal_direction != "neutral"
            )

            # 2g. 推送检查
            should_push = False
            if (is_mutation or direction_changed) and status == "active":
                last_alert = await _get_last_alert_time(redis, market_id)
                if last_alert is None or (datetime.now(timezone.utc).timestamp() - last_alert) > cooldown_minutes * 60:
                    should_push = True

            if should_push:
                payload = json.dumps({
                    "market_id": market_id,
                    "divergence": float(divergence),
                    "velocity_5m": float(velocity_5m) if velocity_5m else None,
                    "uai": float(uai) if uai else None,
                    "signal_direction": signal_direction,
                    "signal_strength": signal_strength,
                    "is_mutation": is_mutation,
                    "is_direction_change": direction_changed and not is_mutation,
                })
                await redis.rpush("vw_alert_queue", payload)
                await _set_last_alert_time(redis, market_id)
                logger.info(f"vw_mutation_pushed market={market_id} divergence={divergence}")

            computed_count += 1

        except Exception:
            logger.exception(f"vw_compute_failed market={market_id}")
            continue

    return computed_count


async def prune_vw_snapshots(session: AsyncSession, config: dict) -> int:
    """清理过期快照，执行三级降采样"""
    retention_days = config.get("snapshot_retention_days", 7)
    # TODO: implement hourly/daily aggregation in future enhancement
    deleted = 0

    # 使用参数化查询删除超过保留期的原始快照
    result = await session.execute(
        text("""
            DELETE FROM market_vw_snapshots
            WHERE snapshot_at < NOW() - (:days * INTERVAL '1 day')
        """),
        {"days": int(retention_days)},
    )
    deleted += result.rowcount

    # 注意：小时/天级聚合可以后续版本实现
    # 第一版先清理原始数据，聚合逻辑作为增强

    return deleted
