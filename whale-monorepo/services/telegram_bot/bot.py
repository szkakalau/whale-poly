import asyncio
import logging

from telegram.ext import ApplicationBuilder, CallbackQueryHandler, CommandHandler

from services.telegram_bot.handlers import generate_code_callback, start, status
from shared.config import settings


logger = logging.getLogger("telegram_bot.bot")


async def build_application():
  application = ApplicationBuilder().token(settings.telegram_bot_token).build()
  application.add_handler(CommandHandler("start", start))
  application.add_handler(CommandHandler("status", status))
  application.add_handler(CallbackQueryHandler(generate_code_callback, pattern="^generate_code$"))
  return application


async def run_polling(stop: asyncio.Event, application) -> None:
  await application.initialize()
  await application.start()
  await application.updater.start_polling(allowed_updates=["message", "callback_query"])
  logger.info("bot_polling_started")
  try:
    await stop.wait()
  finally:
    await application.updater.stop()
    await application.stop()
    await application.shutdown()
    logger.info("bot_polling_stopped")
