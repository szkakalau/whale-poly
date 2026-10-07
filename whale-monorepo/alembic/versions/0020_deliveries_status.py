"""Add delivery outcome columns to deliveries (F1).

The `deliveries` ledger previously recorded only *intent*: a claim row was
written before the Telegram send and never updated with the result. A failed
send therefore left a row that looked delivered, and — worse — that same row
then blocked every future retry, because the dedup check was "a row exists".

These columns let the ledger record the actual outcome:

  * status     — 'sent' | 'failed' | 'pending'. Pre-existing rows backfill to
                 'sent' (historically "a row exists" == "was delivered").
  * error      — short, token-redacted failure reason (<=200 chars).
  * updated_at — when the outcome was last written.

Only columns are added; the `uq_deliveries` unique constraint is unchanged.
"""
import sqlalchemy as sa
from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "deliveries",
        sa.Column("status", sa.String(length=16), nullable=False, server_default="sent"),
    )
    op.add_column(
        "deliveries",
        sa.Column("error", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "deliveries",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_column("deliveries", "updated_at")
    op.drop_column("deliveries", "error")
    op.drop_column("deliveries", "status")
