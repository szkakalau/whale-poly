import hashlib

from shared.config import settings


def user_hash(telegram_id: str) -> str:
  h = hashlib.sha1((settings.bot_user_hash_secret + ":" + telegram_id).encode("utf-8")).hexdigest()
  return h[:6]


def format_alert(payload: dict, telegram_id: str) -> str:
  market = payload.get("market_question") or payload.get("market") or "Unknown"
  alert_type = payload.get("alert_type") or ""
  side = payload.get("side") or "UNKNOWN"
  size = payload.get("size") or payload.get("amount") or ""
  price = payload.get("price") or ""
  score = payload.get("score") or payload.get("whale_score") or ""
  wallet = payload.get("wallet") or payload.get("wallet_address") or ""

  if isinstance(wallet, str) and wallet.startswith("0x") and len(wallet) > 10:
    wallet = wallet[:6] + "..." + wallet[-4:]

  type_line = f"Type:\n{alert_type}\n\n" if alert_type else ""
  wm = user_hash(telegram_id)
  return (
    "🐋 Whale Trade Detected\n\n"
    f"Market:\n{market}\n\n"
    f"{type_line}"
    f"Side:\n{side}\n\n"
    f"Size:\n${size}\n\n"
    f"Price:\n{price}\n\n"
    f"Whale Score:\n{score}\n\n"
    f"Wallet:\n{wallet}\n\n"
    f"#{wm}"
  )
