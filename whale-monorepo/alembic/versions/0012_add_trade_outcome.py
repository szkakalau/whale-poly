from alembic import op
import sqlalchemy as sa

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.add_column("trades_raw", sa.Column("outcome", sa.String(length=128), nullable=True))


def downgrade() -> None:
  op.drop_column("trades_raw", "outcome")
