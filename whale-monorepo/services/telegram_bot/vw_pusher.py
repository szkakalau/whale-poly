import asyncio
import json
import logging
from datetime import datetime, timezone

from redis.asyncio import Redis
from telegram import Bot
from telegram.error import TelegramError

from shared.config import settings
from services.telegram_bot.recipients import get_active_subscribers

logger = logging.getLogger(__name__)

# 服务级冷却：同市场 30 分钟内只推一次
_COOLDOWN: dict[str, float] = {}


def _format_alert(payload: dict, market_title: str) -> str:
    """格式化异动消息"""
    div = payload["divergence"]
    direction_text = "YES" if div > 0 else "NO"
    arrow = "📈" if div > 0 else "📉"
    uai = payload.get("uai")
    uai_text = ""
    if uai is not None:
        if uai < 0.3:
            uai_text = f"UAI {uai:.2f}（极度冷门厌恶）"
        elif uai < 0.6:
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


async def _get_market_title(db_pool, market_id: str) -> str:
    """从 DB 获取市场标题（fallback 到 market_id）"""
    # 简化实现：直接查 markets 表
    import asyncpg
    try:
        conn = await asyncpg.connect(settings.database_url)
        row = await conn.fetchrow(
            "SELECT title FROM markets WHERE id = $1", market_id
        )
        await conn.close()
        return row["title"] if row else market_id
    except Exception:
        return market_id


async def run_vw_pusher(stop: asyncio.Event, bot: Bot) -> None:
    """
    VW 异动推送主循环。
    在 bot.py 的 application 启动后作为后台任务运行。
    """
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
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

                # 服务级冷却检查
                now = datetime.now(timezone.utc).timestamp()
                if market_id in _COOLDOWN and (now - _COOLDOWN[market_id]) < 1800:
                    continue
                _COOLDOWN[market_id] = now

                market_title = await _get_market_title(None, market_id)
                message = _format_alert(payload, market_title)

                # 推送给 Pro/Elite 用户
                subscribers = await get_active_subscribers(paid_only=True)
                sent = 0
                for tg_id in subscribers:
                    try:
                        await bot.send_message(tg_id, message, disable_web_page_preview=True)
                        sent += 1
                    except TelegramError:
                        continue

                logger.info(f"vw_alert_delivered market={market_id} recipients={sent}")

            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("vw_pusher_error")
                await asyncio.sleep(1)
    finally:
        await redis.aclose()
        logger.info("vw_pusher_stopped")
