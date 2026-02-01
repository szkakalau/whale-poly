from alembic import op
import sqlalchemy as sa


revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.create_table(
    "whale_profiles",
    sa.Column("wallet_address", sa.String(length=128), primary_key=True),
    sa.Column("total_volume", sa.Numeric(38, 18), server_default=sa.text("0"), nullable=False),
    sa.Column("total_trades", sa.BigInteger(), server_default=sa.text("0"), nullable=False),
    sa.Column("realized_pnl", sa.Numeric(38, 18), server_default=sa.text("0"), nullable=False),
    sa.Column("wins", sa.BigInteger(), server_default=sa.text("0"), nullable=False),
    sa.Column("losses", sa.BigInteger(), server_default=sa.text("0"), nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
  )
  op.create_index("ix_whale_profiles_total_volume", "whale_profiles", ["total_volume"])
  op.create_index("ix_whale_profiles_total_trades", "whale_profiles", ["total_trades"])


def downgrade() -> None:
  op.drop_index("ix_whale_profiles_total_trades", table_name="whale_profiles")
  op.drop_index("ix_whale_profiles_total_volume", table_name="whale_profiles")
  op.drop_table("whale_profiles")

