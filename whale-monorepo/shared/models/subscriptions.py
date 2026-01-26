from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from shared.models.base import Base


class TgUser(Base):
  __tablename__ = "tg_users"

  id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
  telegram_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ActivationCode(Base):
  __tablename__ = "activation_codes"

  code: Mapped[str] = mapped_column(String(16), primary_key=True)
  telegram_id: Mapped[str] = mapped_column(String(64), index=True)
  used: Mapped[bool] = mapped_column(Boolean, server_default="false")
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Delivery(Base):
  __tablename__ = "deliveries"
  __table_args__ = (UniqueConstraint("telegram_id", "whale_trade_id", name="uq_deliveries"),)

  id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
  telegram_id: Mapped[str] = mapped_column(String(64), index=True)
  whale_trade_id: Mapped[str] = mapped_column(String(64), index=True)
  delivered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Plan(Base):
  __tablename__ = "plans"

  id: Mapped[str] = mapped_column(String(64), primary_key=True)
  name: Mapped[str] = mapped_column(String(16), unique=True, index=True)
  price_usd: Mapped[int] = mapped_column(Integer)
  stripe_price_id: Mapped[str] = mapped_column(String(128), unique=True)


class Subscription(Base):
  __tablename__ = "subscriptions"

  id: Mapped[str] = mapped_column(String(64), primary_key=True)
  telegram_id: Mapped[str] = mapped_column(String(64), index=True)
  stripe_customer_id: Mapped[str] = mapped_column(String(128), index=True)
  stripe_subscription_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
  status: Mapped[str] = mapped_column(String(16), index=True)
  current_period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class StripeEvent(Base):
  __tablename__ = "stripe_events"

  id: Mapped[str] = mapped_column(String(128), primary_key=True)
  event_type: Mapped[str] = mapped_column(String(128), index=True)
  processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
