from sqlalchemy import Column, DateTime, Float, String, Integer, Boolean, Numeric, UniqueConstraint, BigInteger
from sqlalchemy.ext.declarative import declarative_base
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
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    address = Column(String(128), unique=True, index=True)
    total_volume = Column(Numeric(38, 18), server_default="0")
    total_trades = Column(BigInteger, server_default="0")
    first_seen_at = Column(DateTime(timezone=True))
    last_seen_at = Column(DateTime(timezone=True), index=True)

class WhaleScore(Base):
    __tablename__ = "whale_scores"
    wallet_address = Column(String(128), primary_key=True)
    final_score = Column(BigInteger, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

class TradeRaw(Base):
    __tablename__ = "trades_raw"
    trade_id = Column(String(128), primary_key=True)
    market_id = Column(String(512), nullable=False, index=True)
    wallet = Column(String(128), nullable=False, index=True)
    side = Column(String(16), nullable=False)
    amount = Column(Numeric(38, 18), nullable=False)
    price = Column(Numeric(38, 18), nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)

class WhaleTrade(Base):
    __tablename__ = "whale_trades"
    id = Column(String(64), primary_key=True)
    trade_id = Column(String(128), nullable=False, index=True)
    wallet_address = Column(String(128), nullable=False, index=True)
    whale_score = Column(BigInteger, nullable=False, index=True)
    market_id = Column(String(512), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Alert(Base):
    __tablename__ = "alerts"
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
    current_period_end = Column(DateTime(timezone=True), nullable=False, index=True)

class StripeEvent(Base):
    __tablename__ = "stripe_events"
    id = Column(String(128), primary_key=True)
    event_type = Column(String(128), nullable=False, index=True)
    processed_at = Column(DateTime(timezone=True), server_default=func.now())
