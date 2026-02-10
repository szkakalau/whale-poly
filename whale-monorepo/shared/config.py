import os
from pathlib import Path
from typing import Any

try:
  import yaml
except Exception:
  yaml = None

from dotenv import load_dotenv


load_dotenv()


class Settings:
  def __init__(self) -> None:
    self.database_url = self._normalize_db_url(self._get("DATABASE_URL"))
    self.redis_url = self._get("REDIS_URL")
    self.log_level = os.getenv("LOG_LEVEL", "INFO").upper()

    self.trade_created_queue = os.getenv("TRADE_CREATED_QUEUE", "trade_created")
    self.whale_trade_created_queue = os.getenv("WHALE_TRADE_CREATED_QUEUE", "whale_trade_created")
    self.alert_created_queue = os.getenv("ALERT_CREATED_QUEUE", "alert_created")

    self.alert_cooldown_seconds = int(os.getenv("ALERT_COOLDOWN_SECONDS", "600"))
    self.alert_min_score = int(os.getenv("ALERT_MIN_SCORE", "75"))
    self.alert_min_trade_usd = float(os.getenv("ALERT_MIN_TRADE_USD", "3000"))
    self.alert_always_score = int(os.getenv("ALERT_ALWAYS_SCORE", "90"))

    self.stripe_secret_key = os.getenv("STRIPE_SECRET_KEY", "")
    self.stripe_webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    self.landing_success_url = os.getenv("LANDING_SUCCESS_URL", "")
    self.landing_cancel_url = os.getenv("LANDING_CANCEL_URL", "")
    self.default_currency = os.getenv("DEFAULT_CURRENCY", "usd")
    self.payment_mode = os.getenv("PAYMENT_MODE", "stripe").lower()

    self.telegram_bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    self.bot_user_hash_secret = os.getenv("BOT_USER_HASH_SECRET", "")
    self.alert_fanout_rate_limit_per_minute = int(os.getenv("ALERT_FANOUT_RATE_LIMIT_PER_MINUTE", "50"))
    self.telegram_alert_chat_id = os.getenv("TELEGRAM_ALERT_CHAT_ID") or os.getenv("TELEGRAM_HEALTH_CHAT_ID", "")
    self.admin_token = os.getenv("ADMIN_TOKEN", "")

    self.polymarket_trades_url = os.getenv("POLYMARKET_TRADES_URL") or os.getenv("POLYMARKET_DATA_API_TRADES_URL") or "https://data-api.polymarket.com/trades?limit=100"
    self.polymarket_trades_url_fallback = (
      os.getenv("POLYMARKET_TRADES_URL_FALLBACK") or os.getenv("POLYMARKET_DATA_API_TRADES_URL_FALLBACK") or "https://clob.polymarket.com/trades"
    )
    self.polymarket_markets_url = os.getenv("POLYMARKET_MARKETS_URL") or os.getenv("POLYMARKET_DATA_API_MARKETS_URL") or ""
    self.polymarket_events_url = os.getenv("POLYMARKET_EVENTS_URL") or "https://gamma-api.polymarket.com/events"
    self.https_proxy = os.getenv("HTTPS_PROXY", "")

    self.whale_single_trade_usd_threshold = float(os.getenv("WHALE_SINGLE_TRADE_USD_THRESHOLD", "3000"))
    self.whale_build_usd_threshold = float(os.getenv("WHALE_BUILD_USD_THRESHOLD", "10000"))
    self.whale_exit_usd_threshold = float(os.getenv("WHALE_EXIT_USD_THRESHOLD", "5000"))

    self.telegram_health_bot_token = os.getenv("TELEGRAM_HEALTH_BOT_TOKEN", "8443902552:AAFcI90mdlQ0UOdtzlvAmb7i16ohaBV8fxA")
    self.telegram_health_chat_id = os.getenv("TELEGRAM_HEALTH_CHAT_ID", "879397306")
    self.telegram_health_username = os.getenv("TELEGRAM_HEALTH_USERNAME", "@sightwhale_HealthBot")
    self.health_trade_ingest_api_url = os.getenv("HEALTH_TRADE_INGEST_API_URL", "https://trade-ingest-api.onrender.com")
    self.health_whale_engine_api_url = os.getenv("HEALTH_WHALE_ENGINE_API_URL", "https://whale-engine-api.onrender.com")
    self.health_alert_engine_api_url = os.getenv("HEALTH_ALERT_ENGINE_API_URL", "https://alert-engine-api.onrender.com")
    self.health_payment_api_url = os.getenv("HEALTH_PAYMENT_API_URL", "https://payment-api.onrender.com")
    self.health_telegram_bot_api_url = os.getenv("HEALTH_TELEGRAM_BOT_API_URL", "https://telegram-bot.onrender.com")

    # Plan Gating Limits
    self.plan_limits = {
        "free": {
            "smart_collections": 0,
            "follows": 0,
            "collections": 0
        },
        "pro": {
            "smart_collections": 5,
            "follows": 100,
            "collections": 10
        },
        "elite": {
            "smart_collections": 20,
            "follows": 1000,
            "collections": 50
        }
    }

  def _get(self, key: str) -> str:
    value = os.getenv(key)
    if not value:
      raise RuntimeError(f"{key} is required")
    return value

  def _normalize_db_url(self, url: str) -> str:
    u = url.strip()
    if u.startswith("postgres://"):
      u = "postgresql+asyncpg://" + u[len("postgres://") :]
    if u.startswith("postgresql://"):
      u = "postgresql+asyncpg://" + u[len("postgresql://") :]
    if u.startswith("sqlite:///"):
      u = "sqlite+aiosqlite:///" + u[len("sqlite:///") :]
    return u


