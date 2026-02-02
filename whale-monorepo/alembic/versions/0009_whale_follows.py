from alembic import op
import sqlalchemy as sa


revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.create_table(
    "whale_follows",
    sa.Column("id", sa.String(length=64), primary_key=True),
    sa.Column("user_id", sa.String(length=64), nullable=False),
    sa.Column("wallet", sa.String(length=128), nullable=False),
    sa.Column("alert_entry", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    sa.Column("alert_exit", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    sa.Column("alert_add", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    sa.Column("min_size", sa.Float(), server_default=sa.text("0"), nullable=False),
    sa.Column("min_score", sa.Float(), server_default=sa.text("0"), nullable=False),
    sa.Column("enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.UniqueConstraint("user_id", "wallet", name="user_wallet_unique"),
  )
  op.create_index("ix_whale_follows_user_id", "whale_follows", ["user_id"])
  op.create_index("ix_whale_follows_wallet", "whale_follows", ["wallet"])


def downgrade() -> None:
  op.drop_index("ix_whale_follows_wallet", table_name="whale_follows")
  op.drop_index("ix_whale_follows_user_id", table_name="whale_follows")
  op.drop_constraint("user_wallet_unique", "whale_follows", type_="unique")
  op.drop_table("whale_follows")
