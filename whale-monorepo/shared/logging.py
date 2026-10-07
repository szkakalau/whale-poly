import logging
import re


# Telegram bot tokens are credentials and must never reach a log sink (CR-L1).
# httpx embeds the FULL request URL inside `HTTPStatusError` messages, e.g.
#   Client error '403 Forbidden' for url 'https://api.telegram.org/bot<TOKEN>/sendMessage'
# so any `logger.exception(...)` around a Telegram call prints the token in
# plain text. Always funnel exception text through `redact_secrets()` first.
# The scheme + host prefix is kept so the log still shows which endpoint failed.
TELEGRAM_TOKEN_RE = re.compile(r"(https://api\.telegram\.org/bot)[^/\s\"']+")

# A *bare* token, with no URL around it. python-telegram-bot raises
#   InvalidToken: The token `<TOKEN>` was rejected by the server.
# which embeds the credential verbatim — so redacting only the URL form is not
# enough, and the very failure mode most likely to occur (a rotated or revoked
# token) is the one that would have printed it. Real tokens look like
# `<8-10 digits>:<35 chars of [-A-Za-z0-9_]>`; requiring 6+ digits, a colon and
# 30+ secret characters keeps timestamps (`12:30`) and chat ids from matching.
TELEGRAM_BARE_TOKEN_RE = re.compile(r"\b\d{6,12}:[A-Za-z0-9_-]{30,}\b")


def redact_secrets(text: str) -> str:
  """Strip credentials out of arbitrary text before it is logged.

  Handles both shapes a Telegram bot token shows up in: embedded in an
  api.telegram.org URL, and bare (as python-telegram-bot reports it). For the
  URL form the prefix is kept (`https://api.telegram.org/bot***`) so operators
  can still tell which endpoint failed without the token being recoverable.
  """
  if not text:
    return text
  text = TELEGRAM_TOKEN_RE.sub(r"\1***", text)
  return TELEGRAM_BARE_TOKEN_RE.sub("***", text)


def configure_logging(level: str) -> None:
  logging.basicConfig(level=level, format="%(asctime)s %(levelname)s %(name)s %(message)s")

  # Silence noisy/credential-leaking third-party INFO logs (CR-L1):
  # - httpx logs every HTTP request at INFO, including full Telegram bot URLs
  #   (`https://api.telegram.org/bot<TOKEN>/...`) — the bot token must never
  #   appear in logs. Requests are still logged at WARNING on failure.
  # - python-telegram-bot / asyncio noise stays at WARNING+.
  for name in ("httpx", "httpcore", "telegram.ext", "telegram.vendor.ptb_urllib3", "asyncio"):
    logging.getLogger(name).setLevel(logging.WARNING)
