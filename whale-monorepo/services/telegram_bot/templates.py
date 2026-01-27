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

  def _fmt_usd(x) -> str:
    try:
      v = float(x)
    except Exception:
      return str(x)
    s = f"{v:,.2f}"
    if s.endswith(".00"):
      s = s[:-3]
    return s

  def _fmt_price(x) -> str:
    try:
      v = float(x)
    except Exception:
      return str(x)
    s = f"{v:.4f}".rstrip("0").rstrip(".")
    return s

  def _fmt_score(x) -> str:
    try:
      return str(int(float(x)))
    except Exception:
      return str(x)

  type_line = f"Type:\n{alert_type}\n\n" if alert_type else ""
  wm = user_hash(telegram_id)
  return (
    "🐋 Whale Trade Detected\n\n"
    f"Market:\n{market}\n\n"
    f"{type_line}"
    f"Side:\n{side}\n\n"
    f"Size:\n${_fmt_usd(size)}\n\n"
    f"Price:\n{_fmt_price(price)}\n\n"
    f"Whale Score:\n{_fmt_score(score)}\n\n"
    f"Wallet:\n{wallet}\n\n"
    f"#{wm}"
  )
