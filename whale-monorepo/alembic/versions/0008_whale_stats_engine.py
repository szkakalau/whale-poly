from alembic import op
import sqlalchemy as sa


revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.create_table(
    "whale_trade_history",
    sa.Column("trade_id", sa.String(length=128), primary_key=True),
    sa.Column("wallet_address", sa.String(length=128), nullable=False),
    sa.Column("market_id", sa.String(length=512), nullable=False),
    sa.Column("side", sa.String(length=16), nullable=False),
    sa.Column("price", sa.Numeric(38, 18), nullable=False),
    sa.Column("size", sa.Numeric(38, 18), nullable=False),
    sa.Column("pnl", sa.Numeric(38, 18), server_default=sa.text("0"), nullable=False),
    sa.Column("trade_usd", sa.Numeric(38, 18), server_default=sa.text("0"), nullable=False),
    sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
  )
  op.create_index("ix_whale_trade_history_wallet_address", "whale_trade_history", ["wallet_address"])
  op.create_index("ix_whale_trade_history_market_id", "whale_trade_history", ["market_id"])
  op.create_index("ix_whale_trade_history_timestamp", "whale_trade_history", ["timestamp"])

  op.create_table(
    "whale_stats",
    sa.Column("wallet_address", sa.String(length=128), primary_key=True),
    sa.Column("whale_score", sa.BigInteger(), server_default=sa.text("0"), nullable=False),
    sa.Column("performance_score", sa.Float(), server_default=sa.text("0"), nullable=False),
    sa.Column("consistency_score", sa.Float(), server_default=sa.text("0"), nullable=False),
    sa.Column("timing_score", sa.Float(), server_default=sa.text("0"), nullable=False),
    sa.Column("risk_score", sa.Float(), server_default=sa.text("0"), nullable=False),
    sa.Column("impact_score", sa.Float(), server_default=sa.text("0"), nullable=False),
    sa.Column("win_rate", sa.Float(), server_default=sa.text("0"), nullable=False),
    sa.Column("roi", sa.Float(), server_default=sa.text("0"), nullable=False),
    sa.Column("total_pnl", sa.Numeric(38, 18), server_default=sa.text("0"), nullable=False),
    sa.Column("avg_trade_size", sa.Numeric(38, 18), server_default=sa.text("0"), nullable=False),
    sa.Column("max_drawdown", sa.Numeric(38, 18), server_default=sa.text("0"), nullable=False),
    sa.Column("stddev_pnl", sa.Numeric(38, 18), server_default=sa.text("0"), nullable=False),
    sa.Column("avg_entry_percentile", sa.Float(), server_default=sa.text("0.5"), nullable=False),
    sa.Column("avg_exit_percentile", sa.Float(), server_default=sa.text("0.5"), nullable=False),
    sa.Column("risk_reward_ratio", sa.Float(), server_default=sa.text("0"), nullable=False),
    sa.Column("market_liquidity_ratio", sa.Float(), server_default=sa.text("0"), nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
  )
  op.create_index("ix_whale_stats_whale_score", "whale_stats", ["whale_score"])


def downgrade() -> None:
  op.drop_index("ix_whale_stats_whale_score", table_name="whale_stats")
  op.drop_table("whale_stats")
  op.drop_index("ix_whale_trade_history_timestamp", table_name="whale_trade_history")
  op.drop_index("ix_whale_trade_history_market_id", table_name="whale_trade_history")
  op.drop_index("ix_whale_trade_history_wallet_address", table_name="whale_trade_history")
  op.drop_table("whale_trade_history")
