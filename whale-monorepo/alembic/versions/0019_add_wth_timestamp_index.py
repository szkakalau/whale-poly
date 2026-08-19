"""Add a plain timestamp index on whale_trade_history (PF-M16).

The 30-day leaderboard aggregation filters by `timestamp >= now - 30d` and
groups by wallet_address. Existing indexes lead with wallet_address, which
cannot serve a time-range scan — the aggregation was a full table scan.
This index serves the time-range scan directly.
"""
from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        "ix_wth_timestamp",
        "whale_trade_history",
        ["timestamp"],
        if_not_exists=True,
    )


def downgrade():
    op.drop_index("ix_wth_timestamp", table_name="whale_trade_history", if_exists=True)
