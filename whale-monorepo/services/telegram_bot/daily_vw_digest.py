import asyncio
import logging
from datetime import datetime, time, timezone

from sqlalchemy import text
from telegram import Bot
from telegram.error import TelegramError

from shared.config import settings, get_alert_config
from shared.db import SessionLocal
from services.telegram_bot.recipients import get_active_subscribers

logger = logging.getLogger(__name__)


async def _query_top_divergence(session, limit: int = 3):
    """查询偏离度绝对值最大的 Top N 市场"""
    result = await session.execute(
        text("""
            SELECT m.title, vw.vw_divergence, vw.signal_direction, vw.signal_strength,
                   vw.total_volume_usd, vw.uai
            FROM market_vw_metrics vw
            JOIN markets m ON vw.market_id = m.id
            WHERE vw.status = 'active'
            ORDER BY ABS(vw.vw_divergence) DESC
            LIMIT :limit
        """),
        {"limit": limit},
    )
    return result.fetchall()


async def _query_uai_anomalies(session, uai_threshold: float = 0.3):
    """查询 UAI 异常低的市场（极度冷门厌恶）"""
    result = await session.execute(
        text("""
            SELECT m.title, vw.uai, vw.vw_divergence
            FROM market_vw_metrics vw
            JOIN markets m ON vw.market_id = m.id
            WHERE vw.status = 'active' AND vw.uai IS NOT NULL AND vw.uai < :threshold
            ORDER BY vw.uai ASC
            LIMIT 5
        """),
        {"threshold": uai_threshold},
    )
    return result.fetchall()


async def _query_cross_signals(session):
    """查询有 Whale + VW 交叉信号的市场，返回 (rows, total_count)"""
    count_result = await session.execute(
        text("""
            SELECT COUNT(DISTINCT m.id)
            FROM market_vw_metrics vw
            JOIN markets m ON vw.market_id = m.id
            JOIN whale_trades wt ON vw.market_id = wt.market_id
            WHERE vw.status = 'active'
              AND wt.created_at > NOW() - INTERVAL '24 hours'
        """),
    )
    total_count = count_result.scalar()

    result = await session.execute(
        text("""
            SELECT DISTINCT m.title, vw.signal_direction AS vw_dir,
                   vw.vw_divergence
            FROM market_vw_metrics vw
            JOIN markets m ON vw.market_id = m.id
            JOIN whale_trades wt ON vw.market_id = wt.market_id
            WHERE vw.status = 'active'
              AND wt.created_at > NOW() - INTERVAL '24 hours'
            ORDER BY ABS(vw.vw_divergence) DESC
            LIMIT 10
        """),
    )
    return result.fetchall(), total_count


def _format_digest(top, uai_anomalies, cross_count: int, uai_threshold: float = 0.3) -> str:
    lines = ["📊 昨日量价综述 · " + datetime.now(timezone.utc).strftime("%m月%d日"), ""]

    if top:
        lines.append("🔥 量价偏离 Top 3:")
        for i, row in enumerate(top, 1):
            div = float(row[1])
            lines.append(
                f"{i}. {row[0]} — {'YES偏多' if div > 0 else 'NO偏多'} {div:+.1%}"
            )
        lines.append("")

    if uai_anomalies:
        lines.append(f"❄️ 冷门厌恶异常（UAI < {uai_threshold}）:")
        for row in uai_anomalies:
            lines.append(f"· {row[0]} UAI={float(row[1]):.2f}")
        lines.append("")

    if cross_count > 0:
        lines.append(f"🐋 鲸鱼×量价交叉信号: {cross_count} 个市场有重叠活动")
        lines.append("")

    lines.append(f"查看完整 → {settings.landing_base_url}/volume-analysis")
    return "\n".join(lines)


async def run_daily_digest(stop: asyncio.Event, bot: Bot) -> None:
    """发送每日量价综述（北京时间 09:00）"""
    logger.info("daily_vw_digest_started")

    while not stop.is_set():
        now = datetime.now(timezone.utc)
        # 北京时间 09:00 = UTC 01:00
        target_utc = time(1, 0)
        seconds_until = (
            (target_utc.hour - now.hour) * 3600
            + (target_utc.minute - now.minute) * 60
            - now.second
        )
        if seconds_until < 0:
            seconds_until += 86400  # 明天同一时间

        logger.info(f"daily_vw_digest_next_in {seconds_until}s")
        await asyncio.sleep(seconds_until)

        try:
            async with SessionLocal() as session:
                vw_cfg = get_alert_config().get("vw_analysis", {})
                uai_threshold = vw_cfg.get("uai_low_threshold", 0.3)
                top = await _query_top_divergence(session)
                uai = await _query_uai_anomalies(session, uai_threshold)
                cross_rows, cross_count = await _query_cross_signals(session)
                message = _format_digest(top, uai, cross_count, uai_threshold)

            subscribers = await get_active_subscribers(paid_only=True)
            sent = 0
            for tg_id in subscribers:
                try:
                    await bot.send_message(tg_id, message, disable_web_page_preview=True)
                    sent += 1
                except TelegramError:
                    await asyncio.sleep(0.05)
                    continue

            logger.info(f"daily_vw_digest_sent recipients={sent}")

        except Exception:
            logger.exception("daily_vw_digest_failed")
            await asyncio.sleep(60)
