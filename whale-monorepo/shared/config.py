import os

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
    self.alert_min_trade_usd = float(os.getenv("ALERT_MIN_TRADE_USD", "1000"))
    self.alert_always_score = int(os.getenv("ALERT_ALWAYS_SCORE", "85"))

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

    self.whale_single_trade_usd_threshold = float(os.getenv("WHALE_SINGLE_TRADE_USD_THRESHOLD", "2000"))
    self.whale_build_usd_threshold = float(os.getenv("WHALE_BUILD_USD_THRESHOLD", "5000"))
    self.whale_exit_usd_threshold = float(os.getenv("WHALE_EXIT_USD_THRESHOLD", "3000"))

    self.telegram_health_bot_token = os.getenv("TELEGRAM_HEALTH_BOT_TOKEN", "8443902552:AAFcI90mdlQ0UOdtzlvAmb7i16ohaBV8fxA")
    self.telegram_health_chat_id = os.getenv("TELEGRAM_HEALTH_CHAT_ID", "879397306")
    self.telegram_health_username = os.getenv("TELEGRAM_HEALTH_USERNAME", "@sightwhale_HealthBot")
    self.health_trade_ingest_api_url = os.getenv("HEALTH_TRADE_INGEST_API_URL", "https://trade-ingest-api.onrender.com")
    self.health_whale_engine_api_url = os.getenv("HEALTH_WHALE_ENGINE_API_URL", "https://whale-engine-api.onrender.com")
    self.health_alert_engine_api_url = os.getenv("HEALTH_ALERT_ENGINE_API_URL", "https://alert-engine-api.onrender.com")
    self.health_payment_api_url = os.getenv("HEALTH_PAYMENT_API_URL", "https://payment-api.onrender.com")

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
    return u


settings = Settings()
