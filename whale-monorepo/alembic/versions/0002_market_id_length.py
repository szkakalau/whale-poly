"""expand market id length

Revision ID: 0002
Revises: 0001
Create Date: 2026-01-29 08:10:00
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
  # markets
  op.alter_column("markets", "id", type_=sa.String(512), existing_nullable=False)
  # trades_raw
  op.alter_column("trades_raw", "market_id", type_=sa.String(512), existing_nullable=False)
  # whale_trades
  op.alter_column("whale_trades", "market_id", type_=sa.String(512), existing_nullable=False)
  # alerts
  op.alter_column("alerts", "market_id", type_=sa.String(512), existing_nullable=False)
  # market_alert_state
  op.alter_column("market_alert_state", "market_id", type_=sa.String(512), existing_nullable=False)


def downgrade() -> None:
  op.alter_column("markets", "id", type_=sa.String(128), existing_nullable=False)
  op.alter_column("trades_raw", "market_id", type_=sa.String(128), existing_nullable=False)
  op.alter_column("whale_trades", "market_id", type_=sa.String(128), existing_nullable=False)
  op.alter_column("alerts", "market_id", type_=sa.String(128), existing_nullable=False)
  op.alter_column("market_alert_state", "market_id", type_=sa.String(128), existing_nullable=False)