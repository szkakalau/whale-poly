from datetime import datetime, timedelta, timezone

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
    await update.effective_message.reply_text("Status: inactive\nExpire: ")
    return

  await update.effective_message.reply_text(f"Status: active\nExpire: {sub.current_period_end.isoformat()}")


async def generate_code_callback(update: Update, _: ContextTypes.DEFAULT_TYPE) -> None:
  if not update.callback_query:
    return
  await update.callback_query.answer()
  if not await _ensure_private(update):
    await update.callback_query.edit_message_text("This bot only works in private chats.")
    return

  telegram_id = str(update.effective_user.id)
  code = _new_code()
  async with SessionLocal() as session:
    session.add(ActivationCode(code=code, telegram_id=telegram_id, used=False))
    await session.commit()

  await update.callback_query.edit_message_text(f"Your activation code: {code}")


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


async def send_alert_to_subscribers(payload: dict) -> int:
  redis = Redis.from_url(settings.redis_url, decode_responses=True)
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
