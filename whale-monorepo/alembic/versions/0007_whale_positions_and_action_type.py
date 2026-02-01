from alembic import op
import sqlalchemy as sa


revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.add_column("whale_trades", sa.Column("action_type", sa.String(length=16), nullable=True))
  op.create_index("ix_whale_trades_action_type", "whale_trades", ["action_type"])

  op.create_table(
    "whale_positions",
    sa.Column("wallet_address", sa.String(length=128), primary_key=True),
    sa.Column("market_id", sa.String(length=512), primary_key=True),
    sa.Column("net_size", sa.Numeric(38, 18), server_default=sa.text("0"), nullable=False),
    sa.Column("avg_price", sa.Numeric(38, 18), server_default=sa.text("0"), nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
  )


def downgrade() -> None:
  op.drop_table("whale_positions")
  op.drop_index("ix_whale_trades_action_type", table_name="whale_trades")
  op.drop_column("whale_trades", "action_type")

