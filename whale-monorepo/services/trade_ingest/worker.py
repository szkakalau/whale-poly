import asyncio
import json
import logging
import os
import ssl
import time
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from celery import Celery
from celery.schedules import crontab
import httpx
from redis.asyncio import Redis
from sqlalchemy import select, desc, text

from services.trade_ingest.markets import ingest_markets
from services.trade_ingest.polymarket import ingest_trades
from shared.config import settings
from shared.db import SessionLocal
from shared.logging import configure_logging
from shared.models import Alert, Market, TradeRaw, WalletName, WhaleProfile, WhaleStats, WhaleTrade
from services.trade_ingest.smart_collections import rebuild_smart_collections


configure_logging(settings.log_level)
logger = logging.getLogger("trade_ingest.worker")


celery_app = Celery("trade_ingest", broker=settings.redis_url, backend=settings.redis_url)
if settings.redis_url.startswith("rediss://"):
  celery_app.conf.broker_use_ssl = {"ssl_cert_reqs": ssl.CERT_REQUIRED}
  celery_app.conf.redis_backend_use_ssl = {"ssl_cert_reqs": ssl.CERT_REQUIRED}
celery_app.conf.worker_concurrency = int(os.getenv("CELERY_CONCURRENCY", "1"))
celery_app.conf.worker_pool = os.getenv("CELERY_POOL", "solo")
celery_app.conf.timezone = "Asia/Shanghai"
celery_app.conf.task_default_queue = "trade_ingest"
celery_app.conf.task_default_exchange = "trade_ingest"
celery_app.conf.task_default_routing_key = "trade_ingest"
ingest_markets_seconds = float(os.getenv("MARKET_INGEST_SECONDS", "120"))
ingest_trades_seconds = float(os.getenv("TRADE_INGEST_SECONDS", "30"))
celery_app.conf.beat_schedule = {
  "ingest-markets": {"task": "services.trade_ingest.ingest_markets", "schedule": ingest_markets_seconds},
  "ingest-trades": {"task": "services.trade_ingest.ingest_trades", "schedule": ingest_trades_seconds},
  "full-health-check": {"task": "services.trade_ingest.health_check", "schedule": 3600.0},
  "daily-spotlight": {"task": "services.trade_ingest.daily_spotlight", "schedule": crontab(hour=20, minute=0)},
  "rebuild-smart-collections": {"task": "services.trade_ingest.rebuild_smart_collections", "schedule": 86400.0},
}


def _run(coro):
  try:
    loop = asyncio.get_event_loop()
  except RuntimeError:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
  if loop.is_closed():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
  return loop.run_until_complete(coro)


async def _fetch_health(client: httpx.AsyncClient, base_url: str) -> tuple[int | None, str]:
  url = base_url.rstrip("/") + "/health"
  try:
    resp = await client.get(url, timeout=10)
    if resp.status_code == 404:
      alt = base_url.rstrip("/") + "/healthz"
      resp = await client.get(alt, timeout=10)
    return resp.status_code, ""
  except Exception as e:
    return None, str(e)


async def _inject_trade(client: httpx.AsyncClient, base_url: str, trade_id: str) -> tuple[bool, str]:
  url = base_url.rstrip("/") + "/ingest/trade"
  payload = {
    "trade_id": trade_id,
    "market_id": "health-market",
    "market_title": "Health Market",
    "wallet": "0xabc1234567890defabc1234567890defabc12345",
    "side": "buy",
    "amount": 40000,
    "price": 0.3,
    "timestamp": datetime.now(timezone.utc).isoformat(),
  }
  try:
    resp = await client.post(url, json=payload, timeout=10)
    if resp.status_code >= 200 and resp.status_code < 300:
      return True, ""
    return False, f"status={resp.status_code} body={resp.text[:200]}"
  except Exception as e:
    return False, str(e)


async def _wait_for_alert(trade_id: str, started_at: datetime, timeout_seconds: int = 120) -> tuple[str | None, str | None]:
  deadline = time.monotonic() + timeout_seconds
  while time.monotonic() < deadline:
    async with SessionLocal() as session:
      wt = (
        await session.execute(
          select(WhaleTrade).where(WhaleTrade.trade_id == trade_id)
        )
      ).scalars().first()
      if not wt:
        await asyncio.sleep(5)
        continue
      alert = (
        await session.execute(
          select(Alert).where(Alert.whale_trade_id == wt.id).where(Alert.created_at >= started_at)
        )
      ).scalars().first()
      if alert:
        return wt.id, alert.id
    await asyncio.sleep(5)
  return None, None


