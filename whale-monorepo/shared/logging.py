import logging


def configure_logging(level: str) -> None:
  logging.basicConfig(level=level, format="%(asctime)s %(levelname)s %(name)s %(message)s")

  # Silence noisy/credential-leaking third-party INFO logs (CR-L1):
  # - httpx logs every HTTP request at INFO, including full Telegram bot URLs
  #   (`https://api.telegram.org/bot<TOKEN>/...`) — the bot token must never
  #   appear in logs. Requests are still logged at WARNING on failure.
  # - python-telegram-bot / asyncio noise stays at WARNING+.
  for name in ("httpx", "httpcore", "telegram.ext", "telegram.vendor.ptb_urllib3", "asyncio"):
    logging.getLogger(name).setLevel(logging.WARNING)
