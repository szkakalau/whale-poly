from alembic import op
import sqlalchemy as sa

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.create_table(
    "smart_collections",
    sa.Column("id", sa.String(length=64), primary_key=True),
    sa.Column("name", sa.String(length=256), nullable=False),
    sa.Column("description", sa.String(length=512), nullable=True),
    sa.Column("rule_json", sa.Text(), nullable=False),
    sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
  )

  op.create_table(
    "smart_collection_whales",
    sa.Column("id", sa.String(length=64), primary_key=True),
    sa.Column("smart_collection_id", sa.String(length=64), nullable=False),
    sa.Column("wallet", sa.String(length=128), nullable=False),
    sa.Column("snapshot_date", sa.DateTime(timezone=True), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    sa.UniqueConstraint("smart_collection_id", "wallet", "snapshot_date", name="smart_collection_wallet_unique"),
  )
  op.create_index("ix_scw_collection_id", "smart_collection_whales", ["smart_collection_id"])
  op.create_index("ix_scw_wallet", "smart_collection_whales", ["wallet"])
  op.create_index("ix_scw_snapshot_date", "smart_collection_whales", ["snapshot_date"])

  op.create_table(
    "smart_collection_subscriptions",
    sa.Column("id", sa.String(length=64), primary_key=True),
    sa.Column("user_id", sa.String(length=64), nullable=False),
    sa.Column("smart_collection_id", sa.String(length=64), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    sa.UniqueConstraint("user_id", "smart_collection_id", name="user_smart_collection_unique"),
  )
  op.create_index("ix_scs_user_id", "smart_collection_subscriptions", ["user_id"])
  op.create_index("ix_scs_collection_id", "smart_collection_subscriptions", ["smart_collection_id"])


def downgrade() -> None:
  op.drop_index("ix_scs_collection_id", table_name="smart_collection_subscriptions")
  op.drop_index("ix_scs_user_id", table_name="smart_collection_subscriptions")
  op.drop_table("smart_collection_subscriptions")

  op.drop_index("ix_scw_snapshot_date", table_name="smart_collection_whales")
  op.drop_index("ix_scw_wallet", table_name="smart_collection_whales")
  op.drop_index("ix_scw_collection_id", table_name="smart_collection_whales")
  op.drop_table("smart_collection_whales")

  op.drop_table("smart_collections")
