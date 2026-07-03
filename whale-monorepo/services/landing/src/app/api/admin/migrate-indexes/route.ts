/**
 * One-shot migration endpoint for /analyze DB indexes.
 * Hit once: GET /api/admin/migrate-indexes
 * Safe to call multiple times — uses IF NOT EXISTS.
 *
 * Requires x-admin-token header matching ADMIN_TOKEN env var.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  // Admin authentication
  const adminToken = process.env.ADMIN_TOKEN || '';
  const headerToken = req.headers.get('x-admin-token') || '';
  if (!adminToken || headerToken !== adminToken) {
    return NextResponse.json({ detail: 'not_found' }, { status: 404 });
  }

  const results: string[] = [];

  try {
    // 1. whale_trades composite index
    const existing = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'whale_trades'`
    );

    const hasMarketTime = existing.some((r) => r.indexname === 'idx_whale_trades_market_time');
    if (hasMarketTime) {
      results.push('✓ idx_whale_trades_market_time already exists');
    } else {
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS idx_whale_trades_market_time ON whale_trades (market_id, created_at DESC)`
      );
      results.push('✓ Created idx_whale_trades_market_time (market_id, created_at DESC)');
    }

    // 2. trades_raw trade_id index
    const trIndexes = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'trades_raw'`
    );

    const hasTradeId = trIndexes.some((r) => r.indexname === 'idx_trades_raw_trade_id');
    if (hasTradeId) {
      results.push('✓ idx_trades_raw_trade_id already exists');
    } else {
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS idx_trades_raw_trade_id ON trades_raw (trade_id)`
      );
      results.push('✓ Created idx_trades_raw_trade_id (trade_id)');
    }

    // Verify
    const final = await prisma.$queryRawUnsafe<{ indexname: string; indexdef: string }[]>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('whale_trades', 'trades_raw') ORDER BY tablename, indexname`
    );

    return NextResponse.json({ ok: true, results, indexes: final });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'migration failed', results },
      { status: 500 },
    );
  }
}
