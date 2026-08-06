"""Daily prediction digest — sends a morning summary of top signal-fusion predictions.

Runs at Beijing 08:30 (UTC 00:30) so subscribers wake up to fresh predictions.
Queries the landing API for recent top whale activity markets and their fusion scores.

Pattern: matches `daily_vw_digest.py` — asyncio background task, sends to paid subscribers.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, time, timezone

import httpx
from telegram import Bot
from telegram.error import TelegramError

from shared.config import settings
from services.telegram_bot.recipients import get_active_subscribers

logger = logging.getLogger(__name__)

API_TIMEOUT = 15.0

# Markets to include in the digest — hand-picked high-volume Polymarket events.
# In production this could be replaced with a dynamic discovery query.
_DIGEST_MARKETS: list[str] = []


def _landing_base_url() -> str:
    import os
    raw = (os.getenv("LANDING_PUBLIC_BASE_URL") or "").strip()
    if raw:
        return raw.rstrip("/")
    return settings.landing_base_url


async def _fetch_prediction(client: httpx.AsyncClient, slug: str) -> dict | None:
    """Fetch a single market's prediction. Returns None on failure."""
    try:
        resp = await client.get(
            f"{_landing_base_url()}/api/prediction",
            params={"market": slug, "tier": "PRO"},
            timeout=API_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        return data
    except Exception:
        logger.debug("digest_prediction_fetch_failed slug=%s", slug, exc_info=True)
        return None


def _format_digest_line(p: dict) -> str | None:
    """Format one prediction into a compact digest line."""
    score = int(p.get("compositeScore", 0))
    direction = p.get("direction", "neutral")
    slug = p.get("marketSlug", "")

    dir_emoji = {"bullish": "🟢", "bearish": "🔴", "neutral": "⚪️", "mixed": "🟡"}.get(
        direction, "⚪️"
    )
    dir_label = {
        "bullish": "看涨",
        "bearish": "看跌",
        "neutral": "中性",
        "mixed": "分歧",
    }.get(direction, direction)

    return f"{dir_emoji} <b>{score}</b> {dir_label} — <code>{slug[:40]}</code>"


def _format_digest(results: list[dict]) -> str:
    """Build the daily prediction digest message."""
    now = datetime.now(timezone.utc)
    date_str = now.strftime("%m月%d日")

    lines = [
        f"🔮 <b>Signal Fusion 每日预测</b> · {date_str}",
        "",
    ]

    predictions = []
    for r in results:
        pred = r.get("prediction") if isinstance(r, dict) else None
        if pred and pred.get("compositeScore", 0) > 0:
            predictions.append(pred)

    if not predictions:
        lines.append("今日暂无高信号预测。稍后再来查看。")
    else:
        # Sort by composite score descending
        predictions.sort(key=lambda p: p.get("compositeScore", 0), reverse=True)
        top = predictions[:5]

        for i, p in enumerate(top, 1):
            line = _format_digest_line(p)
            if line:
                lines.append(f"{i}. {line}")

    lines.append("")
    lines.append(f"完整分析 → {_landing_base_url()}/analyze")
    lines.append("")
    lines.append(
        "💡 使用 <code>/predict &lt;market&gt;</code> 查看任意市场详细预测"
    )

    return "\n".join(lines)


async def run_prediction_digest(stop: asyncio.Event, bot: Bot) -> None:
    """Send daily prediction digest at Beijing 08:30 (UTC 00:30)."""
    logger.info("prediction_digest_started")

    while not stop.is_set():
        now = datetime.now(timezone.utc)
        # Beijing 08:30 = UTC 00:30
        target_utc = time(0, 30)
        seconds_until = (
            (target_utc.hour - now.hour) * 3600
            + (target_utc.minute - now.minute) * 60
            - now.second
        )
        if seconds_until < 0:
            seconds_until += 86400

        logger.info(f"prediction_digest_next_in {seconds_until}s")
        await asyncio.sleep(seconds_until)

        try:
            subscribers = await get_active_subscribers(paid_only=True)
            if not subscribers:
                logger.info("prediction_digest_no_subscribers")
                continue

            # Discover: fetch predictions for configured markets
            async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
                # First, try to get active market list from the API
                # If _DIGEST_MARKETS is empty, we just send a generic message
                if not _DIGEST_MARKETS:
                    # Query the history endpoint for recent markets
                    try:
                        resp = await client.get(
                            f"{_landing_base_url()}/api/history/summary",
                            timeout=API_TIMEOUT,
                        )
                        if resp.status_code == 200:
                            summary = resp.json()
                            # Extract unique market slugs from recent activity
                            recent_markets: list[str] = []
                            tiers = summary.get("byScoreTier", []) if isinstance(summary, dict) else []
                            for tier in tiers:
                                items = tier.get("items", []) if isinstance(tier, dict) else []
                                for item in items[:5]:
                                    slug = item.get("marketSlug") if isinstance(item, dict) else None
                                    if slug and slug not in recent_markets:
                                        recent_markets.append(slug)
                            _DIGEST_MARKETS[:] = recent_markets[:5]
                    except Exception:
                        logger.debug("digest_discovery_failed", exc_info=True)

                markets = _DIGEST_MARKETS if _DIGEST_MARKETS else []

                if markets:
                    tasks = [_fetch_prediction(client, slug) for slug in markets]
                    results = await asyncio.gather(*tasks)
                    valid = [r for r in results if r is not None]
                else:
                    valid = []

            message = _format_digest(valid)

            sent = 0
            for tg_id in subscribers:
                try:
                    await bot.send_message(
                        tg_id, message, parse_mode="HTML", disable_web_page_preview=True
                    )
                    sent += 1
                except TelegramError:
                    await asyncio.sleep(0.05)
                    continue

            logger.info(f"prediction_digest_sent recipients={sent} markets={len(valid)}")

        except Exception:
            logger.exception("prediction_digest_failed")
            await asyncio.sleep(60)
