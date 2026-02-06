import hashlib

from shared.config import settings


def user_hash(telegram_id: str) -> str:
  h = hashlib.sha1((settings.bot_user_hash_secret + ":" + telegram_id).encode("utf-8")).hexdigest()
  return h[:6]


def format_alert(payload: dict, telegram_id: str) -> str:
  market_question = payload.get("market_question") or ""
  market_title = payload.get("market_title") or ""
  market_id = payload.get("market_id") or payload.get("raw_token_id") or ""

  if market_title:
    market = f"<b>{market_title}</b>"
  elif market_question:
    market = f"<b>{market_question}</b>"
  elif market_id:
    market = f"Market (<code>{market_id}</code>)"
  else:
    market = "Unknown"

  alert_type = payload.get("alert_type") or ""
  side = payload.get("side") or "UNKNOWN"
  size = payload.get("size") or payload.get("amount") or ""
  price = payload.get("price") or ""
  score = payload.get("score") or payload.get("whale_score") or ""
  wallet_name = payload.get("wallet_name") or ""
  wallet_address = payload.get("wallet") or payload.get("wallet_address") or ""

  if wallet_name:
    wallet = f"<b>{wallet_name}</b>"
  else:
    wallet = str(wallet_address)
    if wallet.startswith("0x") and len(wallet) > 10:
      wallet = f"<code>{wallet[:6]}...{wallet[-4:]}</code>"
    else:
      wallet = f"<code>{wallet}</code>"

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

  # Emoji and formatting mapping
  side_emoji = "🟢" if side.upper() == "BUY" else "🔴" if side.upper() == "SELL" else "⚪️"
  
  type_label = "Entry" if alert_type == "whale_entry" else "Exit" if alert_type == "whale_exit" else alert_type
  type_line = f"🏷 <b>Type:</b> {type_label}\n" if alert_type else ""

  wm = user_hash(telegram_id)
  
  return (
    "🐋 <b>Whale Trade Detected</b>\n\n"
    f"📊 <b>Market:</b> {market}\n"
    f"{type_line}"
    f"{side_emoji} <b>Side:</b> {side}\n"
    f"💰 <b>Size:</b> ${_fmt_usd(size)}\n"
    f"💵 <b>Price:</b> {_fmt_price(price)}\n"
    f"🎯 <b>Whale Score:</b> {_fmt_score(score)}\n"
    f"👛 <b>Wallet:</b> {wallet}\n\n"
    f"#{wm}"
  )
