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
  with op.batch_alter_table("markets") as batch_op:
    batch_op.alter_column("id", type_=sa.String(512), existing_nullable=False)
  # trades_raw
  with op.batch_alter_table("trades_raw") as batch_op:
    batch_op.alter_column("market_id", type_=sa.String(512), existing_nullable=False)
  # whale_trades
  with op.batch_alter_table("whale_trades") as batch_op:
    batch_op.alter_column("market_id", type_=sa.String(512), existing_nullable=False)
  # alerts
  with op.batch_alter_table("alerts") as batch_op:
    batch_op.alter_column("market_id", type_=sa.String(512), existing_nullable=False)
  # market_alert_state
  with op.batch_alter_table("market_alert_state") as batch_op:
    batch_op.alter_column("market_id", type_=sa.String(512), existing_nullable=False)


def downgrade() -> None:
  with op.batch_alter_table("markets") as batch_op:
    batch_op.alter_column("id", type_=sa.String(128), existing_nullable=False)
  with op.batch_alter_table("trades_raw") as batch_op:
    batch_op.alter_column("market_id", type_=sa.String(128), existing_nullable=False)
  with op.batch_alter_table("whale_trades") as batch_op:
    batch_op.alter_column("market_id", type_=sa.String(128), existing_nullable=False)
  with op.batch_alter_table("alerts") as batch_op:
    batch_op.alter_column("market_id", type_=sa.String(128), existing_nullable=False)
  with op.batch_alter_table("market_alert_state") as batch_op:
    batch_op.alter_column("market_id", type_=sa.String(128), existing_nullable=False)