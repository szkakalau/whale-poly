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

from openai import AsyncOpenAI
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
    "trader_profile",       # 鲸鱼深度画像
    "weekly_recap",         # 本周大事回顾
    "market_prediction",    # 事件预测分析
    "newbie_guide",         # 新人入门教程
    "contrarian_view",      # 反共识分析
    "data_viz_story",       # 数据可视化解读
]

# Track recent topics with timestamps for weighted random selection.
# Format: {topic: datetime_of_use}
_topic_usage: dict[str, datetime] = {}


def _llm_client() -> AsyncOpenAI:
    return AsyncOpenAI(
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
                WhaleProfile.realized_pnl,
                WhaleProfile.total_trades,
                WalletName.polymarket_username,
            )
            .join(WhaleProfile, WhaleStats.wallet_address == WhaleProfile.wallet_address)
            .outerjoin(WalletName, WhaleStats.wallet_address == WalletName.wallet_address)
            .where(WhaleProfile.total_trades > 5)
            .order_by(desc(WhaleProfile.realized_pnl))
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
    """Pick an article type using weighted random selection.

    Rules:
    - Topics used in the last 3 days are strictly excluded.
    - Topics used in the last 7 days have their weight reduced by 70%.
    - Otherwise, each topic has equal base weight.
    """
    import random

    global _topic_usage
    now = datetime.now(timezone.utc)

    # Strict exclusion: last 3 days
    cutoff_strict = now - timedelta(days=3)
    recent3 = {t for t, ts in _topic_usage.items() if ts > cutoff_strict}

    # Penalty window: 7 days (weight × 0.3)
    cutoff_penalty = now - timedelta(days=7)

    weights: dict[str, float] = {}
    for t in TOPIC_TYPES:
        if t in recent3:
            continue  # excluded
        last_used = _topic_usage.get(t)
        if last_used and last_used > cutoff_penalty:
            weights[t] = 0.3  # penalty
        else:
            weights[t] = 1.0  # full weight

    # Fallback: if all excluded, allow everything
    if not weights:
        weights = {t: 1.0 for t in TOPIC_TYPES}

    # Weighted random pick
    topics = list(weights.keys())
    probs = [weights[t] for t in topics]
    total = sum(probs)
    probs = [p / total for p in probs]

    chosen = random.choices(topics, weights=probs, k=1)[0]

    # Record usage
    _topic_usage[chosen] = now
    # Prune old entries (keep last 14 days max)
    cutoff_keep = now - timedelta(days=14)
    _topic_usage = {t: ts for t, ts in _topic_usage.items() if ts > cutoff_keep}

    logger.info("picked_topic=%s weights=%s excluded=%s", chosen, {t: round(w, 1) for t, w in zip(topics, probs, strict=False)}, sorted(recent3))
    return chosen


# ---------------------------------------------------------------------------
# Prompt building
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a senior financial writer and SEO expert for SightWhale.com, a Polymarket whale tracking and alert platform. Your articles must be:

