
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

// Explicitly load .env from project root
const envPath = path.join(__dirname, '..', '..', '.env');
dotenv.config({ path: envPath });

const prisma = new PrismaClient();

export async function cleanupOldData() {
  console.log('Starting database cleanup...');
  const now = new Date();

  // 1. Cleanup Orderbook Snapshots (Keep last 24h)
  // These are heavy and only needed for recent depth calculations
  const orderbookCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  try {
    const { count } = await prisma.orderbook_snapshots.deleteMany({
      where: {
        timestamp: { lt: orderbookCutoff }
      }
    });
    console.log(`Deleted ${count} old orderbook snapshots (older than ${orderbookCutoff.toISOString()})`);
  } catch (err) {
    console.error('Failed to cleanup orderbook snapshots:', err);
  }

  // 2. Cleanup Raw Trades (Keep last 7 days)
  // Used for whale detection and scoring
  const tradesCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  try {
    const { count } = await prisma.trades_raw.deleteMany({
      where: {
        timestamp: { lt: tradesCutoff }
      }
    });
    console.log(`Deleted ${count} old raw trades (older than ${tradesCutoff.toISOString()})`);
  } catch (err) {
    console.error('Failed to cleanup raw trades:', err);
  }

  // 3. Cleanup Whale Scores (Keep last 7 days)
  const scoresCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  try {
    const { count } = await prisma.whale_scores.deleteMany({
      where: {
        calculated_at: { lt: scoresCutoff }
      }
    });
    console.log(`Deleted ${count} old whale scores (older than ${scoresCutoff.toISOString()})`);
  } catch (err) {
    console.error('Failed to cleanup whale scores:', err);
  }

  try {
    const { count } = await prisma.whale_scores_ext.deleteMany({
      where: {
        calculated_at: { lt: scoresCutoff }
      }
    });
    console.log(`Deleted ${count} old extended whale scores`);
  } catch (err) {
    console.error('Failed to cleanup extended whale scores:', err);
  }

  // 4. Cleanup Old Alerts (Keep last 30 days)
  const alertsCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  try {
    const { count } = await prisma.alerts.deleteMany({
      where: {
        created_at: { lt: alertsCutoff }
      }
    });
    console.log(`Deleted ${count} old alerts (older than ${alertsCutoff.toISOString()})`);
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
