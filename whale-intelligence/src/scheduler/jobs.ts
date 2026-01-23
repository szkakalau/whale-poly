import cron from 'node-cron';
import { prisma } from '../db/prisma';
import { ingestTrades } from '../ingestion/polymarket';
import { ingestMarkets, ingestSettlements } from '../ingestion/markets';
import { ingestOrderbookSnapshots } from '../ingestion/orderbook';
import { detectWhales } from '../whale/detector';
import { calculateScores } from '../whale/scorer';
import { dispatchAlerts, createConvictionSignals, dispatchConvictionSignals } from '../alerts/engine';
import { Telegraf } from 'telegraf';

export function startJobs(bot?: Telegraf) {
  // Run critical ingestions immediately on startup to populate caches (e.g. marketMap)
  // Use a slight delay to allow server to bind port first and not compete for CPU during startup
  // Increased delay to 15s to prevent boot-time crash
  setTimeout(() => {
    console.log('Running initial market ingestion...');
    ingestMarkets().catch(err => console.error('Initial market ingestion failed', err));
  }, 15000);

  // Market metadata refresh: every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    await ingestMarkets();
  });

  // Settlements refresh: every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    await ingestSettlements();
  });

  // Trade ingestion: every 1 minute
  let isIngestingTrades = false;
  cron.schedule('* * * * *', async () => {
    if (isIngestingTrades) {
      console.log('Skipping trade ingestion (overlap)');
      return;
    }
    isIngestingTrades = true;
    try {
      await ingestTrades(prisma);
    } finally {
      isIngestingTrades = false;
    }
  });

  // Orderbook snapshots: every 1 minute
  cron.schedule('* * * * *', async () => {
    await ingestOrderbookSnapshots();
  });

  // Whale detection: every 1 minute
  let isDetecting = false;
  cron.schedule('* * * * *', async () => {
    if (isDetecting) {
      console.log('Skipping whale detection (overlap)');
      return;
    }
    isDetecting = true;
    try {
      await detectWhales(prisma);
    } finally {
      isDetecting = false;
    }
  });

  // Score recalculation: every 2 minutes
  let isScoring = false;
  cron.schedule('*/2 * * * *', async () => {
    if (isScoring) {
      console.log('Skipping score recalculation (overlap)');
      return;
    }
    isScoring = true;
    try {
      await calculateScores(prisma);
    } finally {
      isScoring = false;
    }
  });

  // Alert creation & dispatch: every 1 minute
  cron.schedule('* * * * *', async () => {
    // Note: createAlerts is deprecated; Detector handles alert creation now
    if (bot) {
      await dispatchAlerts(prisma, bot);
    }
  });

  // Conviction signals: every 5 minutes (elite-only)
  cron.schedule('*/5 * * * *', async () => {
    await createConvictionSignals(prisma);
    if (bot) {
      await dispatchConvictionSignals(prisma, bot);
    }
  });

  // Subscription expiry check: every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    const now = new Date();
    await prisma.users.updateMany({ where: { expires_at: { lt: now }, status: 'active' }, data: { status: 'expired' } });
  });
}
