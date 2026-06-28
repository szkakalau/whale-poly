from alembic import op
import sqlalchemy as sa

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.create_table(
    "market_vw_metrics",
    sa.Column("market_id", sa.String(length=512), sa.ForeignKey("markets.id", name="fk_vw_metrics_market"), primary_key=True),
    sa.Column("total_volume_usd", sa.Numeric(38, 2), server_default="0"),
    sa.Column("yes_volume_usd", sa.Numeric(38, 2), server_default="0"),
    sa.Column("no_volume_usd", sa.Numeric(38, 2), server_default="0"),
    sa.Column("yes_vw_price", sa.Numeric(10, 8), nullable=True),
    sa.Column("no_vw_price", sa.Numeric(10, 8), nullable=True),
    sa.Column("yes_market_price", sa.Numeric(10, 8), nullable=True),
    sa.Column("no_market_price", sa.Numeric(10, 8), nullable=True),
    sa.Column("vw_divergence", sa.Numeric(10, 8), nullable=True),
    sa.Column("uai", sa.Numeric(10, 8), nullable=True),
    sa.Column("vw_velocity_5m", sa.Numeric(10, 8), nullable=True),
    sa.Column("vw_velocity_15m", sa.Numeric(10, 8), nullable=True),
    sa.Column("vw_velocity_1h", sa.Numeric(10, 8), nullable=True),
    sa.Column("signal_direction", sa.String(length=16), nullable=True),
    sa.Column("signal_strength", sa.Integer(), nullable=True),
    sa.Column("status", sa.String(length=16), server_default="active"),
    sa.Column("computed_at", sa.DateTime(timezone=True), nullable=True),
  )
  op.create_table(
    "market_vw_snapshots",
    sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
    sa.Column("market_id", sa.String(length=512), sa.ForeignKey("markets.id", name="fk_vw_snapshots_market"), nullable=False),
    sa.Column("vw_divergence", sa.Numeric(10, 8), nullable=True),
    sa.Column("uai", sa.Numeric(10, 8), nullable=True),
    sa.Column("yes_vw_price", sa.Numeric(10, 8), nullable=True),
    sa.Column("no_vw_price", sa.Numeric(10, 8), nullable=True),
    sa.Column("yes_market_price", sa.Numeric(10, 8), nullable=True),
    sa.Column("total_volume_usd", sa.Numeric(38, 2), server_default="0"),
    sa.Column("snapshot_at", sa.DateTime(timezone=True), nullable=False),
  )
  op.create_index("ix_market_vw_snapshots_market_id", "market_vw_snapshots", ["market_id"])
  op.create_index("ix_market_vw_snapshots_snapshot_at", "market_vw_snapshots", ["snapshot_at"])


def downgrade() -> None:
  op.drop_index("ix_market_vw_snapshots_snapshot_at", table_name="market_vw_snapshots")
  op.drop_index("ix_market_vw_snapshots_market_id", table_name="market_vw_snapshots")
  op.drop_constraint("fk_vw_snapshots_market", "market_vw_snapshots", type_="foreignkey")
  op.drop_table("market_vw_snapshots")
  op.drop_constraint("fk_vw_metrics_market", "market_vw_metrics", type_="foreignkey")
  op.drop_table("market_vw_metrics")
