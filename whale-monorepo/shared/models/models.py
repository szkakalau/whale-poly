from sqlalchemy import Column, DateTime, Float, ForeignKey, String, Integer, Boolean, Numeric, UniqueConstraint, BigInteger
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class TgUser(Base):
    __tablename__ = "tg_users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    telegram_id = Column(String(64), unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Delivery(Base):
    __tablename__ = "deliveries"
    __table_args__ = (UniqueConstraint("telegram_id", "whale_trade_id", name="uq_deliveries"),)
    id = Column(Integer, primary_key=True, autoincrement=True)
    telegram_id = Column(String(64), index=True)
    whale_trade_id = Column(String(64), index=True)
    delivered_at = Column(DateTime(timezone=True), server_default=func.now())

class Wallet(Base):
    __tablename__ = "wallets"
    id = Column(Integer, primary_key=True, autoincrement=True)
    address = Column(String(128), unique=True, index=True)
    total_volume = Column(Numeric(38, 18), server_default="0")
    total_trades = Column(BigInteger, server_default="0")
    first_seen_at = Column(DateTime(timezone=True))
    last_seen_at = Column(DateTime(timezone=True), index=True)


class WalletName(Base):
    __tablename__ = "wallet_names"
    wallet_address = Column(String(128), primary_key=True, index=True)
    polymarket_username = Column(String(128), nullable=True)
    ens_name = Column(String(256), nullable=True)
    source = Column(String(32), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class WhaleScore(Base):
    __tablename__ = "whale_scores"
    wallet_address = Column(String(128), primary_key=True)
    final_score = Column(BigInteger, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

class WhaleStats(Base):
    __tablename__ = "whale_stats"
    wallet_address = Column(String(128), primary_key=True)
    whale_score = Column(BigInteger, index=True)
    performance_score = Column(Float, server_default="0")
    consistency_score = Column(Float, server_default="0")
    timing_score = Column(Float, server_default="0")
    risk_score = Column(Float, server_default="0")
    impact_score = Column(Float, server_default="0")
    win_rate = Column(Float, server_default="0")
    roi = Column(Float, server_default="0")
    total_pnl = Column(Numeric(38, 18), server_default="0")
    avg_trade_size = Column(Numeric(38, 18), server_default="0")
    max_drawdown = Column(Numeric(38, 18), server_default="0")
    stddev_pnl = Column(Numeric(38, 18), server_default="0")
    avg_entry_percentile = Column(Float, server_default="0.5")
    avg_exit_percentile = Column(Float, server_default="0.5")
    risk_reward_ratio = Column(Float, server_default="0")
    market_liquidity_ratio = Column(Float, server_default="0")
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class WhaleProfile(Base):
    __tablename__ = "whale_profiles"
    wallet_address = Column(String(128), primary_key=True)
    total_volume = Column(Numeric(38, 18), server_default="0")
    total_trades = Column(BigInteger, server_default="0")
    realized_pnl = Column(Numeric(38, 18), server_default="0")
    wins = Column(BigInteger, server_default="0")
    losses = Column(BigInteger, server_default="0")
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

class TradeRaw(Base):
    __tablename__ = "trades_raw"
    trade_id = Column(String(128), primary_key=True)
    market_id = Column(String(512), nullable=False, index=True)
    market_title = Column(String(512), nullable=True)
    outcome = Column(String(128), nullable=True)
    wallet = Column(String(128), nullable=False, index=True)
    side = Column(String(16), nullable=False)
    amount = Column(Numeric(38, 18), nullable=False)
    price = Column(Numeric(38, 18), nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)

class WhaleTradeHistory(Base):
    __tablename__ = "whale_trade_history"
    trade_id = Column(String(128), primary_key=True)
    wallet_address = Column(String(128), nullable=False, index=True)
    market_id = Column(String(512), nullable=False, index=True)
    side = Column(String(16), nullable=False)
    price = Column(Numeric(38, 18), nullable=False)
    size = Column(Numeric(38, 18), nullable=False)
    pnl = Column(Numeric(38, 18), server_default="0")
    trade_usd = Column(Numeric(38, 18), server_default="0")
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)

class WhaleTrade(Base):
    __tablename__ = "whale_trades"
    __table_args__ = (UniqueConstraint("trade_id", name="uq_whale_trades_trade_id"),)
    id = Column(String(64), primary_key=True)
    trade_id = Column(String(128), nullable=False, index=True)
    wallet_address = Column(String(128), nullable=False, index=True)
    whale_score = Column(BigInteger, nullable=False, index=True)
    market_id = Column(String(512), nullable=False, index=True)
    action_type = Column(String(16), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class WhalePosition(Base):
    __tablename__ = "whale_positions"
    wallet_address = Column(String(128), primary_key=True)
    market_id = Column(String(512), primary_key=True)
    net_size = Column(Numeric(38, 18), server_default="0")
    avg_price = Column(Numeric(38, 18), server_default="0")
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (UniqueConstraint("whale_trade_id", name="uq_alerts_whale_trade_id"),)
    id = Column(String(64), primary_key=True)
    whale_trade_id = Column(String(64), nullable=False, index=True)
    market_id = Column(String(512), nullable=False, index=True)
    wallet_address = Column(String(128), nullable=False, index=True)
    whale_score = Column(BigInteger, nullable=False, index=True)
    alert_type = Column(String(32), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Market(Base):
    __tablename__ = "markets"
    id = Column(String(512), primary_key=True)
    title = Column(String(512), nullable=False)
    status = Column(String(32), nullable=True, default="active", server_default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TokenCondition(Base):
    __tablename__ = "token_conditions"
    token_id = Column(String, primary_key=True, index=True)
    condition_id = Column(String, nullable=False, index=True)
    market_id = Column(String, nullable=False, index=True)
    question = Column(String, nullable=False)

class MarketAlertState(Base):
    __tablename__ = "market_alert_state"
    market_id = Column(String, primary_key=True, index=True)
    last_alert_at = Column(DateTime(timezone=True), index=True)

class ActivationCode(Base):
    __tablename__ = "activation_codes"
    code = Column(String(16), primary_key=True)
    telegram_id = Column(String(64), nullable=False, index=True)
    used = Column(Boolean, default=False, server_default="false", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Plan(Base):
    __tablename__ = "plans"
    id = Column(String(64), primary_key=True)
    name = Column(String(16), nullable=False, unique=True, index=True)
    price_usd = Column(Integer, nullable=False)
    stripe_price_id = Column(String(128), nullable=False, unique=True)

class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(String(64), primary_key=True)
    telegram_id = Column(String(64), nullable=False, index=True)
    stripe_customer_id = Column(String(128), nullable=False, index=True)
    stripe_subscription_id = Column(String(128), nullable=False, unique=True, index=True)
    status = Column(String(16), nullable=False, index=True)
    plan = Column(String(16), nullable=False, server_default="free", index=True)
    current_period_end = Column(DateTime(timezone=True), nullable=False, index=True)

class StripeEvent(Base):
    __tablename__ = "stripe_events"
    id = Column(String(128), primary_key=True)
    event_type = Column(String(128), nullable=False, index=True)
    processed_at = Column(DateTime(timezone=True), server_default=func.now())

class User(Base):
    __tablename__ = "users"
    id = Column(String(64), primary_key=True)
    email = Column(String(256), nullable=False, unique=True, index=True)
    telegram_id = Column(String(64), nullable=True, unique=True, index=True)
    plan = Column(String(16), nullable=False, server_default="free", index=True)
    plan_expire_at = Column(DateTime(timezone=True), nullable=True)


class WhaleFollow(Base):
    __tablename__ = "whale_follows"
    __table_args__ = (UniqueConstraint("user_id", "wallet", name="user_wallet_unique"),)
    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), nullable=False, index=True)
    wallet = Column(String(128), nullable=False, index=True)
    alert_entry = Column(Boolean, nullable=False, server_default="true")
    alert_exit = Column(Boolean, nullable=False, server_default="true")
    alert_add = Column(Boolean, nullable=False, server_default="true")
    min_size = Column(Float, nullable=False, server_default="0")
    min_score = Column(Float, nullable=False, server_default="0")
    enabled = Column(Boolean, nullable=False, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class Collection(Base):
    __tablename__ = "collections"
    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), nullable=False, index=True)
    name = Column(String(256), nullable=False)
    description = Column(String(512), nullable=True)
    enabled = Column(Boolean, nullable=False, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

class CollectionWhale(Base):
    __tablename__ = "collection_whales"
    __table_args__ = (UniqueConstraint("collection_id", "wallet", name="collection_wallet_unique"),)
    id = Column(String(64), primary_key=True)
    collection_id = Column(String(64), nullable=False, index=True)
    wallet = Column(String(128), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class SmartCollection(Base):
    __tablename__ = "smart_collections"
    id = Column(String(64), primary_key=True)
    name = Column(String(256), nullable=False)
    description = Column(String(512), nullable=True)
    rule_json = Column(String, nullable=False)
    enabled = Column(Boolean, nullable=False, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class SmartCollectionWhale(Base):
    __tablename__ = "smart_collection_whales"
    __table_args__ = (UniqueConstraint("smart_collection_id", "wallet", "snapshot_date", name="smart_collection_wallet_unique"),)
    id = Column(String(64), primary_key=True)
    smart_collection_id = Column(String(64), nullable=False, index=True)
    wallet = Column(String(128), nullable=False, index=True)
    snapshot_date = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class SmartCollectionSubscription(Base):
    __tablename__ = "smart_collection_subscriptions"
    __table_args__ = (UniqueConstraint("user_id", "smart_collection_id", name="user_smart_collection_unique"),)
    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), nullable=False, index=True)
    smart_collection_id = Column(String(64), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


# 量价分析模型
class MarketVwMetrics(Base):
    __tablename__ = "market_vw_metrics"
    market_id = Column(String(512), ForeignKey("markets.id"), primary_key=True)
    total_volume_usd = Column(Numeric(38, 2), server_default="0")
    yes_volume_usd = Column(Numeric(38, 2), server_default="0")
    no_volume_usd = Column(Numeric(38, 2), server_default="0")
    yes_vw_price = Column(Numeric(10, 8), nullable=True)
    no_vw_price = Column(Numeric(10, 8), nullable=True)
    yes_market_price = Column(Numeric(10, 8), nullable=True)
    no_market_price = Column(Numeric(10, 8), nullable=True)
    vw_divergence = Column(Numeric(10, 8), nullable=True)
    uai = Column(Numeric(10, 8), nullable=True)
    vw_velocity_5m = Column(Numeric(10, 8), nullable=True)
    vw_velocity_15m = Column(Numeric(10, 8), nullable=True)
    vw_velocity_1h = Column(Numeric(10, 8), nullable=True)
    signal_direction = Column(String(16), nullable=True)  # bullish|bearish|neutral
    signal_strength = Column(Integer, nullable=True)
    status = Column(String(16), server_default="active")  # active|dormant
    computed_at = Column(DateTime(timezone=True), nullable=True)


class MarketVwSnapshot(Base):
    __tablename__ = "market_vw_snapshots"
    id = Column(Integer, primary_key=True, autoincrement=True)
    market_id = Column(String(512), ForeignKey("markets.id"), nullable=False, index=True)
    vw_divergence = Column(Numeric(10, 8), nullable=True)
    uai = Column(Numeric(10, 8), nullable=True)
    yes_vw_price = Column(Numeric(10, 8), nullable=True)
    no_vw_price = Column(Numeric(10, 8), nullable=True)
    yes_market_price = Column(Numeric(10, 8), nullable=True)
    total_volume_usd = Column(Numeric(38, 2), server_default="0")
    snapshot_at = Column(DateTime(timezone=True), nullable=False, index=True)


class BlogPost(Base):
    __tablename__ = "blog_posts"
    __table_args__ = (UniqueConstraint("slug", "language", name="uq_blog_post_slug_lang"),)
    id = Column(String(64), primary_key=True)
    slug = Column(String(256), nullable=False)
    title = Column(String(512), nullable=False)
    excerpt = Column(String(1024), nullable=False)
    content = Column(String, nullable=False)
    author = Column(String(128), nullable=False)
    read_time = Column(String(16), nullable=False)
    cover_image = Column(String(1024), nullable=True)
    tags = Column(String, nullable=True)  # PostgreSQL text[] — stored as JSON string in SQLite
    published_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
    language = Column(String(8), nullable=False, server_default="en")
    group_slug = Column(String(256), nullable=True)
    status = Column(String(32), nullable=False, server_default="published")
