"""add token conditions and normalize market id

Revision ID: 0003
Revises: 0002
Create Date: 2026-01-30 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create token_conditions table if not exists
    op.create_table(
        'token_conditions',
        sa.Column('token_id', sa.String(), nullable=False),
        sa.Column('condition_id', sa.String(), nullable=False),
        sa.Column('market_id', sa.String(), nullable=False),
        sa.Column('question', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('token_id')
    )
    op.create_index(op.f('ix_token_conditions_condition_id'), 'token_conditions', ['condition_id'], unique=False)
    op.create_index(op.f('ix_token_conditions_market_id'), 'token_conditions', ['market_id'], unique=False)
    op.create_index(op.f('ix_token_conditions_token_id'), 'token_conditions', ['token_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_token_conditions_token_id'), table_name='token_conditions')
    op.drop_index(op.f('ix_token_conditions_market_id'), table_name='token_conditions')
    op.drop_index(op.f('ix_token_conditions_condition_id'), table_name='token_conditions')
    op.drop_table('token_conditions')
