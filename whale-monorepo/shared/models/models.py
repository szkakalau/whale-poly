from sqlalchemy import Column, DateTime, Float, String, Integer, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class WhaleTrade(Base):
    __tablename__ = "whale_trades"
    id = Column(String, primary_key=True, index=True)
    market_id = Column(String, nullable=False, index=True)
    wallet = Column(String, nullable=False)
    side = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    whale_score = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(String, primary_key=True, index=True)
    whale_trade_id = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, default="pending", server_default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    sent_at = Column(DateTime(timezone=True))

class Market(Base):
    __tablename__ = "markets"
    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    status = Column(String, nullable=False, default="active", server_default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

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
