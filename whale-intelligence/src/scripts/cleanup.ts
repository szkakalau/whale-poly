
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

// Explicitly load .env from project root
const envPath = path.join(__dirname, '..', '..', '.env');
dotenv.config({ path: envPath });

const prisma = new PrismaClient();

async function deleteInBatches(model: any, where: any, batchSize = 1000) {
  let totalDeleted = 0;
  while (true) {
    // Find IDs to delete first to keep transaction log small
    // Note: We use findMany with select ID to minimize data transfer
    // Adjust 'id' field name based on model
    const idField = model.name === 'trades_raw' ? 'trade_id' : 
                    model.name === 'whale_profiles' ? 'wallet' : 
                    model.name === 'whale_scores' ? 'wallet' : // Composite key, handled differently
                    model.name === 'whale_scores_ext' ? 'wallet' : // Composite key
                    'id';

    // For models with simple IDs
    if (idField === 'id' || idField === 'trade_id') {
      const items = await model.findMany({
        where,
        take: batchSize,
        select: { [idField]: true }
      });

      if (items.length === 0) break;

      const ids = items.map((i: any) => i[idField]);
      const { count } = await model.deleteMany({
        where: {
          [idField]: { in: ids }
        }
      });
      totalDeleted += count;
      console.log(`Deleted batch of ${count} items from ${model.name}...`);
      
      // Brief pause to let DB recover
      await new Promise(r => setTimeout(r, 200));
    } 
    // For composite keys or models where we can't easily select by ID for deletion
    // We fall back to simple deleteMany with limit if supported (Prisma doesn't support limit on deleteMany directly)
    // So we just rely on date range for these, but maybe split the date range?
    else {
       // For whale_scores, just try deleting directly but maybe we skip batching logic for now 
       // or implement date-slicing logic later if needed.
       // Let's just return -1 to indicate we didn't use batching
       return -1;
    }
  }
  return totalDeleted;
}

export async function cleanupOldData() {
  console.log('Starting database cleanup (Batched)...');
  const now = new Date();

  // 1. Cleanup Orderbook Snapshots (Keep last 6h)
  // These have 'id', so we can batch
  const orderbookCutoff = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  console.log(`Cleaning Orderbook Snapshots older than ${orderbookCutoff.toISOString()}...`);
  try {
    // Use the model property which Prisma attaches (e.g. prisma.orderbook_snapshots)
    // But we need to pass the model object.
    const deleted = await deleteInBatches(prisma.orderbook_snapshots, { timestamp: { lt: orderbookCutoff } });
    console.log(`Total Orderbook Snapshots deleted: ${deleted}`);
  } catch (err) {
    console.error('Failed to cleanup orderbook snapshots:', err);
  }

  // 2. Cleanup Raw Trades (Keep last 3 days)
  // Has 'trade_id'
  const tradesCutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  console.log(`Cleaning Raw Trades older than ${tradesCutoff.toISOString()}...`);
  try {
    const deleted = await deleteInBatches(prisma.trades_raw, { timestamp: { lt: tradesCutoff } });
    console.log(`Total Raw Trades deleted: ${deleted}`);
  } catch (err) {
    console.error('Failed to cleanup raw trades:', err);
  }

  // 3. Cleanup Whale Scores (Keep last 7 days)
  // Composite key, batching by ID is hard. Let's try date slicing if simple delete fails?
  // For now, let's just try standard deleteMany for scores as they are smaller than orderbooks
  const scoresCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  console.log(`Cleaning Whale Scores older than ${scoresCutoff.toISOString()}...`);
  try {
    const { count } = await prisma.whale_scores.deleteMany({
      where: { calculated_at: { lt: scoresCutoff } }
    });
    console.log(`Deleted ${count} old whale scores`);
  } catch (err) {
    console.error('Failed to cleanup whale scores:', err);
  }

  try {
    const { count } = await prisma.whale_scores_ext.deleteMany({
      where: { calculated_at: { lt: scoresCutoff } }
    });
    console.log(`Deleted ${count} old extended whale scores`);
  } catch (err) {
    console.error('Failed to cleanup extended whale scores:', err);
  }

  // 4. Cleanup Old Alerts (Keep last 30 days)
  // Has 'id'
  const alertsCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  console.log(`Cleaning Alerts older than ${alertsCutoff.toISOString()}...`);
  try {
    const deleted = await deleteInBatches(prisma.alerts, { created_at: { lt: alertsCutoff } });
    console.log(`Total Alerts deleted: ${deleted}`);
  } catch (err) {
    console.error('Failed to cleanup old alerts:', err);
  }

  console.log('Cleanup finished.');
}

// Allow running directly
if (require.main === module) {
  cleanupOldData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
