from datetime import datetime, timedelta, timezone

import httpx
from redis.asyncio import Redis
from sqlalchemy import select
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from shared.config import settings
from shared.db import SessionLocal
from shared.models import ActivationCode, Subscription, TgUser


async def _ensure_private(update: Update) -> bool:
  if not update.effective_chat:
    return False
  return update.effective_chat.type == "private"


def _start_arg(update: Update) -> str:
  """
  Telegram deep links call /start with an optional payload:
  - /start subscribe_pro
  - /start subscribe_elite
  - /start site_header
  """
  try:
    text = (update.effective_message.text or "").strip()
  except Exception:
    text = ""
  if not text:
    return ""
  parts = text.split(maxsplit=1)
  if len(parts) < 2:
    return ""
  return (parts[1] or "").strip()


def _landing_base_url() -> str:
  import os
  from urllib.parse import urlparse

  # Prefer explicit public base URL (e.g. https://www.sightwhale.com)
  raw = (os.getenv("LANDING_PUBLIC_BASE_URL") or "").strip()
  if raw:
    return raw.rstrip("/")

  # Fallback: infer from known landing URLs (success/cancel) if set
  for candidate in (settings.landing_success_url, settings.landing_cancel_url):
    c = (candidate or "").strip()
    if not c:
      continue
    try:
      u = urlparse(c)
      if u.scheme and u.netloc:
        return f"{u.scheme}://{u.netloc}"
    except Exception:
      continue

  return "https://www.sightwhale.com"


async def _create_activation_code(*, telegram_id: str) -> str:
  code = _new_code()
  async with SessionLocal() as session:
    session.add(ActivationCode(code=code, telegram_id=telegram_id, used=False))
    await session.commit()
  return code


def _continue_keyboard(*, code: str):
  base = _landing_base_url()
  pro_monthly = f"{base}/subscribe?plan=pro&code={code}"
  pro_yearly = f"{base}/subscribe?plan=pro&period=yearly&code={code}"
  elite_monthly = f"{base}/subscribe?plan=elite&code={code}"
  return InlineKeyboardMarkup(
    [
      [InlineKeyboardButton("Continue (Pro)", url=pro_monthly)],
      [
        InlineKeyboardButton("Pro Yearly", url=pro_yearly),
        InlineKeyboardButton("Elite", url=elite_monthly),
      ],
    ]
  )


def _new_code() -> str:
  import secrets
  import string

  alphabet = string.ascii_uppercase + string.digits
  return "".join(secrets.choice(alphabet) for _ in range(8))


async def start(update: Update, _: ContextTypes.DEFAULT_TYPE) -> None:
  if not await _ensure_private(update):
    if update.effective_message:
      await update.effective_message.reply_text("This bot only works in private chats.")
    return

  telegram_id = str(update.effective_user.id)
  async with SessionLocal() as session:
    user = (await session.execute(select(TgUser).where(TgUser.telegram_id == telegram_id))).scalars().first()
    if not user:
      session.add(TgUser(telegram_id=telegram_id))
      await session.commit()

  arg = _start_arg(update).lower().strip()
  if arg in ("subscribe_pro", "subscribe_elite", "subscribe"):
    code = await _create_activation_code(telegram_id=telegram_id)
    tier = "Elite" if "elite" in arg else "Pro"
    msg = (
      f"✅ Activation code generated: {code}\n\n"
      f"Next step: tap Continue ({tier}) to open checkout. "
      "The code will be auto-filled for you."
    )
    await update.effective_message.reply_text(msg, reply_markup=_continue_keyboard(code=code))
    return

  kb = InlineKeyboardMarkup([[InlineKeyboardButton("Generate Code", callback_data="generate_code")]])
  msg = (
    "Welcome to Whale Intelligence.\n\n"
    "This bot delivers high-signal whale trades from Polymarket.\n\n"
    "Step 1: Get activation code\n"
    "Step 2: Purchase subscription\n"
    "Step 3: Activate access"
  )
  await update.effective_message.reply_text(msg, reply_markup=kb)


async def status(update: Update, _: ContextTypes.DEFAULT_TYPE) -> None:
  if not await _ensure_private(update):
    if update.effective_message:
      await update.effective_message.reply_text("This bot only works in private chats.")
    return

  telegram_id = str(update.effective_user.id)
  now = datetime.now(timezone.utc)
  async with SessionLocal() as session:
    sub = (
      await session.execute(
        select(Subscription)
        .where(Subscription.telegram_id == telegram_id)
        .where(Subscription.status.in_(["active", "trialing"]))
        .where(Subscription.current_period_end > now)
        .order_by(Subscription.current_period_end.desc())
        .limit(1)
      )
    ).scalars().first()

  if not sub:
    await update.effective_message.reply_text("Status: inactive\nPlan: Free")
    return

  plan_key = (sub.plan or "pro").lower()
  if "elite" in plan_key:
    plan_display = "Elite"
  elif "pro" in plan_key:
    plan_display = "Pro"
  else:
    plan_display = "Free"

  await update.effective_message.reply_text(
    f"Status: active\n"
    f"Plan: {plan_display}\n"
    f"Expire: {sub.current_period_end.strftime('%Y-%m-%d %H:%M:%S')} UTC"
  )