async def _resolve_chat_id(client: httpx.AsyncClient) -> str | None:
  if settings.telegram_health_chat_id:
    return settings.telegram_health_chat_id
  username = (settings.telegram_health_username or "").lstrip("@")
  if not settings.telegram_health_bot_token or not username:
    return None
  base = f"https://api.telegram.org/bot{settings.telegram_health_bot_token}"
  chat_resp = await client.get(f"{base}/getChat", params={"chat_id": f"@{username}"}, timeout=10)
  if chat_resp.status_code == 200:
    payload = chat_resp.json()
    if payload.get("ok") and payload.get("result", {}).get("id"):
      return str(payload["result"]["id"])
  updates_resp = await client.get(f"{base}/getUpdates", timeout=10)
  if updates_resp.status_code != 200:
    return None
  data = updates_resp.json()
  if not data.get("ok"):
    return None
  for item in data.get("result", []):
    msg = item.get("message") or item.get("edited_message") or {}
    chat = msg.get("chat") or {}
    from_user = msg.get("from") or {}
    if (chat.get("username") or "").lower() == username.lower():
      return str(chat.get("id"))
    if (from_user.get("username") or "").lower() == username.lower():
      return str(chat.get("id"))
  return None


async def _send_telegram_raw(client: httpx.AsyncClient, token: str, chat_id: str, content: str) -> bool:
  url = f"https://api.telegram.org/bot{token}/sendMessage"
  payload = {"chat_id": chat_id, "text": content, "disable_web_page_preview": True}
  last_error = ""
  for attempt in range(1, 4):
    try:
      resp = await client.post(url, json=payload, timeout=15)
      if resp.status_code >= 200 and resp.status_code < 300:
        return True
      last_error = f"status={resp.status_code} body={resp.text[:200]}"
    except Exception as e:
      last_error = f"error={e}"
    logger.warning("telegram_send_retry attempt=%s %s", attempt, last_error)
    if attempt < 3:
      await asyncio.sleep(1 * attempt)
  logger.warning("telegram_send_failed %s", last_error)
  return False


async def _send_telegram(client: httpx.AsyncClient, content: str) -> None:
  sent = False
  if not settings.telegram_health_bot_token:
    logger.warning("telegram_health_bot_token_missing")
  else:
    chat_id = await _resolve_chat_id(client)
    if not chat_id:
      logger.warning("telegram_health_chat_id_missing")
    else:
      sent = await _send_telegram_raw(client, settings.telegram_health_bot_token, chat_id, content)
  if sent:
    return
  if settings.telegram_bot_token and settings.telegram_alert_chat_id:
    await _send_telegram_raw(client, settings.telegram_bot_token, settings.telegram_alert_chat_id, content)
  else:
    logger.warning("telegram_alert_config_missing")


async def _send_alert_telegram(client: httpx.AsyncClient, content: str) -> None:
  if not settings.telegram_bot_token or not settings.telegram_alert_chat_id:
    logger.warning("telegram_alert_config_missing")
    return
  url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
  payload = {"chat_id": settings.telegram_alert_chat_id, "text": content, "disable_web_page_preview": True}
  last_error = ""
  for attempt in range(1, 4):
    try:
      resp = await client.post(url, json=payload, timeout=15)
      if resp.status_code >= 200 and resp.status_code < 300:
        return
      last_error = f"status={resp.status_code} body={resp.text[:200]}"
    except Exception as e:
      last_error = f"error={e}"
    logger.warning("telegram_send_retry attempt=%s %s", attempt, last_error)
    if attempt < 3:
      await asyncio.sleep(1 * attempt)
  logger.warning("telegram_send_failed %s", last_error)


