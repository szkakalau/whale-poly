from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.create_index("ix_trades_raw_wallet_market_timestamp", "trades_raw", ["wallet", "market_id", "timestamp"])
  op.create_index("ix_whale_trades_wallet_market", "whale_trades", ["wallet_address", "market_id"])
  op.create_index("ix_alerts_wallet_created_at", "alerts", ["wallet_address", "created_at"])


def downgrade() -> None:
  op.drop_index("ix_alerts_wallet_created_at", table_name="alerts")
  op.drop_index("ix_whale_trades_wallet_market", table_name="whale_trades")
  op.drop_index("ix_trades_raw_wallet_market_timestamp", table_name="trades_raw")