async def generate_code_callback(update: Update, _: ContextTypes.DEFAULT_TYPE) -> None:
  if not update.callback_query:
    return
  await update.callback_query.answer()
  if not await _ensure_private(update):
    await update.callback_query.edit_message_text("This bot only works in private chats.")
    return

  telegram_id = str(update.effective_user.id)
  code = await _create_activation_code(telegram_id=telegram_id)
  msg = (
    f"✅ Your activation code: {code}\n\n"
    "Next step: tap a button below to continue on the website. "
    "The code will be auto-filled for you."
  )
  await update.callback_query.edit_message_text(msg, reply_markup=_continue_keyboard(code=code))


async def promote(update: Update, _: ContextTypes.DEFAULT_TYPE) -> None:
  if not await _ensure_private(update):
    if update.effective_message:
      await update.effective_message.reply_text("This bot only works in private chats.")
    return

  telegram_id = str(update.effective_user.id)
  now = datetime.now(timezone.utc)
  end_date = now + timedelta(days=7)

  async with SessionLocal() as session:
    sub_id = f"manual_promo_{telegram_id}"

    sub = await session.get(Subscription, sub_id)
    if sub:
      sub.status = "active"
      sub.current_period_end = end_date
      sub.telegram_id = telegram_id
    else:
      sub = Subscription(
        id=sub_id,
        telegram_id=telegram_id,
        stripe_customer_id=f"promo_{telegram_id}",
        stripe_subscription_id=f"promo_sub_{telegram_id}",
        status="active",
        current_period_end=end_date,
      )
      session.add(sub)

    await session.commit()

  await update.effective_message.reply_text(f"✅ Access granted for 7 days.\nExpires: {end_date.isoformat()}")


async def analyze(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
  """Handle /analyze <market> — query the SightWhale decision engine."""
  if not await _ensure_private(update):
    if update.effective_message:
      await update.effective_message.reply_text("This bot only works in private chats.")
    return

  # Extract query (everything after /analyze)
  try:
    raw = (update.effective_message.text or "").strip()
  except Exception:
    raw = ""
  parts = raw.split(maxsplit=1)
  query = (parts[1] or "").strip() if len(parts) > 1 else ""

  if not query:
    await update.effective_message.reply_text(
      "使用方法：`/analyze <市场链接或关键词>`\n\n"
      "例如:\n"
      "• `/analyze BTC 150k`\n"
      "• `/analyze https://polymarket.com/event/will-btc-break-100k`\n\n"
      "我会分析鲸鱼在该市场上的动向，并给出方向 + 信心分。",
      parse_mode="Markdown",
    )
    return

  # Show typing indicator
  telegram_id = str(update.effective_user.id)
  await context.bot.send_chat_action(chat_id=update.effective_chat.id, action="typing")

  try:
    async with httpx.AsyncClient(timeout=15.0) as client:
      resp = await client.post(
        f"{_landing_base_url()}/api/analyze",
        json={"query": query, "userId": telegram_id},
      )
      resp.raise_for_status()
      data = resp.json()
  except httpx.HTTPStatusError as e:
    try:
      body = e.response.json()
      msg = body.get("message", str(e))
    except Exception:
      msg = "⚠️ 分析暂时不可用，请稍后再试。"
    await update.effective_message.reply_text(msg)
    return
  except Exception:
    await update.effective_message.reply_text("⚠️ 分析暂时不可用，请稍后再试（通常 < 5 分钟恢复）。")
    return

  # Use formatted text from API if available, otherwise build a simple message
  formatted = data.get("formattedText")
  if formatted:
    await update.effective_message.reply_text(
      formatted,
      parse_mode="Markdown",
      disable_web_page_preview=True,
    )
  else:
    # Fallback: build a simple response
    direction = data.get("direction", "unknown")
    confidence = data.get("confidenceScore", 0)
    level = data.get("confidenceLevel", "low")
    trade_count = data.get("whaleTradeCount", 0)
    message = data.get("message", "")

    if message:
      await update.effective_message.reply_text(message)
    elif trade_count == 0:
      await update.effective_message.reply_text(
        f"该市场在过去 24 小时内没有检测到大额鲸鱼交易。\n\n{data.get('disclaimer', '')}"
      )
    else:
      dir_emoji = {"bullish": "🟢", "bearish": "🔴", "neutral": "⚪", "mixed": "🟡"}.get(direction, "⚪")
      text = (
        f"{dir_emoji} 鲸鱼判断：**{direction.upper()}**\n"
        f"信心分：{confidence}/100 ({level})\n"
        f"检测到 {trade_count} 笔鲸鱼交易\n\n"
        f"{data.get('disclaimer', '')}"
      )
      await update.effective_message.reply_text(text, parse_mode="Markdown")


async def send_alert_to_subscribers(payload: dict) -> int:
  from shared.async_utils import get_redis as _get_shared_redis
  redis = await _get_shared_redis()
  try:
    now = datetime.now(timezone.utc)
    async with SessionLocal() as session:
      telegram_ids = (
        await session.execute(
          select(Subscription.telegram_id)
          .where(Subscription.status.in_(["active", "trialing"]))
          .where(Subscription.current_period_end > now)
        )
      ).scalars().all()
    if not telegram_ids:
      return 0

    from services.telegram_bot.templates import format_alert
    from services.telegram_bot.bot import build_application

    app = await build_application()
    await app.initialize()
    await app.start()
    try:
      sent = 0
      for tid in telegram_ids:
        text = format_alert(payload, tid)
        await app.bot.send_message(chat_id=int(tid), text=text, parse_mode="HTML", disable_web_page_preview=True)
        sent += 1
      return sent
    finally:
      await app.stop()
      await app.shutdown()
  finally:
    await redis.aclose()
