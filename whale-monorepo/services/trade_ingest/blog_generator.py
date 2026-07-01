"""LLM-powered daily blog article generator for SightWhale.

Produces one bilingual (EN + ZH) deep-dive article per day using real
on-chain whale trade data and DeepSeek V4 Pro.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from openai import OpenAI
from sqlalchemy import desc, func, select, text

from shared.config import settings
from shared.db import SessionLocal
from shared.models import Market, TradeRaw, WalletName, WhaleProfile, WhaleStats

logger = logging.getLogger("trade_ingest.blog_generator")

# ---------------------------------------------------------------------------
# Topic types — rotate to avoid repetition
# ---------------------------------------------------------------------------
TOPIC_TYPES = [
    "whale_behavior",       # 鲸鱼行为分析
    "strategy_tutorial",    # 交易策略教程
    "market_deep_dive",     # 市场深度解读
    "methodology",          # 方法论/框架
    "data_insights",        # 数据洞察报告
    "tools_tips",           # 工具/技巧
]

_topic_history: list[str] = []  # track last 3 topics to avoid repeats


def _llm_client() -> OpenAI:
    return OpenAI(
        api_key=settings.blog_llm_api_key,
        base_url=settings.blog_llm_base_url,
    )


# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------


async def fetch_context(lookback_hours: int = 24) -> dict[str, Any]:
    """Query the last N hours of on-chain data for article context."""
    now_utc = datetime.now(timezone.utc)
    start_time = now_utc - timedelta(hours=lookback_hours)

    async with SessionLocal() as session:
        # Top 5 whale trades by notional value
        stmt_top = (
            select(
                TradeRaw.wallet,
                TradeRaw.market_id,
                TradeRaw.side,
                (TradeRaw.amount * TradeRaw.price).label("notional"),
                TradeRaw.price,
                TradeRaw.timestamp,
                Market.title.label("market_title"),
                WalletName.polymarket_username,
            )
            .outerjoin(Market, TradeRaw.market_id == Market.id)
            .outerjoin(WalletName, TradeRaw.wallet == WalletName.wallet_address)
            .where(TradeRaw.timestamp >= start_time)
            .where(TradeRaw.price > 0)
            .order_by(desc((TradeRaw.amount * TradeRaw.price)))
            .limit(5)
        )
        top_trades = [
            {
                "wallet": _mask_wallet(r.wallet),
                "market": _safe(r, "market_title"),
                "side": (_safe(r, "side") or "BUY").upper(),
                "notional_usd": round(float(r.notional or 0), 2),
                "price_cents": round(float(r.price or 0) * 100, 1),
                "name": _safe(r, "polymarket_username") or _mask_wallet(r.wallet),
            }
            for r in (await session.execute(stmt_top)).all()
        ]

        # 3 most active markets (by trade count)
        stmt_active = (
            select(
                TradeRaw.market_id,
                func.count().label("trade_count"),
                func.sum(TradeRaw.amount * TradeRaw.price).label("volume"),
                Market.title.label("market_title"),
            )
            .outerjoin(Market, TradeRaw.market_id == Market.id)
            .where(TradeRaw.timestamp >= start_time)
            .where(TradeRaw.price > 0)
            .group_by(TradeRaw.market_id, Market.title)
            .order_by(desc(func.count()))
            .limit(3)
        )
        active_markets = [
            {
                "market_id": r.market_id or "unknown",
                "title": _safe(r, "market_title"),
                "trade_count": int(r.trade_count or 0),
                "volume_usd": round(float(r.volume or 0), 2),
            }
            for r in (await session.execute(stmt_active)).all()
        ]

        # Top 3 whales by PnL or win rate
        stmt_whales = (
            select(
                WhaleStats.wallet_address,
                WhaleStats.win_rate,
                WhaleStats.roi,
                WhaleStats.realized_pnl,
                WhaleProfile.total_trades,
                WalletName.polymarket_username,
            )
            .join(WhaleProfile, WhaleStats.wallet_address == WhaleProfile.wallet_address)
            .outerjoin(WalletName, WhaleStats.wallet_address == WalletName.wallet_address)
            .where(WhaleProfile.total_trades > 5)
            .order_by(desc(WhaleStats.realized_pnl))
            .limit(3)
        )
        top_whales = [
            {
                "wallet": _mask_wallet(r.wallet_address),
                "name": r.polymarket_username or _mask_wallet(r.wallet_address),
                "win_rate_pct": round(float(r.win_rate or 0) * 100, 1),
                "roi_pct": round(float(r.roi or 0) * 100, 1),
                "realized_pnl": round(float(r.realized_pnl or 0), 2),
                "total_trades": int(r.total_trades or 0),
            }
            for r in (await session.execute(stmt_whales)).all()
        ]

    return {
        "period_hours": lookback_hours,
        "generated_utc": now_utc.isoformat(),
        "top_trades": top_trades,
        "active_markets": active_markets,
        "top_whales": top_whales,
    }


# ---------------------------------------------------------------------------
# Topic selection
# ---------------------------------------------------------------------------


def pick_topic() -> str:
    """Pick an article type, ensuring no repeat within the last 3 days."""
    global _topic_history
    available = [t for t in TOPIC_TYPES if t not in _topic_history[-3:]]
    if not available:
        available = TOPIC_TYPES
    # Simple deterministic pick based on date to avoid randomness
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    idx = int(today) % len(available)
    topic = available[idx]
    _topic_history.append(topic)
    if len(_topic_history) > 10:
        _topic_history = _topic_history[-10:]
    return topic


# ---------------------------------------------------------------------------
# Prompt building
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a senior financial writer and SEO expert for SightWhale.com, a Polymarket whale tracking and alert platform. Your articles must be:

1. **Deep, authoritative, data-rich** — use the real on-chain data provided. Cite specific numbers, wallet behaviors, and market movements. Never be vague.
2. **Conversational but expert** — write like a knowledgeable friend explaining something fascinating. Use contractions. Ask rhetorical questions. Vary sentence length.
3. **SEO-optimized naturally** — the title and H2s should contain keywords people search for. The excerpt must be a compelling meta-description under 160 chars.
4. **Anti-AI voice** — avoid: "leverage", "utilize", "optimize", "in the current landscape", "it's important to note", "data-driven", "algorithm". Use concrete language instead.

Output a JSON object with these exact keys:
- "title": SEO title (50-70 chars)
- "excerpt": meta description (120-160 chars)
- "content": full article in markdown (1500-2500 words). Use ## for H2, ### for H3. Include at least 3 concrete data points.
- "tags": array of 3-5 lowercase kebab-case tags relevant to the content
- "read_time": estimated read time like "8 min"

For English articles, write naturally for a global audience.
For Chinese articles, LOCALIZE — don't translate literally. Adapt idioms, examples, and cultural references for Chinese readers. Use 地道的简体中文."""