_ALERT_CONFIG_CACHE: dict[str, Any] | None = None
_ALERT_CONFIG_MTIME: float | None = None


def _alert_config_defaults() -> dict[str, Any]:
  return {
    "user_plans": {
      "free": {
        "alerts_delay": "10m",
        "max_alerts_per_day": 3,
        "low_confidence_whales": True,
        "max_follow_whales": 0,
      },
      "pro": {
        "alerts_delay": "0m",
        "max_alerts_per_day": "unlimited",
        "low_confidence_whales": True,
        "max_follow_whales": 20,
        "smart_collections": "partial",
      },
      "elite": {
        "alerts_delay": "0m",
        "max_alerts_per_day": "unlimited",
        "low_confidence_whales": True,
        "max_follow_whales": 100,
        "smart_collections": "full",
        "high_confidence_first": True,
      },
    },
    "alert_thresholds": {
      "micro_window": "20m",
      "macro_window": "2h",
      "confidence_scores": {
        "low_confidence": 70,
        "medium_confidence": 80,
        "high_confidence": 85,
      },
      "usd_thresholds": {
        "low": 2500,
        "medium": 3000,
        "high": 5000,
      },
      "spike_build_exit_thresholds": {
        "whale_entry": 5000,
        "whale_exit": 5000,
        "whale_build": 5000,
      },
    },
    "cooldown_settings": {
      "same_wallet_same_market": "600s",
      "same_market_different_wallet": "60s",
      "increased_position": "300s",
    },
    "behavior_detection": {
      "spike_threshold": 5000,
      "build_threshold": 10000,
      "exit_threshold": 10000,
    },
  }


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
  merged = dict(base)
  for key, value in override.items():
    if isinstance(value, dict) and isinstance(merged.get(key), dict):
      merged[key] = _deep_merge(merged[key], value)
    else:
      merged[key] = value
  return merged


def parse_duration(value: object, default_seconds: int) -> int:
  if value is None:
    return int(default_seconds)
  if isinstance(value, (int, float)):
    return int(value)
  text = str(value).strip().lower()
  if text.endswith("ms"):
    return max(0, int(float(text[:-2]) / 1000))
  if text.endswith("s"):
    return max(0, int(float(text[:-1])))
  if text.endswith("m"):
    return max(0, int(float(text[:-1]) * 60))
  if text.endswith("h"):
    return max(0, int(float(text[:-1]) * 3600))
  try:
    return int(float(text))
  except Exception:
    return int(default_seconds)


def get_alert_config() -> dict[str, Any]:
  global _ALERT_CONFIG_CACHE, _ALERT_CONFIG_MTIME
  base = _alert_config_defaults()
  config_path = os.getenv("ALERT_CONFIG_PATH", "alert_engine_config.yaml")
  path = Path(config_path)
  if not path.is_absolute():
    path = Path(os.getcwd()) / path
  mtime = path.stat().st_mtime if path.exists() else None
  if _ALERT_CONFIG_CACHE is not None and mtime == _ALERT_CONFIG_MTIME:
    return _ALERT_CONFIG_CACHE
  data = base
  if path.exists() and yaml is not None:
    try:
      with path.open("r", encoding="utf-8") as f:
        loaded = yaml.safe_load(f) or {}
      if isinstance(loaded, dict):
        data = _deep_merge(base, loaded)
    except Exception:
      data = base
  _ALERT_CONFIG_CACHE = data
  _ALERT_CONFIG_MTIME = mtime
  return data


settings = Settings()
