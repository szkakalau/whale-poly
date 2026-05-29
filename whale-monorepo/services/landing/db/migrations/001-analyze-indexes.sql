-- /analyze Decision Engine — DB Index Migration
-- Run this migration to ensure the whale_trades table has proper indexes
-- for market-filtered queries used by the decision engine.
--
-- The whale_trades and trades_raw tables are managed by the Python
-- whale-engine pipeline (not Prisma). Run this SQL directly:
--   psql $DATABASE_URL -f db/migrations/001-analyze-indexes.sql

-- Index for market-filtered whale trade queries (loadSignalsForMarket)
-- Covers: WHERE market_id ILIKE ... AND created_at >= ...
CREATE INDEX IF NOT EXISTS idx_whale_trades_market_time
  ON whale_trades (market_id, created_at DESC);

-- Index for trades_raw JOIN on trade_id (if not already a PK)
CREATE INDEX IF NOT EXISTS idx_trades_raw_trade_id
  ON trades_raw (trade_id);

-- Verify indexes were created
-- Run: SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('whale_trades', 'trades_raw');
