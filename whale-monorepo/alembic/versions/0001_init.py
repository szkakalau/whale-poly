from alembic import op
import sqlalchemy as sa


revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.create_table(
    "markets",
    sa.Column("id", sa.String(length=128), primary_key=True),
    sa.Column("title", sa.String(length=512), nullable=False),
    sa.Column("status", sa.String(length=32), nullable=True),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
  )

  op.create_table(
    "trades_raw",
    sa.Column("trade_id", sa.String(length=128), primary_key=True),
    sa.Column("market_id", sa.String(length=128), nullable=False),
    sa.Column("wallet", sa.String(length=128), nullable=False),
    sa.Column("side", sa.String(length=16), nullable=False),
    sa.Column("amount", sa.Numeric(38, 18), nullable=False),
    sa.Column("price", sa.Numeric(38, 18), nullable=False),
    sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
  )
  op.create_index("ix_trades_raw_market_id", "trades_raw", ["market_id"])
  op.create_index("ix_trades_raw_wallet", "trades_raw", ["wallet"])
  op.create_index("ix_trades_raw_timestamp", "trades_raw", ["timestamp"])

  op.create_table(
    "wallets",
    sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
    sa.Column("address", sa.String(length=128), nullable=False),
    sa.Column("total_volume", sa.Numeric(38, 18), server_default=sa.text("0"), nullable=False),
    sa.Column("total_trades", sa.BigInteger(), server_default=sa.text("0"), nullable=False),
    sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
    sa.UniqueConstraint("address", name="uq_wallets_address"),
  )
  op.create_index("ix_wallets_address", "wallets", ["address"])
  op.create_index("ix_wallets_last_seen_at", "wallets", ["last_seen_at"])

  op.create_table(
    "whale_scores",
    sa.Column("wallet_address", sa.String(length=128), primary_key=True),
    sa.Column("final_score", sa.BigInteger(), nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
  )
  op.create_index("ix_whale_scores_final_score", "whale_scores", ["final_score"])

  op.create_table(
    "whale_trades",
    sa.Column("id", sa.String(length=64), primary_key=True),
    sa.Column("trade_id", sa.String(length=128), nullable=False),
    sa.Column("wallet_address", sa.String(length=128), nullable=False),
    sa.Column("whale_score", sa.BigInteger(), nullable=False),
    sa.Column("market_id", sa.String(length=128), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.UniqueConstraint("trade_id", name="uq_whale_trades_trade_id"),
  )
  op.create_index("ix_whale_trades_trade_id", "whale_trades", ["trade_id"])
  op.create_index("ix_whale_trades_wallet_address", "whale_trades", ["wallet_address"])
  op.create_index("ix_whale_trades_whale_score", "whale_trades", ["whale_score"])
  op.create_index("ix_whale_trades_market_id", "whale_trades", ["market_id"])
  op.create_index("ix_whale_trades_created_at", "whale_trades", ["created_at"])

  op.create_table(
    "market_alert_state",
    sa.Column("market_id", sa.String(length=128), primary_key=True),
    sa.Column("last_alert_at", sa.DateTime(timezone=True), nullable=False),
  )
  op.create_index("ix_market_alert_state_last_alert_at", "market_alert_state", ["last_alert_at"])

  op.create_table(
    "alerts",
    sa.Column("id", sa.String(length=64), primary_key=True),
    sa.Column("whale_trade_id", sa.String(length=64), nullable=False),
    sa.Column("market_id", sa.String(length=128), nullable=False),
    sa.Column("wallet_address", sa.String(length=128), nullable=False),
    sa.Column("whale_score", sa.BigInteger(), nullable=False),
    sa.Column("alert_type", sa.String(length=32), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.UniqueConstraint("whale_trade_id", name="uq_alerts_whale_trade_id"),
  )
  op.create_index("ix_alerts_whale_trade_id", "alerts", ["whale_trade_id"])
  op.create_index("ix_alerts_market_id", "alerts", ["market_id"])
  op.create_index("ix_alerts_wallet_address", "alerts", ["wallet_address"])
  op.create_index("ix_alerts_alert_type", "alerts", ["alert_type"])
  op.create_index("ix_alerts_created_at", "alerts", ["created_at"])

  op.create_table(
    "tg_users",
    sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
    sa.Column("telegram_id", sa.String(length=64), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.UniqueConstraint("telegram_id", name="uq_tg_users_telegram_id"),
  )
  op.create_index("ix_tg_users_telegram_id", "tg_users", ["telegram_id"])

  op.create_table(
    "activation_codes",
    sa.Column("code", sa.String(length=16), primary_key=True),
    sa.Column("telegram_id", sa.String(length=64), nullable=False),
    sa.Column("used", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
  )
  op.create_index("ix_activation_codes_telegram_id", "activation_codes", ["telegram_id"])

  op.create_table(
    "deliveries",
    sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
    sa.Column("telegram_id", sa.String(length=64), nullable=False),
    sa.Column("whale_trade_id", sa.String(length=64), nullable=False),
    sa.Column("delivered_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.UniqueConstraint("telegram_id", "whale_trade_id", name="uq_deliveries"),
  )
  op.create_index("ix_deliveries_telegram_id", "deliveries", ["telegram_id"])
  op.create_index("ix_deliveries_whale_trade_id", "deliveries", ["whale_trade_id"])

  op.create_table(
    "plans",
    sa.Column("id", sa.String(length=64), primary_key=True),
    sa.Column("name", sa.String(length=16), nullable=False),
    sa.Column("price_usd", sa.Integer(), nullable=False),
    sa.Column("stripe_price_id", sa.String(length=128), nullable=False),
    sa.UniqueConstraint("name", name="uq_plans_name"),
    sa.UniqueConstraint("stripe_price_id", name="uq_plans_stripe_price_id"),
  )
  op.create_index("ix_plans_name", "plans", ["name"])

  op.create_table(
    "subscriptions",
    sa.Column("id", sa.String(length=64), primary_key=True),
    sa.Column("telegram_id", sa.String(length=64), nullable=False),
    sa.Column("stripe_customer_id", sa.String(length=128), nullable=False),
    sa.Column("stripe_subscription_id", sa.String(length=128), nullable=False),
    sa.Column("status", sa.String(length=16), nullable=False),
    sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=False),
    sa.UniqueConstraint("stripe_subscription_id", name="uq_subscriptions_stripe_subscription_id"),
  )
  op.create_index("ix_subscriptions_telegram_id", "subscriptions", ["telegram_id"])
  op.create_index("ix_subscriptions_stripe_customer_id", "subscriptions", ["stripe_customer_id"])
  op.create_index("ix_subscriptions_stripe_subscription_id", "subscriptions", ["stripe_subscription_id"])
  op.create_index("ix_subscriptions_status", "subscriptions", ["status"])
  op.create_index("ix_subscriptions_current_period_end", "subscriptions", ["current_period_end"])

  op.create_table(
    "stripe_events",
    sa.Column("id", sa.String(length=128), primary_key=True),
    sa.Column("event_type", sa.String(length=128), nullable=False),
    sa.Column("processed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
  )
  op.create_index("ix_stripe_events_event_type", "stripe_events", ["event_type"])


def downgrade() -> None:
  op.drop_index("ix_stripe_events_event_type", table_name="stripe_events")
  op.drop_table("stripe_events")

  op.drop_index("ix_subscriptions_current_period_end", table_name="subscriptions")
  op.drop_index("ix_subscriptions_status", table_name="subscriptions")
  op.drop_index("ix_subscriptions_stripe_subscription_id", table_name="subscriptions")
  op.drop_index("ix_subscriptions_stripe_customer_id", table_name="subscriptions")
  op.drop_index("ix_subscriptions_telegram_id", table_name="subscriptions")
  op.drop_constraint("uq_subscriptions_stripe_subscription_id", "subscriptions", type_="unique")
  op.drop_table("subscriptions")

  op.drop_index("ix_plans_name", table_name="plans")
  op.drop_constraint("uq_plans_stripe_price_id", "plans", type_="unique")
  op.drop_constraint("uq_plans_name", "plans", type_="unique")
  op.drop_table("plans")

  op.drop_index("ix_deliveries_whale_trade_id", table_name="deliveries")
  op.drop_index("ix_deliveries_telegram_id", table_name="deliveries")
  op.drop_constraint("uq_deliveries", "deliveries", type_="unique")
  op.drop_table("deliveries")

  op.drop_index("ix_activation_codes_telegram_id", table_name="activation_codes")
  op.drop_table("activation_codes")

  op.drop_index("ix_tg_users_telegram_id", table_name="tg_users")
  op.drop_constraint("uq_tg_users_telegram_id", "tg_users", type_="unique")
  op.drop_table("tg_users")

  op.drop_index("ix_alerts_created_at", table_name="alerts")
  op.drop_index("ix_alerts_alert_type", table_name="alerts")
  op.drop_index("ix_alerts_wallet_address", table_name="alerts")
  op.drop_index("ix_alerts_market_id", table_name="alerts")
  op.drop_index("ix_alerts_whale_trade_id", table_name="alerts")
  op.drop_constraint("uq_alerts_whale_trade_id", "alerts", type_="unique")
  op.drop_table("alerts")

  op.drop_index("ix_market_alert_state_last_alert_at", table_name="market_alert_state")
  op.drop_table("market_alert_state")

  op.drop_index("ix_whale_trades_created_at", table_name="whale_trades")
  op.drop_index("ix_whale_trades_market_id", table_name="whale_trades")
  op.drop_index("ix_whale_trades_whale_score", table_name="whale_trades")
  op.drop_index("ix_whale_trades_wallet_address", table_name="whale_trades")
  op.drop_index("ix_whale_trades_trade_id", table_name="whale_trades")
  op.drop_constraint("uq_whale_trades_trade_id", "whale_trades", type_="unique")
  op.drop_table("whale_trades")

  op.drop_index("ix_whale_scores_final_score", table_name="whale_scores")
  op.drop_table("whale_scores")

  op.drop_index("ix_wallets_last_seen_at", table_name="wallets")
  op.drop_index("ix_wallets_address", table_name="wallets")
  op.drop_constraint("uq_wallets_address", "wallets", type_="unique")
  op.drop_table("wallets")

  op.drop_index("ix_trades_raw_timestamp", table_name="trades_raw")
  op.drop_index("ix_trades_raw_wallet", table_name="trades_raw")
  op.drop_index("ix_trades_raw_market_id", table_name="trades_raw")
  op.drop_table("trades_raw")

  op.drop_table("markets")
