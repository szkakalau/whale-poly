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
    market = market_title
  elif market_question:
    market = market_question
  elif market_id:
    market = f"Market ({market_id})"
  else:
    market = "Unknown"

  alert_type = payload.get("alert_type") or ""
  side = (payload.get("side") or "UNKNOWN").upper()
  size = payload.get("size") or payload.get("amount") or 0
  price = payload.get("price") or 0
  score = payload.get("score") or payload.get("whale_score") or 0
  wallet_name = payload.get("wallet_name") or ""
  wallet_address = payload.get("wallet") or payload.get("wallet_address") or ""

  if wallet_name:
    wallet_display = wallet_name
  else:
    w_str = str(wallet_address)
    if w_str.startswith("0x") and len(w_str) > 10:
      wallet_display = f"{w_str[:6]}...{w_str[-4:]}"
    else:
      wallet_display = w_str

  def _fmt_usd(x) -> str:
    try:
      v = float(x)
      s = f"{v:,.2f}"
      if s.endswith(".00"): s = s[:-3]
      return s
    except:
      return str(x)

  def _fmt_price(x) -> str:
    try:
      v = float(x)
      return f"{v:.4f}".rstrip("0").rstrip(".")
    except:
      return str(x)

  side_emoji = "🟢" if side == "BUY" else "🔴" if side == "SELL" else "⚪️"
  type_label = "Entry" if alert_type == "whale_entry" else "Exit" if alert_type == "whale_exit" else alert_type.capitalize()
  
  wm = user_hash(telegram_id)
  
  return (
    "🐋 <b>Whale Trade Detected</b>\n\n"
    f"📊 <b>Market:</b>\n{market}\n\n"
    f"🏷 <b>Type:</b> {type_label}\n"
    f"{side_emoji} <b>Side:</b> <b>{side}</b>\n"
    f"💰 <b>Size:</b> <b>${_fmt_usd(size)}</b>\n"
    f"💵 <b>Price:</b> <code>{_fmt_price(price)}</code>\n"
    f"🎯 <b>Whale Score:</b> <code>{int(float(score))}</code>\n"
    f"👛 <b>Wallet:</b> <code>{wallet_display}</code>\n\n"
    f"<code>#{wm}</code>"
  )
