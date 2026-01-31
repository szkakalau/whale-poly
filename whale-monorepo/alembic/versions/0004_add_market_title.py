"""add market_title to trades_raw

Revision ID: 0004
Revises: 0003
Create Date: 2026-01-31 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('trades_raw', sa.Column('market_title', sa.String(length=512), nullable=True))


def downgrade():
    op.drop_column('trades_raw', 'market_title')
