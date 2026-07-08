import asyncio
import json
import logging
from datetime import datetime, timezone

from redis.asyncio import Redis
from sqlalchemy import text
from telegram import Bot
from telegram.error import TelegramError

from shared.config import settings, get_alert_config
from shared.db import SessionLocal
from services.telegram_bot.recipients import get_active_subscribers

logger = logging.getLogger(__name__)

# Per-market cooldown TTL in seconds (30 min).
_VW_COOLDOWN_SECONDS = 1800


def _format_alert(payload: dict, market_title: str) -> str:
    """格式化异动消息"""
    vw_cfg = get_alert_config().get("vw_analysis", {})
    uai_low = vw_cfg.get("uai_low_threshold", 0.3)
    uai_high = vw_cfg.get("uai_high_threshold", 0.8)

    div = payload["divergence"]
    direction_text = "YES" if div > 0 else "NO"
    arrow = "📈" if div > 0 else "📉"
    uai = payload.get("uai")
    uai_text = ""
    if uai is not None:
        if uai < uai_low:
            uai_text = f"UAI {uai:.2f}（极度冷门厌恶）"
        elif uai < uai_high:
            uai_text = f"UAI {uai:.2f}（中等）"
        else:
            uai_text = f"UAI {uai:.2f}（资金关注冷门⚠️）"

    return (
        f"🚨 量价异动 · {market_title}\n\n"
        f"资金在5分钟内加速涌入{direction_text}方向 {arrow}\n"
        f"偏离度 {div:+.1%} | 信号强度 {payload['signal_strength']}\n"
        f"{uai_text}\n"
        f"查看 → {settings.landing_base_url}/volume-analysis"
    )


async def _get_market_title(market_id: str) -> str:
    """从 DB 获取市场标题（fallback 到 market_id）"""
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                text("SELECT title FROM markets WHERE id = :mid"),
                {"mid": market_id}
            )
            row = result.fetchone()
            return row[0] if row else market_id
    except Exception:
        return market_id


async def run_vw_pusher(stop: asyncio.Event, bot: Bot) -> None:
    """
    VW 异动推送主循环。
    在 bot.py 的 application 启动后作为后台任务运行。
    """
    from shared.async_utils import get_redis as _get_shared_redis
    redis = await _get_shared_redis()
    logger.info("vw_pusher_started")

    try:
        while not stop.is_set():
            try:
                item = await redis.blpop("vw_alert_queue", timeout=5)
                if item is None:
                    continue

                _, raw = item
                payload = json.loads(raw)
                market_id = payload["market_id"]

                # Per-market cooldown via Redis (shared across all worker instances).
                # Replaces the old in-memory _COOLDOWN dict which was per-process
                # and caused duplicate alerts across multiple instances.
                cooldown_key = f"vw_cooldown:{market_id}"
                if await redis.exists(cooldown_key):
                    continue
                await redis.set(cooldown_key, "1", ex=_VW_COOLDOWN_SECONDS)

                market_title = await _get_market_title(market_id)
                message = _format_alert(payload, market_title)

                # 推送给 Pro/Elite 用户（并发，最多 30 同时发送 — PF-H3）
                subscribers = await get_active_subscribers(paid_only=True)
                sem = asyncio.Semaphore(30)

                async def _send_one(tg_id: str) -> tuple[str, str | None]:
                    async with sem:
                        try:
                            await bot.send_message(tg_id, message, disable_web_page_preview=True)
                            return (tg_id, None)
                        except TelegramError as e:
                            err_msg = str(e)[:100]
                            logger.debug("vw_pusher_send_failed tg_id=%s market=%s error=%s", tg_id, market_id, err_msg)
                            return (tg_id, err_msg)

                results = await asyncio.gather(*[_send_one(tid) for tid in subscribers])
                sent = sum(1 for _, err in results if err is None)
                errors = len(results) - sent

                logger.info("vw_alert_delivered market=%s sent=%s errors=%s", market_id, sent, errors)

            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("vw_pusher_error")
                await asyncio.sleep(1)
    finally:
        await redis.aclose()
        logger.info("vw_pusher_stopped")
