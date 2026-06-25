import json
from datetime import datetime, timezone

from fastapi import FastAPI
from pydantic import AliasChoices, BaseModel, Field
from redis.asyncio import Redis
from shared.config import settings
from shared.logging import configure_logging


configure_logging(settings.log_level)

app = FastAPI(title="trade-ingest")


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
async def ingest_trade(payload: TradeIn):
  ts = payload.timestamp or datetime.now(timezone.utc)
  if ts.tzinfo is None:
    ts = ts.replace(tzinfo=timezone.utc)
  outcome = payload.outcome
  if outcome is not None and not str(outcome).strip():
    outcome = None

  redis = Redis.from_url(settings.redis_url, decode_responses=True)
  try:
    await redis.rpush(
      settings.trade_ingest_incoming_queue,
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
  finally:
    await redis.aclose()

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
    tag_where = f"and '{tag}' = any(tags)" if tag else ""

    async with SessionLocal() as session:
        posts_result = await session.execute(
            text(
                f"""select slug, title, excerpt, author, read_time, tags,
                           published_at, language, group_slug
                    from blog_posts
                    where status = 'published' and language = '{language}'
                    {tag_where}
                    order by published_at desc
                    limit {limit} offset {offset}"""
            )
        )
        posts = [dict(r._mapping) for r in posts_result]

        count_result = await session.execute(
            text(
                f"""select count(*) as count from blog_posts
                    where status = 'published' and language = '{language}'
                    {tag_where}"""
            )
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
                f"""select unnest(tags) as tag, count(*)::int as count
                    from blog_posts
                    where status = 'published' and language = '{language}'
                    group by tag order by count desc, tag"""
            )
        )
        tags = [dict(r._mapping) for r in result]
    return {"tags": tags}


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

        # ── Score tier breakdown: count alerts per whale_score range ──
        #     Win rate & ROI from whale_trade_history (resolved signals only)
        tiers = []
        for min_s, max_s, label in [
            (90, 100, "Elite conviction"),
            (80, 89, "High conviction"),
            (70, 79, "Medium conviction"),
            (0, 69, "Baseline"),
        ]:
            r2 = await session.execute(
                text(f"""SELECT
                    COUNT(*)::int AS cnt,
                    COUNT(*) FILTER (WHERE wth.pnl IS NOT NULL AND ABS(wth.pnl::float) >= 0.01)::int AS resolved,
                    COUNT(*) FILTER (WHERE wth.pnl IS NOT NULL AND ABS(wth.pnl::float) >= 0.01 AND wth.pnl::float > 0)::int AS wins,
                    AVG(CASE WHEN wth.pnl IS NOT NULL AND ABS(wth.pnl::float) >= 0.01 AND wth.trade_usd::float > 0
                        THEN wth.pnl::float / wth.trade_usd::float END) AS avg_roi
                FROM alerts a
                JOIN whale_trades wt ON wt.id = a.whale_trade_id
                LEFT JOIN whale_trade_history wth ON wth.trade_id = wt.trade_id
                WHERE a.whale_score >= {min_s} AND a.whale_score <= {max_s}""")
            )
            r = r2.first()
            cnt = int(r.cnt) if r and r.cnt else 0
            resolved = int(r.resolved) if r and r.resolved else 0
            wins = int(r.wins) if r and r.wins else 0
            avg_roi = float(r.avg_roi) if r and r.avg_roi is not None else None
            tiers.append({
                "tier": f"{min_s}–{max_s}",
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
    from shared.models import Alert, WhaleProfile
    from sqlalchemy import func, select

    async with SessionLocal() as session:
        # Signal count
        total = (await session.execute(select(func.count()).select_from(Alert))).scalar() or 0

        # Avg trade size from whale_profiles
        avg_size_stmt = select(func.avg(WhaleProfile.total_volume / func.nullif(WhaleProfile.total_trades, 0)))
        avg_size = (await session.execute(avg_size_stmt)).scalar()

    return {
        "total": total,
        "avgSize": float(avg_size) if avg_size else None,
    }


@app.get("/history")
async def history_signals(limit: int = 500):
    """Public history page data with PnL from whale_trade_history + Gamma enrichment."""
    from sqlalchemy import text
    async with SessionLocal() as session:
        result = await session.execute(
            text(
                f"""SELECT a.id, a.created_at, a.whale_score::int AS whale_score,
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
                   LIMIT {int(limit)}"""
            )
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
