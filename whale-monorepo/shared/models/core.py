from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from shared.models.base import Base


class TradeRaw(Base):
  __tablename__ = "trades_raw"

  trade_id: Mapped[str] = mapped_column(String(128), primary_key=True)
  market_id: Mapped[str] = mapped_column(String(128), index=True)
  wallet: Mapped[str] = mapped_column(String(128), index=True)
  side: Mapped[str] = mapped_column(String(16))
  amount: Mapped[float] = mapped_column(Numeric(38, 18))
  price: Mapped[float] = mapped_column(Numeric(38, 18))
  timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class Market(Base):
  __tablename__ = "markets"

  id: Mapped[str] = mapped_column(String(128), primary_key=True)
  title: Mapped[str] = mapped_column(String(512))
  status: Mapped[str | None] = mapped_column(String(32), nullable=True)
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Wallet(Base):
  __tablename__ = "wallets"

  id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
  address: Mapped[str] = mapped_column(String(128), unique=True, index=True)
  total_volume: Mapped[float] = mapped_column(Numeric(38, 18), server_default="0")
  total_trades: Mapped[int] = mapped_column(BigInteger, server_default="0")
  first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
  last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class WhaleScore(Base):
  __tablename__ = "whale_scores"

  wallet_address: Mapped[str] = mapped_column(String(128), primary_key=True)
  final_score: Mapped[int] = mapped_column(BigInteger, index=True)
  updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WhaleTrade(Base):
  __tablename__ = "whale_trades"

  id: Mapped[str] = mapped_column(String(64), primary_key=True)
  trade_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
  wallet_address: Mapped[str] = mapped_column(String(128), index=True)
  whale_score: Mapped[int] = mapped_column(BigInteger, index=True)
  market_id: Mapped[str] = mapped_column(String(128), index=True)
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class MarketAlertState(Base):
  __tablename__ = "market_alert_state"

  market_id: Mapped[str] = mapped_column(String(128), primary_key=True)
  last_alert_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class Alert(Base):
  __tablename__ = "alerts"
  __table_args__ = (UniqueConstraint("whale_trade_id", name="uq_alerts_whale_trade_id"),)

  id: Mapped[str] = mapped_column(String(64), primary_key=True)
  whale_trade_id: Mapped[str] = mapped_column(String(64), index=True)
  market_id: Mapped[str] = mapped_column(String(128), index=True)
  wallet_address: Mapped[str] = mapped_column(String(128), index=True)
  whale_score: Mapped[int] = mapped_column(BigInteger)
  alert_type: Mapped[str] = mapped_column(String(32), index=True)
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
