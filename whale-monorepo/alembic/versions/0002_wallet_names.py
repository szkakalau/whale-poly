from alembic import op
import sqlalchemy as sa


revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.create_table(
    "wallet_names",
    sa.Column("wallet_address", sa.String(length=128), primary_key=True),
    sa.Column("polymarket_username", sa.String(length=128), nullable=True),
    sa.Column("ens_name", sa.String(length=256), nullable=True),
    sa.Column("source", sa.String(length=32), nullable=True),
    sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
  )
  op.create_index("ix_wallet_names_wallet_address", "wallet_names", ["wallet_address"])


def downgrade() -> None:
  op.drop_index("ix_wallet_names_wallet_address", table_name="wallet_names")
  op.drop_table("wallet_names")
