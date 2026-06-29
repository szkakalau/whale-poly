import asyncio
import logging

from telegram import BotCommand
from telegram.ext import ApplicationBuilder, CallbackQueryHandler, CommandHandler

from services.telegram_bot.handlers import analyze, generate_code_callback, promote, start, status
from shared.config import settings


logger = logging.getLogger("telegram_bot.bot")

_COMMANDS = [
  BotCommand("start", "开始 / 生成激活码"),
  BotCommand("status", "查看订阅状态"),
  BotCommand("analyze", "分析 Polymarket 市场鲸鱼动向"),
]


async def build_application():
  application = ApplicationBuilder().token(settings.telegram_bot_token).build()
  application.add_handler(CommandHandler("start", start))
  application.add_handler(CommandHandler("status", status))
  application.add_handler(CommandHandler("promote", promote))
  application.add_handler(CommandHandler("analyze", analyze))
  application.add_handler(CallbackQueryHandler(generate_code_callback, pattern="^generate_code$"))
  return application


async def run_polling(stop: asyncio.Event, application) -> None:
  await application.initialize()
  await application.start()
  await application.bot.set_my_commands(_COMMANDS)
  await application.updater.start_polling(allowed_updates=["message", "callback_query"])
  logger.info("bot_polling_started")

  from services.telegram_bot.vw_pusher import run_vw_pusher
  vw_task = asyncio.create_task(run_vw_pusher(stop, application.bot))

  from services.telegram_bot.daily_vw_digest import run_daily_digest
  digest_task = asyncio.create_task(run_daily_digest(stop, application.bot))

  try:
    await stop.wait()
  finally:
    vw_task.cancel()
    digest_task.cancel()
    try:
      await vw_task
    except asyncio.CancelledError:
      pass
    try:
      await digest_task
    except asyncio.CancelledError:
      pass
    await application.updater.stop()
    await application.stop()
    await application.shutdown()
    logger.info("bot_polling_stopped")
