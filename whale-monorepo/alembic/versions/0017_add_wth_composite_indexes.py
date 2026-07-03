"""Add composite indexes on whale_trade_history for common query patterns (PF-M15).

The most frequent queries on whale_trade_history are:
1. "All trades for a wallet, ordered by timestamp" — for whale profile pages and PnL analysis
2. "Trades for a wallet + market combination" — for market-specific whale activity

Individual indexes (wallet_address, market_id, timestamp) force the planner to bitmap-merge
or sort in memory. Composite indexes return rows pre-sorted and can satisfy the full query.
"""

from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        "ix_wth_wallet_timestamp",
        "whale_trade_history",
        ["wallet_address", "timestamp"],
        if_not_exists=True,
    )
    op.create_index(
        "ix_wth_wallet_market_timestamp",
        "whale_trade_history",
        ["wallet_address", "market_id", "timestamp"],
        if_not_exists=True,
    )


def downgrade():
    op.drop_index("ix_wth_wallet_market_timestamp", table_name="whale_trade_history", if_exists=True)
    op.drop_index("ix_wth_wallet_timestamp", table_name="whale_trade_history", if_exists=True)