def build_user_prompt(context: dict, topic: str, language: str) -> str:
    """Build the user prompt with real data context."""
    lang_name = "English" if language == "en" else "Simplified Chinese (简体中文)"
    topic_labels = {
        "whale_behavior": "Whale Behavior Analysis — analyze patterns in recent large trades, what they signal about market sentiment",
        "strategy_tutorial": "Strategy Tutorial — teach a specific Polymarket trading technique with concrete steps",
        "market_deep_dive": "Market Deep Dive — deep analysis of the hottest Polymarket markets right now",
        "methodology": "Methodology / Framework — present a conceptual framework for thinking about prediction markets",
        "data_insights": "Data Insights Report — numbers-driven analysis of SightWhale tracking data",
        "tools_tips": "Tools & Tips — practical tips for using Polymarket or SightWhale more effectively",
    }
    topic_desc = topic_labels.get(topic, topic)

    return f"""Write a {lang_name} blog article for SightWhale.com.

**Article type:** {topic_desc}

**Real on-chain data (last {context['period_hours']} hours):**

Top Whale Trades:
{json.dumps(context['top_trades'], indent=2)}

Most Active Markets:
{json.dumps(context['active_markets'], indent=2)}

Top Performing Whales:
{json.dumps(context['top_whales'], indent=2)}

**Requirements:**
- 1500-2500 words of substantive analysis, not filler
- Include at least 3 specific data points from the data above
- Write in {lang_name}
- Must contain at least one actionable insight for Polymarket traders
- Use markdown formatting (## for H2, ### for H3, **bold** for emphasis)

Output ONLY the JSON object, no preamble."""