def _build_blog_post(now_local: datetime, now_utc: datetime, big_spender, contrarian, sniper) -> dict:
  date_label = now_local.strftime("%Y-%m-%d")
  title = f"Daily Whale Intelligence Brief · {date_label}"
  slug = f"daily-spotlight-{date_label}"
  excerpt = "A concise market brief: whale flows, contrarian signals, and high‑win‑rate activity."

  def format_section(header: str, trade_data, is_sniper: bool = False) -> list[str]:
    if not trade_data:
      return [f"## {header}", "No qualifying trades found."]
    if is_sniper:
      trade, mkt_title, win_rate, username = trade_data
    else:
      trade, mkt_title, username = trade_data
    val = float(trade.amount) * float(trade.price)
    price_cents = float(trade.price) * 100
    side = (trade.side or "").upper() or "TRADE"
    name = username if username else f"{trade.wallet[:6]}...{trade.wallet[-4:]}"
    market = mkt_title if mkt_title else "Unknown Market"
    lines = [
      f"## {header}",
      f"- Actor: {name}",
      f"- Direction: {side}",
      f"- Market: {market}",
      f"- Notional: ${val:,.0f}",
      f"- Price: {price_cents:.1f}¢",
    ]
    if is_sniper:
      win_pct = float(win_rate) * 100
      lines.append(f"- Win rate: {win_pct:.1f}%")
    return lines

  parts = [
    f"# {title}",
    "",
    f"Window: {now_local.strftime('%Y-%m-%d %H:%M')} (Beijing time), last 24 hours.",
    "",
  ]
  parts += format_section("Big Spender", big_spender)
  parts.append("")
  parts += format_section("Contrarian Signal", contrarian)
  parts.append("")
  parts += format_section("High Win-Rate Sniper", sniper, True)
  parts += [
    "",
    "## Market Read",
    "- Large prints matter most when odds structure keeps shifting afterward.",
    "- Contrarian sizing often signals an information edge; watch for follow‑through.",
    "- Repeated activity from high‑win‑rate wallets tends to be more durable.",
    "",
    "*Disclaimer: Research and information only. Not financial or betting advice.*",
  ]

  return {
    "id": uuid.uuid4().hex,
    "slug": slug,
    "title": title,
    "excerpt": excerpt,
    "content": "\n".join(parts),
    "author": "SightWhale",
    "read_time": "3 min",
    "cover_image": None,
    "tags": ["Daily Spotlight", "Whale", "Polymarket"],
    "published_at": now_utc,
  }


