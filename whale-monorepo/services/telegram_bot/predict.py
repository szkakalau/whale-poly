"""Telegram /predict command — fuses whale signals into a single prediction score.

Replaces the legacy /analyze (text-only) with a structured fusion result:
  - Composite score 0-100 + direction + confidence level
  - 4-signal breakdown (whale quality / behavior / VW / flow)
  - Kelly position sizing (Elite only)
  - User hash watermark for leak tracing
"""

from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

import httpx
from sqlalchemy import func, select
from telegram import Bot, Update
from telegram.ext import ContextTypes

from shared.config import settings
from shared.db import SessionLocal
from shared.models import Subscription

logger = logging.getLogger(__name__)

API_TIMEOUT = 12.0  # seconds — prediction may need DB lookups


def _landing_base_url() -> str:
    import os
    raw = (os.getenv("LANDING_PUBLIC_BASE_URL") or "").strip()
    if raw:
        return raw.rstrip("/")
    return settings.landing_base_url


def _user_hash(telegram_id: str) -> str:
    h = hashlib.sha1(
        (settings.bot_user_hash_secret + ":" + telegram_id).encode("utf-8")
    ).hexdigest()
    return h[:6]


async def _get_user_plan(telegram_id: str) -> str:
    """Look up the user's current plan tier from the Subscription table."""
    now = datetime.now(timezone.utc)
    async with SessionLocal() as session:
        sub = (
            await session.execute(
                select(Subscription.plan)
                .where(Subscription.telegram_id == telegram_id)
                .where(Subscription.status.in_(["active", "trialing"]))
                .where(Subscription.current_period_end > now)
                .order_by(
                    # best plan first (ELITE > PRO > others)
                    func.lower(Subscription.plan).desc()
                )
                .limit(1)
            )
        ).scalars().first()
    if not sub:
        return "FREE"
    plan = sub.upper()
    if plan in ("PRO", "ELITE"):
        return plan
    return "FREE"


def _direction_emoji(direction: str) -> str:
    return {"bullish": "🟢", "bearish": "🔴", "neutral": "⚪️", "mixed": "🟡"}.get(
        direction, "⚪️"
    )


def _direction_label(direction: str) -> str:
    return {
        "bullish": "看涨",
        "bearish": "看跌",
        "neutral": "中性",
        "mixed": "多空分歧",
    }.get(direction, direction)


def _source_emoji(source: str) -> str:
    return {
        "whale_quality": "🐋",
        "behavior": "📈",
        "vw_analysis": "📊",
        "flow_direction": "💧",
    }.get(source, "•")


def _score_bar(normalized: int, width: int = 8) -> str:
    """Draw a proportional 8-block bar for the score (0-100)."""
    filled = min(width, max(0, round(normalized / 100 * width)))
    return "█" * filled + "░" * (width - filled)


def _confidence_label(level: str) -> str:
    return {"high": "高", "medium": "中", "low": "低"}.get(level, level)


def _tier_prob(score: int, direction: str) -> int:
    """Rough probability estimate from score tier (mirrors TypeScript tierProbability)."""
    if score >= 90:
        base = 72
    elif score >= 80:
        base = 65
    elif score >= 70:
        base = 58
    else:
        base = 52

    if direction == "bullish":
        return base + 3
    if direction == "bearish":
        return base - 3
    return base


