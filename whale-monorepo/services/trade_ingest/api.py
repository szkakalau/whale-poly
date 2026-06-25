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