async def _ensure_blog_posts_table(session) -> None:
  await session.execute(
    text(
      """
      create table if not exists blog_posts (
        id text primary key,
        slug text unique not null,
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


async def _upsert_blog_post(session, post: dict) -> None:
  await session.execute(
    text(
      """
      insert into blog_posts (
        id, slug, title, excerpt, content, author, read_time, cover_image, tags, published_at, created_at, updated_at
      )
      values (
        :id, :slug, :title, :excerpt, :content, :author, :read_time, :cover_image, :tags, :published_at, now(), now()
      )
      on conflict (slug) do update set
        title = excluded.title,
        excerpt = excluded.excerpt,
        content = excluded.content,
        author = excluded.author,
        read_time = excluded.read_time,
        cover_image = excluded.cover_image,
        tags = excluded.tags,
        published_at = excluded.published_at,
        updated_at = now()
      """
    ),
    {
      "id": post["id"],
      "slug": post["slug"],
      "title": post["title"],
      "excerpt": post["excerpt"],
      "content": post["content"],
      "author": post["author"],
      "read_time": post["read_time"],
      "cover_image": post["cover_image"],
      "tags": post["tags"],
      "published_at": post["published_at"],
    },
  )


async def run_daily_spotlight() -> dict:
  now_utc = datetime.now(timezone.utc)
  start_time = now_utc - timedelta(hours=24)
  async with SessionLocal() as session:
    stmt_spender = (
      select(TradeRaw, Market.title, WalletName.polymarket_username)
      .outerjoin(Market, TradeRaw.market_id == Market.id)
      .outerjoin(WalletName, TradeRaw.wallet == WalletName.wallet_address)
      .where(TradeRaw.timestamp >= start_time)
      .order_by(desc(TradeRaw.amount * TradeRaw.price))
      .limit(1)
    )
    stmt_contrarian = (
      select(TradeRaw, Market.title, WalletName.polymarket_username)
      .outerjoin(Market, TradeRaw.market_id == Market.id)
      .outerjoin(WalletName, TradeRaw.wallet == WalletName.wallet_address)
      .where(TradeRaw.timestamp >= start_time)
      .where(TradeRaw.price < 0.40)
      .where(TradeRaw.amount * TradeRaw.price > 1000)
      .order_by(desc(TradeRaw.amount * TradeRaw.price))
      .limit(1)
    )
    stmt_sniper = (
      select(TradeRaw, Market.title, WhaleStats.win_rate, WalletName.polymarket_username)
      .join(WhaleStats, TradeRaw.wallet == WhaleStats.wallet_address)
      .join(WhaleProfile, TradeRaw.wallet == WhaleProfile.wallet_address)
      .outerjoin(Market, TradeRaw.market_id == Market.id)
      .outerjoin(WalletName, TradeRaw.wallet == WalletName.wallet_address)
      .where(TradeRaw.timestamp >= start_time)
      .where(WhaleStats.win_rate >= 0.70)
      .where(WhaleProfile.total_trades > 5)
      .order_by(desc(TradeRaw.amount * TradeRaw.price))
      .limit(1)
    )
    big_spender = (await session.execute(stmt_spender)).first()
    contrarian = (await session.execute(stmt_contrarian)).first()
    sniper = (await session.execute(stmt_sniper)).first()

  now_local = now_utc.astimezone(ZoneInfo("Asia/Shanghai"))
  lines = [
    "🌟 Daily Alpha Spotlight",
    f"时间(北京时间): {now_local.strftime('%Y-%m-%d %H:%M:%S')}",
  ]

  if big_spender:
    trade, title, username = big_spender
    val = float(trade.amount) * float(trade.price)
    price_cents = float(trade.price) * 100
    side = (trade.side or "").upper() or "TRADE"
    name = username if username else f"{trade.wallet[:6]}...{trade.wallet[-4:]}"
    mkt_title = title if title else "Unknown Market"
    lines += [
      "",
      "💰 The Big Spender",
      f"WHO: {name}",
      f"DID: {side} ${val:,.0f} of '{mkt_title}'",
      f"AT: {price_cents:.1f}¢",
      f"COPY: Who just {side} ${val/1000:.1f}k on '{mkt_title[:40]}...' at {price_cents:.0f}¢? 🐳 #Polymarket #WhaleAlert",
    ]
  else:
    lines += ["", "💰 The Big Spender: No large trades found > 24h."]

  if contrarian:
    trade, title, username = contrarian
    val = float(trade.amount) * float(trade.price)
    price_cents = float(trade.price) * 100
    side = (trade.side or "").upper() or "TRADE"
    name = username if username else f"{trade.wallet[:6]}...{trade.wallet[-4:]}"
    mkt_title = title if title else "Unknown Market"
    lines += [
      "",
      "🧠 The Contrarian",
      f"WHO: {name}",
      f"DID: {side} ${val:,.0f} on LOW ODDS (<40%)",
      f"MKT: {mkt_title}",
      f"AT: {price_cents:.1f}¢",
      f"COPY: Everyone is selling, but this whale just {side}. ${val/1000:.1f}k at {price_cents:.0f}% odds on '{mkt_title[:30]}...'. 🤔 #Alpha #Contrarian",
    ]
  else:
    lines += ["", "🧠 The Contrarian: No large contrarian trades found."]

  if sniper:
    trade, title, win_rate, username = sniper
    val = float(trade.amount) * float(trade.price)
    price_cents = float(trade.price) * 100
    side = (trade.side or "").upper() or "TRADE"
    name = username if username else f"{trade.wallet[:6]}...{trade.wallet[-4:]}"
    mkt_title = title if title else "Unknown Market"
    win_pct = win_rate * 100
    lines += [
      "",
      "🎯 The Sniper",
      f"WHO: {name} (Win Rate: {win_pct:.1f}%)",
      f"DID: {side} '{mkt_title}'",
      f"SIZE: ${val:,.0f} @ {price_cents:.1f}¢",
      f"COPY: The {win_pct:.0f}% win-rate sniper just {side}. Tracking {name} on '{mkt_title[:30]}...' 🎯 #WhaleWatching",
    ]
  else:
    lines += ["", "🎯 The Sniper: No qualifying sniper trades found."]

  proxies = settings.https_proxy or None
  async with httpx.AsyncClient(proxies=proxies) as client:
    await _send_alert_telegram(client, "\n".join(lines))

  blog_post = _build_blog_post(now_local, now_utc, big_spender, contrarian, sniper)
  async with SessionLocal() as session:
    await _ensure_blog_posts_table(session)
    await _upsert_blog_post(session, blog_post)
    await session.commit()

  return {
    "time_utc": now_utc.isoformat(),
    "time_bjt": now_local.isoformat(),
    "big_spender": bool(big_spender),
    "contrarian": bool(contrarian),
    "sniper": bool(sniper),
    "blog_slug": blog_post["slug"],
  }


async def run_full_health_check() -> dict:
  proxies = settings.https_proxy or None
  health_urls = {
    "trade_ingest": settings.health_trade_ingest_api_url,
    "whale_engine": settings.health_whale_engine_api_url,
    "alert_engine": settings.health_alert_engine_api_url,
    "payment": settings.health_payment_api_url,
    "telegram_bot": settings.health_telegram_bot_api_url,
  }
  started_at = datetime.now(timezone.utc)
  trade_id = f"health-test-{int(time.time())}"
  results: dict[str, str] = {}

  async with httpx.AsyncClient(proxies=proxies) as client:
    for name, base_url in health_urls.items():
      code, err = await _fetch_health(client, base_url)
      if code is None:
        results[name] = f"error:{err}"
      else:
        results[name] = str(code)

    injected, inject_err = await _inject_trade(client, health_urls["trade_ingest"], trade_id)
    results["inject_trade"] = "ok" if injected else f"error:{inject_err}"

    whale_trade_id, alert_id = await _wait_for_alert(trade_id, started_at)
    results["whale_trade"] = whale_trade_id or "timeout"
    results["alert"] = alert_id or "timeout"

    ok = all(v == "200" for k, v in results.items() if k in {"trade_ingest", "whale_engine", "alert_engine", "payment", "telegram_bot"}) and injected and alert_id
    status = "OK" if ok else "FAIL"
    lines = [
      f"全链路检查结果: {status}",
      f"时间(UTC): {started_at.isoformat()}",
      f"trade-ingest /health: {results['trade_ingest']}",
      f"whale-engine /health: {results['whale_engine']}",
      f"alert-engine /health: {results['alert_engine']}",
      f"payment /health: {results['payment']}",
      f"telegram-bot /health: {results['telegram_bot']}",
      f"注入测试交易: {results['inject_trade']}",
      f"WhaleTrade: {results['whale_trade']}",
      f"Alert: {results['alert']}",
    ]
    await _send_telegram(client, "\n".join(lines))

  return {"status": status, "trade_id": trade_id, "results": results}


@celery_app.task(name="services.trade_ingest.ingest_markets")
def ingest_markets_task() -> int:
  async def runner():
    async with SessionLocal() as session:
      n = await ingest_markets(session)
      await session.commit()
    return n

  return _run(runner())


@celery_app.task(name="services.trade_ingest.ingest_trades")
def ingest_trades_task() -> int:
  async def runner():
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
      async with SessionLocal() as session:
        trade_ids = await ingest_trades(session)
        await session.commit()
      
      if trade_ids:
        await redis.rpush(settings.trade_created_queue, *[json.dumps({"trade_id": tid}) for tid in trade_ids])
      return len(trade_ids)
    finally:
      await redis.aclose()

  try:
    return _run(runner())
  except Exception:
    logger.exception("ingest_trades_failed")
    return 0


@celery_app.task(name="services.trade_ingest.health_check")
def health_check_task() -> dict:
  return _run(run_full_health_check())


@celery_app.task(name="services.trade_ingest.rebuild_smart_collections")
def rebuild_smart_collections_task() -> int:
  async def runner():
    async with SessionLocal() as session:
      n = await rebuild_smart_collections(session)
      await session.commit()
    return n

  try:
    return _run(runner())
  except Exception:
    logger.exception("rebuild_smart_collections_failed")
    return 0


@celery_app.task(name="services.trade_ingest.daily_spotlight")
def daily_spotlight_task() -> dict:
  return _run(run_daily_spotlight())