def format_prediction(payload: dict, telegram_id: str) -> str:
    """Format a FusionResult payload into a Telegram HTML message."""
    p = payload.get("prediction") or {}
    if not p:
        return "⚠️ 该市场暂无鲸鱼预测数据。"

    score = int(p.get("compositeScore", 0))
    direction = p.get("direction", "neutral")
    confidence = p.get("confidenceLevel", "low")
    agreement = int(p.get("agreementScore", 0))
    market_slug = p.get("marketSlug", "")
    components = p.get("signalComponents") or []
    dominant = p.get("dominantSignal", "")
    tier = payload.get("tier", "free")
    probability = p.get("probability")  # float 0-1 or null

    emoji = _direction_emoji(direction)
    dir_label = _direction_label(direction)
    conf_label = _confidence_label(confidence)

    polymarket_url = f"https://polymarket.com/event/{market_slug}" if market_slug else ""

    lines = [
        f"🔮 <b>Signal Fusion</b>",
        "",
        f"{emoji} <b>{dir_label}</b> — 综合评分 <code>{score}</code>/100",
    ]

    # Probability
    if probability is not None:
        prob_pct = round(float(probability) * 100)
        lines.append(f"📐 P(YES) = <b>{prob_pct}%</b>")
    elif tier == "FREE":
        lines.append(f"📐 P(YES) ≈ <b>{_tier_prob(score, direction)}%</b> (预估)")

    lines.append(f"🎯 置信度: <b>{conf_label}</b> | 信号一致性: <code>{agreement}</code>%")

    # Signal breakdown bars
    if components:
        lines.append("")
        lines.append("📊 <b>信号明细:</b>")
        for c in components:
            src_emoji = _source_emoji(c.get("source", ""))
            name = c.get("name", "?")
            norm = int(c.get("normalizedValue", 0))
            contrib = round(c.get("contribution", 0))
            signed_val = round(c.get("signedValue", 0))
            sign = "+" if signed_val > 0 else "-" if signed_val < 0 else " "
            bar = _score_bar(norm)
            lines.append(
                f"{src_emoji} {name:<16} {bar} {norm:>3} → {sign}{abs(contrib)} 贡献"
            )

    # Agreement summary
    if agreement >= 70:
        agree_text = "强一致 — 信号高度同向"
    elif agreement >= 30:
        agree_text = "中度一致 — 存在部分分歧"
    else:
        agree_text = "信号分歧 — 建议谨慎"
    lines.append("")
    lines.append(f"🤝 信号一致性: {agree_text}")

    # Kelly (Elite only — placeholder; real data comes from /api/position-sizing)
    if tier == "ELITE" and score >= 60:
        lines.append("")
        lines.append("💰 <b>Kelly 仓位 (Elite)</b>")
        lines.append(
            "请使用 /kelly 命令获取最优仓位建议。"
        )

    # Free tier upgrade teaser
    if tier == "FREE":
        lines.append("")
        lines.append(
            "🔓 升级到 Pro/Elite 解锁完整 4 信号融合 + "
            "鲸鱼质量 + 量价分析。"
        )

    if polymarket_url:
        lines.append("")
        lines.append(f"🔗 {polymarket_url}")

    lines.append("")
    lines.append(f"<code>#{_user_hash(telegram_id)}</code>")

    return "\n".join(lines)


async def predict_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /predict <market_slug> — fuse all signals into a single score."""
    if not update.effective_chat or update.effective_chat.type != "private":
        if update.effective_message:
            await update.effective_message.reply_text(
                "This bot only works in private chats."
            )
        return

    # Extract market slug
    try:
        raw = (update.effective_message.text or "").strip()
    except Exception:
        raw = ""
    parts = raw.split(maxsplit=1)
    slug = (parts[1] or "").strip() if len(parts) > 1 else ""

    if not slug:
        await update.effective_message.reply_text(
            "🔮 <b>/predict</b> — 鲸鱼信号融合预测\n\n"
            "使用方法：<code>/predict &lt;market_slug&gt;</code>\n\n"
            "例如:\n"
            "• <code>/predict will-btc-hit-150k-in-2026</code>\n"
            "• <code>/predict will-trump-win-2024</code>\n\n"
            "系统融合 4 路信号（鲸鱼质量、交易行为、量价偏离、资金流向）"
            "输出综合评分 + 方向预测。",
            parse_mode="HTML",
        )
        return

    telegram_id = str(update.effective_user.id)
    await context.bot.send_chat_action(
        chat_id=update.effective_chat.id, action="typing"
    )

    # Lookup user plan for tier-gated API call
    try:
        plan = await _get_user_plan(telegram_id)
    except Exception:
        logger.exception("predict_plan_lookup_failed")
        plan = "FREE"

    params = {"market": slug, "tier": plan}
    url = f"{_landing_base_url()}/api/prediction?{urlencode(params)}"

    try:
        headers = {}
        secret = getattr(settings, "internal_gateway_secret", None) or os.environ.get("INTERNAL_GATEWAY_SECRET", "")
        if secret:
            headers["x-internal-secret"] = secret
        async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
            resp = await client.get(url, headers=headers if headers else None)
            resp.raise_for_status()
            data: dict[str, Any] = resp.json()
    except httpx.HTTPStatusError as e:
        try:
            body = e.response.json()
            msg = body.get("message") or body.get("error", str(e))
        except Exception:
            msg = "⚠️ 预测服务暂时不可用，请稍后再试。"
        await update.effective_message.reply_text(msg)
        return
    except Exception:
        logger.exception("predict_api_call_failed slug=%s", slug)
        await update.effective_message.reply_text(
            "⚠️ 预测服务暂时不可用，请稍后再试（通常 &lt; 5 分钟恢复）。",
            parse_mode="HTML",
        )
        return

    # Inject tier info so formatter can show/hide Kelly
    data["tier"] = plan

    text = format_prediction(data, telegram_id)
    await update.effective_message.reply_text(
        text,
        parse_mode="HTML",
        disable_web_page_preview=True,
    )