# ---------------------------------------------------------------------------
# Quality validation
# ---------------------------------------------------------------------------

BANNED_PHRASES = [
    "leverage", "utilize", "optimize", "synergize",
    "in the current landscape", "moving forward", "at the end of the day",
    "it's important to note", "it's worth mentioning", "as previously stated",
    "data-driven", "algorithm", "machine learning",
]


def validate_article(article: dict, language: str) -> tuple[bool, str]:
    """Quality gate. Returns (passed, reason)."""
    content = article.get("content", "")
    word_count = len(content.split())

    # Chinese word count is approximate (characters / 1.5 ≈ words)
    if language == "zh":
        word_count = len(content.replace(" ", "")) // 2

    if word_count < 1000:
        return False, f"word_count={word_count} < 1000 minimum"

    # Count data points (numbers in content)
    import re
    numbers = re.findall(r'\$?[\d,]+(?:\.\d+)?\s*[%kM]?', content)
    if len(numbers) < 3:
        return False, f"data_points={len(numbers)} < 3 minimum"

    # Banned phrase check
    content_lower = content.lower()
    for phrase in BANNED_PHRASES:
        if phrase in content_lower:
            return False, f"banned phrase detected: '{phrase}'"

    # Required fields
    for field in ("title", "excerpt", "content", "tags"):
        if not article.get(field):
            return False, f"missing required field: {field}"

    return True, "ok"


# ---------------------------------------------------------------------------
# LLM generation
# ---------------------------------------------------------------------------