1. **Deep, authoritative, data-rich** — use the real on-chain data provided. Cite specific numbers, wallet behaviors, and market movements. Never be vague.
2. **Conversational but expert** — write like a knowledgeable friend explaining something fascinating. Use contractions. Ask rhetorical questions. Vary sentence length.
3. **SEO-optimized naturally** — the title and H2s should contain keywords people search for. The excerpt must be a compelling meta-description under 160 chars. The primary keyword must appear in the title, first H2, and 3-5 times in the body.
4. **Anti-AI voice** — avoid: "leverage", "utilize", "optimize", "in the current landscape", "it's important to note", "data-driven", "algorithm". Use concrete language instead.
5. **GEO (Generative Engine Optimization)** — structure your article so AI search engines quote it:
   - Include a FAQ section (## Frequently Asked Questions) with 2-3 Q&A pairs using real data.
   - End with a ## Key Entities section listing markets, wallets, and concepts mentioned.
   - Include at least one markdown table with real data (e.g. top trades, whale comparison).
   - Use clear definitions for key terms so AI models can extract canonical definitions.

Output a JSON object with these exact keys:
- "title": SEO title (50-70 chars, primary keyword in first 30 chars)
- "excerpt": meta description (120-160 chars, compelling click-through)
- "content": full article in markdown (1500-2500 words). Use ## for H2, ### for H3. Must include at least 3 concrete data points, one data table, one FAQ section, and one Key Entities section.
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
        "trader_profile": "Trader Profile — deep portrait of a specific whale wallet, their strategy patterns and PnL history",
        "weekly_recap": "Weekly Recap — roundup of the week's most important Polymarket events and whale moves",
        "market_prediction": "Market Prediction — analyze a specific event market and predict the likely outcome with reasoning",
        "newbie_guide": "Beginner Guide — explain a Polymarket concept or strategy in simple terms for newcomers",
        "contrarian_view": "Contrarian View — challenge the market consensus on a popular Polymarket event with counter-evidence",
        "data_viz_story": "Data Story — tell a narrative driven by numbers, with comparisons and trend analysis",
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

**GEO structure (REQUIRED — AI search engines will crawl this):**
- Include a ## Frequently Asked Questions section with 2-3 Q&A pairs.
  Each Q should be a real question a trader would type into Google.
  Each A should be 2-4 sentences with concrete data.
- End the article with a ## Key Entities section that lists:
  - Markets mentioned (with current odds if available)
  - Whale wallets mentioned (with masked addresses)
  - Key concepts defined (one-sentence definitions)
- Include at least one markdown data table (e.g., top trades comparison, whale stats).

**SEO keyword rule:**
- Identify the primary keyword for this article (the phrase you expect people to search).
- Use it in the title, the first H2 heading, and 3-5 times in the body naturally.

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

    # GEO quality checks (soft: logged but not blocking)
    geo_issues = []
    if not re.search(r'\|[^\n]+\|[^\n]+\|', content):
        geo_issues.append("no_markdown_table")
    if not re.search(r'(?i)#+\s*frequently\s*asked\s*questions', content):
        geo_issues.append("no_faq_section")
    if not re.search(r'(?i)#+\s*key\s*entities', content):
        geo_issues.append("no_key_entities_section")
    if geo_issues:
        logger.warning("geo_quality_issues=%s", geo_issues)
        # Don't block — retry with stricter prompt may fix it
        if "no_markdown_table" in geo_issues:
            # Table is the easiest to fix, so require it on retry
            return False, f"geo_missing={' '.join(geo_issues)}"

    # Required fields
    for field in ("title", "excerpt", "content", "tags"):
        if not article.get(field):
            return False, f"missing required field: {field}"

    return True, "ok"


# ---------------------------------------------------------------------------
# LLM generation
# ---------------------------------------------------------------------------


async def generate_article(context: dict, language: str) -> tuple[dict | None, str]:
    """Generate a single article via DeepSeek. Returns (parsed_json, topic) or (None, topic) on failure."""
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
            response = await client.chat.completions.create(
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
                return article, topic

            logger.warning("validation failed (attempt %d): %s", attempt, reason)
            # Retry with stricter prompt
            messages.append({
                "role": "user",
                "content": f"Your previous output failed validation: {reason}. Please fix and output the complete JSON again.",
            })

        except Exception:
            logger.exception("LLM call failed (attempt %d)", attempt)
            if attempt >= 3:
                return None, topic
            await asyncio.sleep(2 ** attempt + random.random())

    return None, topic


# ---------------------------------------------------------------------------
# Orchestrator — called by Celery task
# ---------------------------------------------------------------------------


async def generate_daily_article() -> dict:
    """Main entry point. Generates EN + ZH articles and inserts into blog_posts.

    Returns a status dict suitable for the worker result.
    """
    if not settings.blog_daily_enabled:
        return {"status": "disabled"}

    context = await fetch_context()

    # Generate both languages
    en_article, en_topic = await generate_article(context, "en")
    zh_article, zh_topic = await generate_article(context, "zh")

    if not en_article and not zh_article:
        return {"status": "failed", "reason": "both languages failed generation"}

    group_slug = _make_slug(en_article or zh_article)
    now_utc = datetime.now(timezone.utc)
    inserted: list[str] = []

    async with SessionLocal() as session:
        await _ensure_blog_posts_table(session)

        if en_article:
            en_meta = {
                "topic": en_topic,
                "word_count": len(en_article.get("content", "").split()),
                "data_points": en_article.get("content", "").count("$"),
                "language": "en",
                "generated_at": now_utc.isoformat(),
            }
            await _insert_blog_post(session, en_article, "en", group_slug, now_utc, meta=en_meta)
            inserted.append("en")

        if zh_article:
            zh_meta = {
                "topic": zh_topic,
                "word_count": len(zh_article.get("content", "").replace(" ", "")) // 2,
                "data_points": zh_article.get("content", "").count("$"),
                "language": "zh",
                "generated_at": now_utc.isoformat(),
            }
            await _insert_blog_post(session, zh_article, "zh", group_slug, now_utc, meta=zh_meta)
            inserted.append("zh")

        await session.commit()

    return {
        "status": "published",
        "group_slug": group_slug,
        "languages": inserted,
        "en_topic": en_topic,
        "zh_topic": zh_topic,
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
    session, article: dict, language: str, group_slug: str, now_utc: datetime,
    meta: dict | None = None,
) -> None:
    """Insert a single article row, with optional generation metadata."""
    post_id = str(uuid.uuid4())
    lang_slug = f"{article.get('title', 'post').lower().strip()[:60]}-{language}"
    lang_slug = "".join(c if c.isalnum() or c in " -" else "" for c in lang_slug)
    lang_slug = "-".join(lang_slug.split())[:80]

    generation_prompt = json.dumps(meta) if meta else None

    await session.execute(
        text(
            """
            insert into blog_posts (
                id, slug, title, excerpt, content, author, read_time, tags,
                published_at, created_at, updated_at, language, group_slug, status,
                generation_prompt
            )
            values (
                :id, :slug, :title, :excerpt, :content, :author, :read_time, :tags,
                :published_at, :created_at, :updated_at, :language, :group_slug, :status,
                :generation_prompt
            )
            on conflict (slug, language) do update set
                title = excluded.title,
                excerpt = excluded.excerpt,
                content = excluded.content,
                author = excluded.author,
                read_time = excluded.read_time,
                tags = excluded.tags,
                updated_at = excluded.updated_at,
                generation_prompt = excluded.generation_prompt
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
            "generation_prompt": generation_prompt,
        },
    )
    logger.info("inserted blog post: slug=%s language=%s group=%s meta=%s", lang_slug, language, group_slug, meta)
