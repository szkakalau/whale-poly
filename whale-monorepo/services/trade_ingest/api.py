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

        # ── Score tier breakdown with ROI/win rate from whale_stats ──
        tiers = []
        for min_s, max_s, label in [
            (90, 100, "Elite conviction"),
            (80, 89, "High conviction"),
            (70, 79, "Medium conviction"),
            (0, 69, "Baseline"),
        ]:
            stmt2 = (
                select(
                    func.count().label("cnt"),
                    func.avg(WhaleStats.win_rate).label("avg_wr"),
                    func.avg(WhaleStats.roi).label("avg_roi"),
                )
                .select_from(WhaleScore)
                .join(WhaleStats, WhaleStats.wallet_address == WhaleScore.wallet_address, isouter=True)
                .where(WhaleScore.final_score >= min_s, WhaleScore.final_score <= max_s)
            )
            r2 = await session.execute(stmt2)
            r = r2.first()
            cnt = int(r.cnt) if r and r.cnt else 0
            tiers.append({
                "tier": f"{min_s}–{max_s}",
                "labelName": label,
                "count": cnt,
                "winRate": float(r.avg_wr) if r and r.avg_wr is not None else None,
                "avgRoi": float(r.avg_roi) if r and r.avg_roi is not None else None,
            })

        # ── Star whale: top by realized_pnl, use whale_score from whale_scores ──
        stmt3 = (
            select(
                WhaleProfile.wallet_address,
                WhaleProfile.realized_pnl,
                WhaleProfile.total_trades,
                WhaleProfile.wins,
                WhaleProfile.losses,
                WhaleScore.final_score,
            )
            .join(WhaleScore, WhaleScore.wallet_address == WhaleProfile.wallet_address)
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
            wr = float(sw_row.wins or 0) / float(sw_row.total_trades or 1) if sw_row.total_trades else 0
            star = {
                "walletMasked": f"{addr[:6]}…{addr[-4:]}" if len(addr) > 10 else addr,
                "totalPnl": pnl,
                "roi": 0,
                "winRate": wr,
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
    """Public history page data. Returns alerts with basic PnL info."""
    from shared.models import Alert, WhaleTrade, TradeRaw, Market
    from sqlalchemy import desc

    async with SessionLocal() as session:
        stmt = (
            select(
                Alert.id,
                Alert.created_at,
                Alert.market_id,
                Alert.whale_score,
                TradeRaw.price,
                TradeRaw.side,
                TradeRaw.outcome,
                TradeRaw.amount,
                TradeRaw.wallet,
                Market.title.label("market_title"),
                Market.status.label("market_status"),
            )
            .join(WhaleTrade, WhaleTrade.id == Alert.whale_trade_id)
            .join(TradeRaw, TradeRaw.trade_id == WhaleTrade.trade_id)
            .outerjoin(Market, Market.id == Alert.market_id)
            .order_by(desc(Alert.created_at))
            .limit(limit)
        )
        result = await session.execute(stmt)
        rows = result.all()

    signals = []
    for r in rows:
        price = float(r.price) if r.price else None
        amount = float(r.amount) if r.amount else 1
        size_usd = price * amount if price else None
        signals.append({
            "id": r.id,
            "publishedAt": r.created_at.isoformat() if r.created_at else None,
            "marketTitle": r.market_title or "—",
            "whaleScore": int(r.whale_score) if r.whale_score else None,
            "publishPrice": price,
            "outcomeLabel": r.outcome or None,
            "sideLabel": (r.side or "").upper() or None,
            "sizeUsd": size_usd,
            "walletMasked": f"{r.wallet[:6]}…{r.wallet[-4:]}" if r.wallet and len(r.wallet) > 10 else (r.wallet or "—"),
            "endPrice": None,
            "realizedPnlUsd": None,
            "computedPnlUsd": None,
            "roiPct": None,
        })

    # Compute summary
    total = len(signals)
    with_roi = [s for s in signals if s["roiPct"] is not None]
    win_rate = len([s for s in with_roi if (s["roiPct"] or 0) > 0]) / len(with_roi) if with_roi else None
    avg_roi = sum(s["roiPct"] for s in with_roi) / len(with_roi) if with_roi else None
    total_pnl = sum(s["computedPnlUsd"] for s in with_roi if s["computedPnlUsd"]) if with_roi else None

    return {
        "signals": signals,
        "summary": {
            "total": total,
            "winRate": win_rate,
            "avgRoi": avg_roi,
            "totalPnl": total_pnl,
        },
    }
