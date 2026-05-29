/**
 * One-off migration script: creates indexes for the /analyze decision engine.
 * Run: npx ts-node --compiler-options '{"module":"commonjs","moduleResolution":"node"}' db/migrations/run-001.ts
 * Or:    npx tsx db/migrations/run-001.ts
 */
import { prisma } from '../../src/lib/prisma';

async function main() {
  console.log('→ Checking existing indexes on whale_trades...');
  const existing = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'whale_trades'`
  );
  console.log('  Found:', existing.map((r) => r.indexname).join(', ') || '(none)');

  const hasTarget = existing.some((r) => r.indexname === 'idx_whale_trades_market_time');
  if (hasTarget) {
    console.log('✓ idx_whale_trades_market_time already exists — nothing to do.');
  } else {
    console.log('→ Creating idx_whale_trades_market_time (market_id, created_at DESC)...');
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_whale_trades_market_time ON whale_trades (market_id, created_at DESC)`
    );
    console.log('✓ Created.');
  }

  console.log('→ Checking indexes on trades_raw...');
  const trIndexes = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'trades_raw'`
  );
  console.log('  Found:', trIndexes.map((r) => r.indexname).join(', ') || '(none)');

  const hasTr = trIndexes.some((r) => r.indexname === 'idx_trades_raw_trade_id');
  if (hasTr) {
    console.log('✓ idx_trades_raw_trade_id already exists — nothing to do.');
  } else {
    console.log('→ Creating idx_trades_raw_trade_id (trade_id)...');
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_trades_raw_trade_id ON trades_raw (trade_id)`
    );
    console.log('✓ Created.');
  }

  console.log('→ Verifying...');
  const final = await prisma.$queryRawUnsafe<{ indexname: string; indexdef: string }[]>(
    `SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('whale_trades', 'trades_raw') ORDER BY tablename, indexname`
  );
  for (const row of final) {
    console.log(`  ${row.indexname}: ${row.indexdef}`);
  }
  console.log('✓ Done.');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