async def generate_article(context: dict, language: str) -> dict | None:
    """Generate a single article via DeepSeek. Returns parsed JSON or None on failure."""
    topic = pick_topic()
    logger.info("generating %s article, topic=%s", language, topic)

    client = _llm_client()
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": build_user_prompt(context, topic, language)},
    ]

    import random
    for attempt in range(1, 4):
        try:
            response = client.chat.completions.create(
                model=settings.blog_llm_model,
                messages=messages,
                temperature=0.8,
                max_tokens=4096,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content
            if not raw:
                logger.warning("empty response from LLM (attempt %d)", attempt)
                if attempt < 3:
                    await asyncio.sleep(2 ** attempt + random.random())
                continue

            article = json.loads(raw)
            passed, reason = validate_article(article, language)
            if passed:
                logger.info("%s article generated: %d words, topic=%s", language, len(article["content"].split()), topic)
                return article

            logger.warning("validation failed (attempt %d): %s", attempt, reason)
            # Retry with stricter prompt
            messages.append({
                "role": "user",
                "content": f"Your previous output failed validation: {reason}. Please fix and output the complete JSON again.",
            })

        except Exception:
            logger.exception("LLM call failed (attempt %d)", attempt)
            if attempt >= 3:
                return None
            await asyncio.sleep(2 ** attempt + random.random())

    return None


# ---------------------------------------------------------------------------
# Orchestrator — called by Celery task
# ---------------------------------------------------------------------------


async def generate_daily_article() -> dict:
    """Main entry point. Generates EN + ZH articles and inserts into blog_posts.

    Returns a status dict suitable for the Celery task result.
    """
    if not settings.blog_daily_enabled:
        return {"status": "disabled"}

    context = await fetch_context()

    # Generate both languages
    en_article = await generate_article(context, "en")
    zh_article = await generate_article(context, "zh")

    if not en_article and not zh_article:
        return {"status": "failed", "reason": "both languages failed generation"}

    group_slug = _make_slug(en_article or zh_article)
    now_utc = datetime.now(timezone.utc)
    inserted: list[str] = []

    async with SessionLocal() as session:
        await _ensure_blog_posts_table(session)

        if en_article:
            await _insert_blog_post(session, en_article, "en", group_slug, now_utc)
            inserted.append("en")

        if zh_article:
            await _insert_blog_post(session, zh_article, "zh", group_slug, now_utc)
            inserted.append("zh")

        await session.commit()

    return {
        "status": "published",
        "group_slug": group_slug,
        "languages": inserted,
        "en_title": en_article.get("title") if en_article else None,
        "zh_title": zh_article.get("title") if zh_article else None,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mask_wallet(addr: str) -> str:
    """Shorten wallet address for readability."""
    v = (addr or "").strip()
    if len(v) <= 10:
        return v
    return f"{v[:6]}...{v[-4:]}"


def _safe(row: Any, attr: str) -> str:
    val = getattr(row, attr, None)
    return str(val).strip() if val else ""


def _make_slug(article: dict) -> str:
    """Generate a URL-safe slug from the title."""
    title = article.get("title", "daily-article")
    slug = title.lower().strip()
    slug = "".join(c if c.isalnum() or c in " -" else "" for c in slug)
    slug = "-".join(slug.split())[:80]
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"{date_str}-{slug}"


async def _ensure_blog_posts_table(session) -> None:
    """Create or migrate the blog_posts table."""
    await session.execute(
        text(
            """
            create table if not exists blog_posts (
                id text primary key,
                slug text not null,
                title text not null,
                excerpt text not null,
                content text not null,
                author text not null,
                read_time text not null,
                cover_image text,
                tags text[] default '{}',
                published_at timestamptz not null,
                created_at timestamptz not null default now(),
                updated_at timestamptz not null default now()
            )
            """
        )
    )
    # Idempotent migration: add columns that may not exist yet
    for col, col_def in [
        ("language", "text not null default 'en'"),
        ("group_slug", "text"),
        ("status", "text not null default 'published'"),
        ("generation_prompt", "text"),
    ]:
        try:
            await session.execute(
                text(f"alter table blog_posts add column if not exists {col} {col_def}")
            )
        except Exception:
            logger.warning("blog_posts_ddl_skipped col=%s", col, exc_info=True)
    # Make slug+language unique instead of just slug
    try:
        await session.execute(
            text(
                "alter table blog_posts drop constraint if exists blog_posts_slug_key"
            )
        )
        await session.execute(
            text(
                "create unique index if not exists blog_posts_slug_language_idx on blog_posts (slug, language)"
            )
        )
    except Exception:
        logger.warning("blog_posts_index_migration_failed", exc_info=True)


async def _insert_blog_post(
    session, article: dict, language: str, group_slug: str, now_utc: datetime
) -> None:
    """Insert a single article row."""
    post_id = str(uuid.uuid4())
    lang_slug = f"{article.get('title', 'post').lower().strip()[:60]}-{language}"
    lang_slug = "".join(c if c.isalnum() or c in " -" else "" for c in lang_slug)
    lang_slug = "-".join(lang_slug.split())[:80]

    await session.execute(
        text(
            """
            insert into blog_posts (
                id, slug, title, excerpt, content, author, read_time, tags,
                published_at, created_at, updated_at, language, group_slug, status
            )
            values (
                :id, :slug, :title, :excerpt, :content, :author, :read_time, :tags,
                :published_at, :created_at, :updated_at, :language, :group_slug, :status
            )
            on conflict (slug, language) do update set
                title = excluded.title,
                excerpt = excluded.excerpt,
                content = excluded.content,
                author = excluded.author,
                read_time = excluded.read_time,
                tags = excluded.tags,
                updated_at = excluded.updated_at
            """
        ),
        {
            "id": post_id,
            "slug": lang_slug,
            "title": article["title"],
            "excerpt": article["excerpt"],
            "content": article["content"],
            "author": "SightWhale",
            "read_time": article.get("read_time", "8 min"),
            "tags": article.get("tags", []),
            "published_at": now_utc,
            "created_at": now_utc,
            "updated_at": now_utc,
            "language": language,
            "group_slug": group_slug,
            "status": "published",
        },
    )
    logger.info("inserted blog post: slug=%s language=%s group=%s", lang_slug, language, group_slug)
