import hmac
import json
import logging
from datetime import datetime, timezone

from contextlib import asynccontextmanager
from fastapi import FastAPI, Header, Query
from pydantic import AliasChoices, BaseModel, Field
from redis.asyncio import Redis
from shared.config import settings
from shared.logging import configure_logging


configure_logging(settings.log_level)
logger = logging.getLogger("trade_ingest.api")

# Redis connection — delegated to shared.async_utils.get_redis() which
# returns InMemoryRedis when REDIS_URL is empty (unified mode).
from shared.async_utils import get_redis as _get_shared_redis


async def _get_redis() -> Redis:
    """Return the shared Redis connection (real or in-memory)."""
    return await _get_shared_redis()


async def _ensure_blog_posts_table(session) -> None:
    """Create blog_posts table and index at startup — NOT in the request path (CR-C6)."""
    await session.execute(
        text(
            """create table if not exists blog_posts (
                id text primary key, slug text not null, title text not null,
                excerpt text not null, content text not null, author text not null,
                read_time text not null, cover_image text, tags text[] default '{}',
                published_at timestamptz not null, created_at timestamptz not null default now(),
                updated_at timestamptz not null default now(),
                language text not null default 'en', group_slug text,
                status text not null default 'published'
            )"""
        )
    )
    try:
        await session.execute(
            text("create unique index if not exists blog_posts_slug_language_idx on blog_posts (slug, language)")
        )
    except Exception:
        pass  # index may already exist from parallel startup
    await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: ensure blog_posts table + connect Redis (CR-C1, CR-C6).

    In unified mode, this lifespan does NOT run (FastAPI mounted apps
    don't execute their lifespans). The unified app handles initialization.
    """
    from shared.async_utils import get_redis as _get_shared_redis
    redis = await _get_shared_redis()
    async with SessionLocal() as session:
        await _ensure_blog_posts_table(session)
    try:
        yield
    finally:
        # Only close if it's a real Redis (memory store has no-op aclose)
        await redis.aclose()


app = FastAPI(title="trade-ingest", lifespan=lifespan)

from shared.error_handlers import register_exception_handlers
register_exception_handlers(app)


class TradeIn(BaseModel):
  trade_id: str
  market_id: str
  market_title: str | None = None
  outcome: str | None = Field(
    default=None,
    validation_alias=AliasChoices(
      "outcome",
      "outcome_name",
      "outcomeName",
      "tokenOutcome",
      "outcomeToken",
      "outcome_token",
      "label",
      "name",
    ),
  )
  wallet: str
  side: str
  amount: float
  price: float
  timestamp: datetime | None = None


@app.get("/health")
async def health():
  return {"status": "ok"}


@app.get("/")
async def root():
  return {"status": "ok"}


@app.post("/ingest/trade")
async def ingest_trade(payload: TradeIn, x_admin_token: str | None = Header(None, alias="X-Admin-Token")):
  # 防止未认证的队列投毒攻击
  from shared.auth import require_admin as _require_admin
  _require_admin(x_admin_token)

  ts = payload.timestamp or datetime.now(timezone.utc)
  if ts.tzinfo is None:
    ts = ts.replace(tzinfo=timezone.utc)
  outcome = payload.outcome
  if outcome is not None and not str(outcome).strip():
    outcome = None

  # Reuse module-level Redis connection pool (CR-C1).
  redis = await _get_redis()
  queue_key = settings.trade_ingest_incoming_queue
  await redis.rpush(
    queue_key,
    json.dumps(
      {
        "trade_id": payload.trade_id,
        "market_id": payload.market_id,
        "market_title": payload.market_title,
        "outcome": outcome,
        "wallet": payload.wallet.lower(),
        "side": payload.side.lower(),
        "amount": payload.amount,
        "price": payload.price,
        "timestamp": ts.isoformat(),
      }
    ),
  )
  # 队列大小监控：防止消费者故障时无限制增长导致 Redis OOM
  try:
    qlen = await redis.llen(queue_key)
    if qlen > 100_000:
      logger.warning("trade_ingest_queue_overflow qlen=%d queue=%s", qlen, queue_key)
  except Exception:
    pass

  return {"ok": True, "queued": True}


# ---------------------------------------------------------------------------
# Blog API — serves blog_posts to Vercel (which can't directly query Render DB)
# ---------------------------------------------------------------------------

from shared.db import SessionLocal
from sqlalchemy import text
import concurrent.futures
import re as _re
import httpx

# ---------------------------------------------------------------------------
# Gamma API helpers — settlement prices & ROI for resolved Polymarket markets
# ---------------------------------------------------------------------------

GAMMA_API = "https://gamma-api.polymarket.com/markets"
MAX_GAMMA_LOOKUPS = 520

# Shared httpx client (sync, thread-safe) — respects HTTPS_PROXY env var
_gamma_http = httpx.Client(
    headers={"Accept": "application/json"},
    timeout=httpx.Timeout(10.0),
    follow_redirects=True,
)


def _gamma_fetch(param: str, value: str) -> tuple[dict | None, str | None]:
    """Fetch one Gamma market. Returns (data, error_message)."""
    value = value.strip()
    if not value:
        return None, "empty value"
    try:
        resp = _gamma_http.get(f"{GAMMA_API}", params={param: value, "limit": "1"})
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list) and len(data) > 0:
            return data[0], None
        return None, f"empty response: {resp.text[:200]}"
    except Exception as exc:
        return None, f"{type(exc).__name__}: {exc}"


def _gamma_fetch_batch(param: str, values: list[str], batch_size: int = 24) -> tuple[dict[str, dict], list[str]]:
    """Batch-fetch Gamma markets. Returns (cache, errors)."""
    cache: dict[str, dict] = {}
    errors: list[str] = []
    unique = list(dict.fromkeys(v.strip() for v in values if v and v.strip()))
    unique = unique[:MAX_GAMMA_LOOKUPS]

    def _fetch_one(v: str):
        data, err = _gamma_fetch(param, v)
        if err:
            return v, None, err
        return v, data, None

    for i in range(0, len(unique), batch_size):
        chunk = unique[i:i + batch_size]
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(chunk), 24)) as pool:
            for v, result, err in pool.map(_fetch_one, chunk):
                if err:
                    errors.append(f"{param}={v[:20]}…: {err}")
                if result:
                    cache[v] = result
    return cache, errors


def _parse_gamma_market(row: dict, fallback_cid: str) -> dict | None:
    """Parse raw Gamma API row into a simplified slice."""
    def _arr(raw):
        if isinstance(raw, list):
            return raw
        if isinstance(raw, str):
            try:
                return json.loads(raw)
            except Exception:
                return []
        return []

    outcomes_raw = _arr(row.get("outcomes", []))
    prices_raw = _arr(row.get("outcomePrices", []))
    tokens_raw = _arr(row.get("clobTokenIds", []))

    if not outcomes_raw or not prices_raw:
        return None

    n = min(len(outcomes_raw), len(prices_raw))
    outcomes = []
    prices = []
    tokens = []
    for i in range(n):
        try:
            p = float(prices_raw[i])
        except (ValueError, TypeError):
            continue
        outcomes.append(str(outcomes_raw[i]).strip())
        prices.append(p)
        tokens.append(str(tokens_raw[i]).strip().lower() if i < len(tokens_raw) else "")

    if not outcomes:
        return None

    cid = str(row.get("conditionId") or row.get("condition_id") or fallback_cid).strip()
    closed = row.get("closed") in (True, "true") or row.get("isResolved") in (True, "true")

    return {
        "conditionId": cid,
        "closed": closed,
        "outcomes": outcomes,
        "outcomePrices": prices,
        "clobTokenIds": tokens,
    }


def _winning_outcome_index(prices: list[float]) -> int | None:
    """Index of winning outcome (price ~= 1). Same logic as TS winningOutcomeIndex."""
    if not prices:
        return None
    best_i = -1
    best_p = -1.0
    second_p = -1.0
    for i, p in enumerate(prices):
        if p > best_p:
            second_p = best_p
            best_p = p
            best_i = i
        elif p > second_p:
            second_p = p
    if best_i < 0 or best_p < 0.51:
        return None
    if best_p >= 0.85:
        return best_i
    if best_p >= 0.72 and second_p >= 0 and best_p - second_p >= 0.38:
        return best_i
    return None


def _traded_outcome_index(gamma: dict, outcome_token: str | None, token_id: str | None = None) -> int | None:
    """Find index of traded outcome in Gamma's outcomes/clobTokenIds arrays."""
    if not gamma or not outcome_token:
        return None
    outcomes = gamma.get("outcomes", [])
    tokens = gamma.get("clobTokenIds", [])

    # Exact token ID match
    if token_id:
        tid = token_id.strip().lower()
        for i, t in enumerate(tokens):
            if t == tid:
                return i

    traded = outcome_token.strip().lower()
    # Exact outcome match
    for i, o in enumerate(outcomes):
        if o.strip().lower() == traded:
            return i
    # Strip parenthetical labels
    traded_stripped = _re.sub(r'\s*\([^)]*\)', '', traded).strip()
    for i, o in enumerate(outcomes):
        if _re.sub(r'\s*\([^)]*\)', '', o.strip().lower()).strip() == traded_stripped:
            return i
    # Yes/No short
    if traded in ("yes", "y"):
        for i, o in enumerate(outcomes):
            if o.strip().lower() in ("yes", "y"):
                return i
    if traded in ("no", "n"):
        for i, o in enumerate(outcomes):
            if o.strip().lower() in ("no", "n"):
                return i
    return None


def _gamma_settlement_price(gamma: dict, outcome_token: str | None, token_id: str | None = None) -> float | None:
    """Settlement price when Gamma shows a clear winner."""
    if not gamma:
        return None
    if _winning_outcome_index(gamma.get("outcomePrices", [])) is None:
        return None
    idx = _traded_outcome_index(gamma, outcome_token, token_id)
    if idx is None:
        return None
    prices = gamma.get("outcomePrices", [])
    if idx < len(prices):
        return float(prices[idx])
    return None


def _gamma_leg_price(gamma: dict, outcome_token: str | None, token_id: str | None = None) -> float | None:
    """Current leg price regardless of resolution."""
    if not gamma:
        return None
    idx = _traded_outcome_index(gamma, outcome_token, token_id)
    if idx is None:
        return None
    prices = gamma.get("outcomePrices", [])
    if idx < len(prices):
        return float(prices[idx])
    return None


def _roi_from_gamma(side: str | None, outcome_token: str | None, entry_price: float | None,
                    gamma: dict | None, token_id: str | None = None,
                    require_resolved: bool = True) -> tuple[float | None, float | None]:
    """
    Compute ROI from Gamma outcome prices.
    BUY:  (S − entry) / entry
    SELL: (entry − S) / (1 − entry)
    Returns (roi_pct, end_price).
    """
    if not gamma or entry_price is None or not (0 < entry_price < 1):
        return None, None

    side = (side or "").strip().upper()
    if side not in ("BUY", "SELL"):
        return None, None

    if require_resolved and _winning_outcome_index(gamma.get("outcomePrices", [])) is None:
        return None, None

    idx = _traded_outcome_index(gamma, outcome_token, token_id)
    if idx is None:
        return None, None

    prices = gamma.get("outcomePrices", [])
    if idx >= len(prices):
        return None, None

    S = prices[idx]
    if S is None or abs(S) >= float('inf'):
        return None, None

    end_price = float(S)

    if side == "BUY":
        roi = (S - entry_price) / entry_price
        return roi, end_price
    else:
        at_risk = 1.0 - entry_price
        if at_risk <= 1e-14:
            return None, end_price
        roi = (entry_price - S) / at_risk
        return roi, end_price


def _format_short_wallet(addr: str | None) -> str:
    if not addr:
        return "—"
    addr = addr.strip()
    if len(addr) <= 10:
        return addr
    return f"{addr[:6]}…{addr[-4:]}"


@app.get("/blog/posts")
async def blog_posts(language: str = "en", page: int = 1, limit: int = 12, tag: str = ""):
    """Public blog post listing. Called by Vercel landing page."""
    offset = (page - 1) * limit

    # Build parameterized query (CR-C7 — no f-string SQL interpolation).
    params: dict = {"lang": language, "lim": limit, "off": offset}
    tag_filter = ""
    if tag:
        tag_filter = "and :tag = any(tags)"
        params["tag"] = tag

    async with SessionLocal() as session:
        posts_result = await session.execute(
            text(
                f"""select slug, title, excerpt, author, read_time, tags,
                           published_at, language, group_slug
                    from blog_posts
                    where status = 'published' and language = :lang
                    {tag_filter}
                    order by published_at desc
                    limit :lim offset :off"""
            ),
            params,
        )
        posts = [dict(r._mapping) for r in posts_result]

        count_params = {"lang": language}
        count_tag_filter = ""
        if tag:
            count_tag_filter = "and :tag = any(tags)"
            count_params["tag"] = tag
        count_result = await session.execute(
            text(
                f"""select count(*) as count from blog_posts
                    where status = 'published' and language = :lang
                    {count_tag_filter}"""
            ),
            count_params,
        )
        total = count_result.scalar() or 0

        # Format for JSON
        for p in posts:
            p["published_at"] = p["published_at"].isoformat() if hasattr(p["published_at"], "isoformat") else str(p["published_at"])
            if isinstance(p.get("tags"), list):
                pass  # already a list
            elif p.get("tags"):
                p["tags"] = [t.strip() for t in str(p["tags"]).strip("{}").split(",") if t.strip()]

    return {"posts": posts, "total": total}


@app.get("/blog/post")
async def blog_post(slug: str, language: str = "en"):
    """Single blog post with full content + sibling link. Called by Vercel post page."""
    async with SessionLocal() as session:
        result = await session.execute(
            text(
                """select id, slug, title, excerpt, content, author, read_time,
                          cover_image, tags, published_at, created_at, updated_at,
                          language, group_slug, status
                   from blog_posts
                   where slug = :slug and language = :lang and status = 'published'
                   limit 1"""
            ),
            {"slug": slug, "lang": language},
        )
        row = result.first()
        if not row:
            return None  # FastAPI returns null → frontend calls notFound()

        post = dict(row._mapping)
        post["published_at"] = post["published_at"].isoformat() if hasattr(post["published_at"], "isoformat") else str(post["published_at"])
        post["created_at"] = post["created_at"].isoformat() if hasattr(post["created_at"], "isoformat") else str(post["created_at"])
        post["updated_at"] = post["updated_at"].isoformat() if hasattr(post["updated_at"], "isoformat") else str(post["updated_at"])
        if isinstance(post.get("tags"), list):
            pass
        elif post.get("tags"):
            post["tags"] = [t.strip() for t in str(post["tags"]).strip("{}").split(",") if t.strip()]

        # Sibling (same group_slug, different language)
        sibling = None
        if post.get("group_slug"):
            sib_result = await session.execute(
                text(
                    """select slug, language from blog_posts
                       where group_slug = :gs and language != :lang and status = 'published'
                       limit 1"""
                ),
                {"gs": post["group_slug"], "lang": language},
            )
            sib_row = sib_result.first()
            if sib_row:
                sibling = {"slug": sib_row.slug, "language": sib_row.language}
        post["sibling"] = sibling

    return post


@app.get("/blog/tags")
async def blog_tags(language: str = "en"):
    """Public blog tag listing."""
    async with SessionLocal() as session:
        result = await session.execute(
            text(
                """select unnest(tags) as tag, count(*)::int as count
                    from blog_posts
                    where status = 'published' and language = :lang
                    group by tag order by count desc, tag"""
            ),
            {"lang": language},
        )
        tags = [dict(r._mapping) for r in result]
    return {"tags": tags}


class BlogPostIn(BaseModel):
    slug: str
    title: str
    excerpt: str = ""
    content: str
    author: str = "SightWhale"
    read_time: str = "8 min"
    tags: list[str] = []
    language: str = "en"
    group_slug: str | None = None
    status: str = "published"


@app.post("/blog/post")
async def blog_post_create(payload: BlogPostIn, x_admin_key: str = Header(default="")):
    """Admin endpoint: insert or update a blog post. Requires BLOG_LLM_API_KEY."""
    import uuid

    if not settings.blog_llm_api_key:
        return {"error": "not configured"}
    if not hmac.compare_digest(x_admin_key, settings.blog_llm_api_key):
        return {"error": "unauthorized"}

    now_utc = datetime.now(timezone.utc)
    post_id = str(uuid.uuid4())

    # Table + index are created at startup via lifespan (CR-C6).
    # No DDL in the request path.
    async with SessionLocal() as session:
        await session.execute(
            text(
                """insert into blog_posts (id, slug, title, excerpt, content, author, read_time, tags, published_at, created_at, updated_at, language, group_slug, status)
                values (:id, :slug, :title, :excerpt, :content, :author, :read_time, :tags, :published_at, :created_at, :updated_at, :language, :group_slug, :status)
                on conflict (slug, language) do update set
                    title=excluded.title, excerpt=excluded.excerpt, content=excluded.content,
                    author=excluded.author, read_time=excluded.read_time, tags=excluded.tags,
                    group_slug=excluded.group_slug, updated_at=excluded.updated_at"""
            ),
            {
                "id": post_id,
                "slug": payload.slug,
                "title": payload.title,
                "excerpt": payload.excerpt,
                "content": payload.content,
                "author": payload.author,
                "read_time": payload.read_time,
                "tags": payload.tags,
                "published_at": now_utc,
                "created_at": now_utc,
                "updated_at": now_utc,
                "language": payload.language,
                "group_slug": payload.group_slug,
                "status": payload.status,
            },
        )
        await session.commit()

    return {"status": "ok", "slug": payload.slug, "language": payload.language}


@app.delete("/blog/post")
async def blog_post_delete(slug: str, language: str = "en", x_admin_key: str = Header(default="")):
    """Admin endpoint: delete a blog post. Requires BLOG_LLM_API_KEY."""
    if not settings.blog_llm_api_key:
        return {"error": "not configured"}
    if not hmac.compare_digest(x_admin_key, settings.blog_llm_api_key):
        return {"error": "unauthorized"}

    async with SessionLocal() as session:
        result = await session.execute(
            text("delete from blog_posts where slug = :slug and language = :lang returning id"),
            {"slug": slug, "lang": language},
        )
        deleted = result.scalar()
        await session.commit()

    if not deleted:
        return {"status": "not_found", "slug": slug, "language": language}


@app.post("/blog/generate")
async def blog_generate(x_admin_key: str = Header(default="")):
    """Admin endpoint: trigger daily article generation via LLM + on-chain data.

    This is the preferred way to trigger blog generation from CI —
    it runs inside Render's network so database access works.
    Requires BLOG_LLM_API_KEY.
    """
    if not settings.blog_llm_api_key:
        return {"status": "disabled", "reason": "BLOG_LLM_API_KEY not configured"}
    if not hmac.compare_digest(x_admin_key, settings.blog_llm_api_key):
        return {"status": "unauthorized"}

    from services.trade_ingest.blog_generator import generate_daily_article

    try:
        result = await generate_daily_article()
        return result
    except Exception as exc:
        logger.exception("blog_generate_endpoint failed")
        return {"status": "failed", "reason": f"internal error: {exc}"}


@app.get("/stats/home")
async def home_stats():
    """Aggregated stats for the landing page hero + score tiers + star whale.
    Called by Vercel which can't reliably query Render PostgreSQL directly.
    """
    from shared.models import Alert, WhaleProfile, WhaleScore, WhaleStats

    async with SessionLocal() as session:
        from sqlalchemy import desc, func, select

        # ── Signal count: from alerts table (not raw trades) ──
        stmt = select(func.count()).select_from(Alert)
        total = (await session.execute(stmt)).scalar() or 0

        # ── Score tier breakdown: single query with FILTER instead of 4 separate
        #     full scans joining alerts + whale_trades + whale_trade_history (PF-H1).
        tier_result = await session.execute(
            text("""SELECT
                COUNT(*) FILTER (WHERE a.whale_score BETWEEN :elite_lo AND :elite_hi)::int AS elite_cnt,
                COUNT(*) FILTER (WHERE a.whale_score BETWEEN :elite_lo AND :elite_hi AND wth.pnl IS NOT NULL AND ABS(wth.pnl::float) >= 0.01)::int AS elite_resolved,
                COUNT(*) FILTER (WHERE a.whale_score BETWEEN :elite_lo AND :elite_hi AND wth.pnl IS NOT NULL AND ABS(wth.pnl::float) >= 0.01 AND wth.pnl::float > 0)::int AS elite_wins,
                AVG(CASE WHEN a.whale_score BETWEEN :elite_lo AND :elite_hi AND wth.pnl IS NOT NULL AND ABS(wth.pnl::float) >= 0.01 AND wth.trade_usd::float > 0 THEN wth.pnl::float / wth.trade_usd::float END) AS elite_avg_roi,

                COUNT(*) FILTER (WHERE a.whale_score BETWEEN :high_lo AND :high_hi)::int AS high_cnt,
                COUNT(*) FILTER (WHERE a.whale_score BETWEEN :high_lo AND :high_hi AND wth.pnl IS NOT NULL AND ABS(wth.pnl::float) >= 0.01)::int AS high_resolved,
                COUNT(*) FILTER (WHERE a.whale_score BETWEEN :high_lo AND :high_hi AND wth.pnl IS NOT NULL AND ABS(wth.pnl::float) >= 0.01 AND wth.pnl::float > 0)::int AS high_wins,
                AVG(CASE WHEN a.whale_score BETWEEN :high_lo AND :high_hi AND wth.pnl IS NOT NULL AND ABS(wth.pnl::float) >= 0.01 AND wth.trade_usd::float > 0 THEN wth.pnl::float / wth.trade_usd::float END) AS high_avg_roi,

                COUNT(*) FILTER (WHERE a.whale_score BETWEEN :med_lo AND :med_hi)::int AS med_cnt,
                COUNT(*) FILTER (WHERE a.whale_score BETWEEN :med_lo AND :med_hi AND wth.pnl IS NOT NULL AND ABS(wth.pnl::float) >= 0.01)::int AS med_resolved,
                COUNT(*) FILTER (WHERE a.whale_score BETWEEN :med_lo AND :med_hi AND wth.pnl IS NOT NULL AND ABS(wth.pnl::float) >= 0.01 AND wth.pnl::float > 0)::int AS med_wins,
                AVG(CASE WHEN a.whale_score BETWEEN :med_lo AND :med_hi AND wth.pnl IS NOT NULL AND ABS(wth.pnl::float) >= 0.01 AND wth.trade_usd::float > 0 THEN wth.pnl::float / wth.trade_usd::float END) AS med_avg_roi,

                COUNT(*) FILTER (WHERE a.whale_score BETWEEN :base_lo AND :base_hi)::int AS base_cnt,
                COUNT(*) FILTER (WHERE a.whale_score BETWEEN :base_lo AND :base_hi AND wth.pnl IS NOT NULL AND ABS(wth.pnl::float) >= 0.01)::int AS base_resolved,
                COUNT(*) FILTER (WHERE a.whale_score BETWEEN :base_lo AND :base_hi AND wth.pnl IS NOT NULL AND ABS(wth.pnl::float) >= 0.01 AND wth.pnl::float > 0)::int AS base_wins,
                AVG(CASE WHEN a.whale_score BETWEEN :base_lo AND :base_hi AND wth.pnl IS NOT NULL AND ABS(wth.pnl::float) >= 0.01 AND wth.trade_usd::float > 0 THEN wth.pnl::float / wth.trade_usd::float END) AS base_avg_roi
            FROM alerts a
            JOIN whale_trades wt ON wt.id = a.whale_trade_id
            LEFT JOIN whale_trade_history wth ON wth.trade_id = wt.trade_id"""),
            {
                "elite_lo": 90, "elite_hi": 100,
                "high_lo": 80, "high_hi": 89,
                "med_lo": 70, "med_hi": 79,
                "base_lo": 0, "base_hi": 69,
            }
        )
        row = tier_result.first()
        tiers = []
        for prefix, label in [("elite", "Elite conviction"), ("high", "High conviction"), ("med", "Medium conviction"), ("base", "Baseline")]:
            cnt = int(getattr(row, f"{prefix}_cnt", 0) or 0)
            resolved = int(getattr(row, f"{prefix}_resolved", 0) or 0)
            wins = int(getattr(row, f"{prefix}_wins", 0) or 0)
            avg_roi = float(getattr(row, f"{prefix}_avg_roi", 0)) if getattr(row, f"{prefix}_avg_roi", None) is not None else None
            tiers.append({
                "tier": prefix,
                "labelName": label,
                "count": cnt,
                "resolvedCount": resolved,
                "winRate": wins / resolved if resolved > 0 else None,
                "avgRoi": avg_roi,
            })

        # ── Star whale: top by realized_pnl, with ROI/win_rate from whale_stats ──
        stmt3 = (
            select(
                WhaleProfile.wallet_address,
                WhaleProfile.realized_pnl,
                WhaleProfile.total_trades,
                WhaleScore.final_score,
                WhaleStats.roi,
                WhaleStats.win_rate,
            )
            .join(WhaleScore, WhaleScore.wallet_address == WhaleProfile.wallet_address)
            .join(WhaleStats, WhaleStats.wallet_address == WhaleProfile.wallet_address, isouter=True)
            .where(WhaleProfile.realized_pnl > 0)
            .order_by(desc(WhaleProfile.realized_pnl))
            .limit(1)
        )
        r3 = await session.execute(stmt3)
        sw_row = r3.first()
        star = None
        if sw_row:
            addr = sw_row.wallet_address
            pnl = float(sw_row.realized_pnl or 0)
            star = {
                "walletMasked": f"{addr[:6]}…{addr[-4:]}" if len(addr) > 10 else addr,
                "totalPnl": pnl,
                "roi": float(sw_row.roi or 0),
                "winRate": float(sw_row.win_rate or 0),
                "whaleScore": int(sw_row.final_score or 0),
                "totalTrades": int(sw_row.total_trades or 0),
            }

    return {
        "historyTotal": total,
        "scoreTiers": tiers,
        "starWhale": star,
    }


@app.get("/stats/pricing")
async def pricing_stats():
    """Stats for the pricing page value anchor."""
    import json
    from shared.models import Alert, WhaleProfile
    from sqlalchemy import func, select

    CACHE_KEY = "stats:pricing"
    CACHE_TTL = 300  # 5 minutes (PF-M5)

    redis = await _get_redis()
    try:
        cached = await redis.get(CACHE_KEY)
        if cached:
            return json.loads(cached)
    except Exception:
        pass  # Redis miss or error — fall through to DB

    async with SessionLocal() as session:
        # Signal count
        total = (await session.execute(select(func.count()).select_from(Alert))).scalar() or 0

        # Avg trade size from whale_profiles
        avg_size_stmt = select(func.avg(WhaleProfile.total_volume / func.nullif(WhaleProfile.total_trades, 0)))
        avg_size = (await session.execute(avg_size_stmt)).scalar()

    result = {
        "total": total,
        "avgSize": float(avg_size) if avg_size else None,
    }

    try:
        await redis.set(CACHE_KEY, json.dumps(result), ex=CACHE_TTL)
    except Exception:
        logger.debug("pricing_stats_cache_write_failed", exc_info=True)

    return result


@app.get("/history")
async def history_signals(limit: int = Query(500, ge=1, le=1000)):
    """Public history page data with PnL from whale_trade_history + Gamma enrichment."""
    from sqlalchemy import text
    async with SessionLocal() as session:
        result = await session.execute(
            text(
                """SELECT a.id, a.created_at, a.whale_score::int AS whale_score,
                          tr.price::float AS price, tr.side, tr.outcome,
                          tr.amount::float AS amount,
                          COALESCE(NULLIF(TRIM(tr.wallet), ''), a.wallet_address) AS wallet,
                          COALESCE(NULLIF(TRIM(m.title), ''), a.market_id) AS market_title,
                          wth.pnl::float AS hist_pnl,
                          wth.trade_usd::float AS hist_trade_usd,
                          COALESCE(NULLIF(TRIM(tr.market_id), ''), NULLIF(TRIM(a.market_id), '')) AS raw_token_id,
                          (SELECT tc.condition_id
                           FROM token_conditions tc
                           WHERE tc.token_id = COALESCE(NULLIF(TRIM(tr.market_id), ''), NULLIF(TRIM(a.market_id), ''))
                              OR tc.market_id = COALESCE(NULLIF(TRIM(tr.market_id), ''), NULLIF(TRIM(a.market_id), ''))
                           ORDER BY CASE
                             WHEN tc.token_id = COALESCE(NULLIF(TRIM(tr.market_id), ''), NULLIF(TRIM(a.market_id), '')) THEN 0
                             ELSE 1
                           END
                           LIMIT 1) AS condition_id
                   FROM alerts a
                   JOIN whale_trades wt ON wt.id = a.whale_trade_id
                   JOIN trades_raw tr ON tr.trade_id = wt.trade_id
                   LEFT JOIN markets m ON m.id = a.market_id
                   LEFT JOIN whale_trade_history wth ON wth.trade_id = wt.trade_id
                   ORDER BY a.created_at DESC
                   LIMIT :limit"""
            ),
            {"limit": limit},
        )
        rows = result.all()

    # ── Collect unique Gamma lookup keys ──
    token_ids: list[str] = []
    condition_ids: list[str] = []
    for r in rows:
        raw_tid = (r.raw_token_id or "").strip()
        cid = (r.condition_id or "").strip()
        if raw_tid:
            token_ids.append(raw_tid)
        if cid:
            condition_ids.append(cid)

    # ── Batch-fetch Gamma markets (non-fatal) ──
    gamma_by_token: dict[str, dict] = {}
    gamma_by_condition: dict[str, dict] = {}
    try:
        gamma_by_token, _ = _gamma_fetch_batch("clobTokenIds", token_ids)
        gamma_by_condition, _ = _gamma_fetch_batch("condition_ids", condition_ids)
    except Exception:
        pass  # Gamma unavailable → ROI from hist_pnl only

    # ── Build signal list ──
    signals = []
    for r in rows:
        price = r.price
        amount = r.amount or 1
        size_usd = round(price * amount, 2) if price else None
        wallet = r.wallet or ""
        hist_pnl = r.hist_pnl
        hist_trade_usd = r.hist_trade_usd
        raw_token_id = (r.raw_token_id or "").strip()
        condition_id = (r.condition_id or "").strip()

        # ---- Step 1: ROI from whale_trade_history PnL ----
        roi_pct = None
        computed_pnl = None
        if hist_pnl is not None and abs(hist_pnl) >= 0.01:
            computed_pnl = float(hist_pnl)
            if hist_trade_usd and float(hist_trade_usd) > 0:
                roi_pct = float(hist_pnl) / float(hist_trade_usd)

        # ---- Step 2: Gamma enrichment (resolved settlement price) ----
        end_price = None
        if roi_pct is None:
            # Look up Gamma by token_id first, then condition_id
            gamma = None
            if raw_token_id:
                gamma = gamma_by_token.get(raw_token_id.lower()) or gamma_by_token.get(raw_token_id)
            if not gamma and condition_id:
                gamma = gamma_by_condition.get(condition_id.lower()) or gamma_by_condition.get(condition_id)

            if gamma:
                gdata = _parse_gamma_market(gamma, condition_id or raw_token_id)
                if gdata:
                    # Try resolved ROI first
                    resolved_roi, resolved_end = _roi_from_gamma(
                        r.side, r.outcome, price, gdata, raw_token_id, require_resolved=True
                    )
                    if resolved_roi is not None:
                        roi_pct = resolved_roi
                        end_price = resolved_end

                    # Settlement price
                    if end_price is None:
                        end_price = (
                            _gamma_settlement_price(gdata, r.outcome, raw_token_id)
                            or _gamma_leg_price(gdata, r.outcome, raw_token_id)
                        )

                    # Try MTM (mark-to-market) if still no resolved ROI
                    if roi_pct is None:
                        mtm_roi, mtm_end = _roi_from_gamma(
                            r.side, r.outcome, price, gdata, raw_token_id, require_resolved=False
                        )
                        if mtm_roi is not None:
                            roi_pct = mtm_roi
                        if end_price is None:
                            end_price = mtm_end

        # ---- Step 3: Compute PnL from ROI if no hist_pnl ----
        if computed_pnl is None and roi_pct is not None and size_usd is not None and size_usd > 0:
            computed_pnl = size_usd * roi_pct

        signals.append({
            "id": r.id,
            "publishedAt": r.created_at.isoformat() if hasattr(r.created_at, 'isoformat') else str(r.created_at),
            "marketTitle": r.market_title or "—",
            "whaleScore": int(r.whale_score) if r.whale_score is not None else None,
            "publishPrice": round(price, 3) if price else None,
            "outcomeLabel": r.outcome or None,
            "sideLabel": (r.side or "").upper()[:4] if r.side else None,
            "sizeUsd": size_usd,
            "walletMasked": _format_short_wallet(wallet),
            "endPrice": round(end_price, 4) if end_price is not None else None,
            "realizedPnlUsd": round(computed_pnl, 2) if computed_pnl is not None else None,
            "computedPnlUsd": round(computed_pnl, 2) if computed_pnl is not None else None,
            "roiPct": round(roi_pct, 4) if roi_pct is not None else None,
        })

    # ── Summary from resolved signals ──
    with_roi = [s for s in signals if s["roiPct"] is not None and s["computedPnlUsd"] is not None]
    wins = [s for s in with_roi if (s["roiPct"] or 0) > 0]
    total_pnl = sum(s["computedPnlUsd"] for s in with_roi)

    return {
        "signals": signals,
        "summary": {
            "total": len(signals),
            "winRate": len(wins) / len(with_roi) if with_roi else None,
            "avgRoi": sum(s["roiPct"] for s in with_roi) / len(with_roi) if with_roi else None,
            "totalPnl": round(total_pnl, 2) if with_roi else None,
        },
    }


# ── Market trades endpoint (for /analyze page) ──────────────────────────

@app.get("/market/{slug}/trades")
async def market_whale_trades(slug: str, hours: int = 24, minSize: int = 0):
    """Return recent whale trades for a market, for the /analyze page."""
    from sqlalchemy import text

    lookback_hours = max(1, min(hours, 168))  # clamp 1–168
    min_size = max(0, min(minSize, 1_000_000))  # clamp 0–1M
    pattern = f"%{slug}%"  # wildcards for ILIKE (safe: only used as bound parameter)
    async with SessionLocal() as session:
        result = await session.execute(
            text(
                """SELECT
                      wt.wallet_address,
                      wt.created_at,
                      COALESCE(NULLIF(TRIM(tr.market_title), ''), wt.market_id) AS market,
                      tr.side,
                      (tr.amount::numeric * tr.price::numeric) AS trade_usd,
                      wt.whale_score::float AS whale_score
                    FROM whale_trades wt
                    INNER JOIN trades_raw tr ON tr.trade_id = wt.trade_id
                    WHERE (
                      wt.market_id ILIKE :pattern
                      OR tr.market_title ILIKE :pattern
                    )
                    AND (tr.amount::numeric * tr.price::numeric) >= :min_size
                    AND wt.created_at >= NOW() - INTERVAL '1 hour' * :lookback_hours
                    ORDER BY wt.created_at DESC NULLS LAST
                    LIMIT 100"""
            ),
            {"pattern": pattern, "min_size": min_size, "lookback_hours": lookback_hours},
        )
        rows = result.all()

    signals = []
    for r in rows:
        wallet = r.wallet_address or ""
        side_raw = (r.side or "").strip().upper()
        side = side_raw if side_raw in ("BUY", "SELL") else "UNKNOWN"
        ws = r.whale_score
        occurred = r.created_at.isoformat() if r.created_at else ""
        signals.append({
            "id": f"api-{wallet}-{occurred}",
            "occurredAt": occurred,
            "walletMasked": f"{wallet[:6]}…{wallet[-4:]}" if wallet and len(wallet) > 10 else wallet,
            "market": (r.market or "").strip() or slug,
            "side": side,
            "sizeUsd": round(float(r.trade_usd or 0), 2),
            "whaleScore": round(float(ws), 1) if ws is not None else None,
            "href": f"/whales/{wallet}" if wallet else None,
        })

    return {"signals": signals, "slug": slug, "lookbackHours": lookback_hours, "minSize": min_size}
