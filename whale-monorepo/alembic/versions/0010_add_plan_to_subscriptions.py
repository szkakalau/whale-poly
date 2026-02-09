"""add_plan_to_subscriptions

Revision ID: 0010
Revises: 0009
Create Date: 2026-02-09 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('subscriptions')]
    if 'plan' not in columns:
        op.add_column('subscriptions', sa.Column('plan', sa.String(length=16), server_default='free', nullable=False))
        op.create_index(op.f('ix_subscriptions_plan'), 'subscriptions', ['plan'], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('subscriptions')]
    if 'plan' in columns:
        op.drop_index(op.f('ix_subscriptions_plan'), table_name='subscriptions')
        op.drop_column('subscriptions', 'plan')
