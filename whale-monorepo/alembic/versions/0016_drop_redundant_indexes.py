"""Drop redundant single-column indexes covered by composite indexes (PF-M14).

Composite indexes from 0011 (ix_trades_raw_wallet_market_timestamp, ix_whale_trades_wallet_market)
already cover the query patterns that these single-column indexes were built for.
Keeping both wastes disk space and adds write overhead.
"""

from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade():
    # trades_raw: wallet and market_id are covered by ix_trades_raw_wallet_market_timestamp
    op.drop_index("ix_trades_raw_wallet", table_name="trades_raw", if_exists=True)
    op.drop_index("ix_trades_raw_market_id", table_name="trades_raw", if_exists=True)

    # whale_trades: wallet_address and market_id are covered by ix_whale_trades_wallet_market
    op.drop_index("ix_whale_trades_wallet_address", table_name="whale_trades", if_exists=True)
    op.drop_index("ix_whale_trades_market_id", table_name="whale_trades", if_exists=True)


def downgrade():
    import sqlalchemy as sa

    op.create_index("ix_trades_raw_wallet", "trades_raw", ["wallet"], if_not_exists=True)
    op.create_index("ix_trades_raw_market_id", "trades_raw", ["market_id"], if_not_exists=True)
    op.create_index("ix_whale_trades_wallet_address", "whale_trades", ["wallet_address"], if_not_exists=True)
    op.create_index("ix_whale_trades_market_id", "whale_trades", ["market_id"], if_not_exists=True)
