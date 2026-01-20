import cron from 'node-cron';
import { prisma } from '../db/prisma';
import { ingestTrades } from '../ingestion/polymarket';
import { ingestMarkets, ingestSettlements } from '../ingestion/markets';
import { ingestOrderbookSnapshots } from '../ingestion/orderbook';
import { detectWhales } from '../whale/detector';
import { calculateScores } from '../whale/scorer';
import { createAlerts, dispatchAlerts, createConvictionSignals, dispatchConvictionSignals } from '../alerts/engine';
import { Telegraf } from 'telegraf';

export function startJobs(bot?: Telegraf) {
  // Market metadata refresh: every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    await ingestMarkets();
  });

  // Settlements refresh: every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    await ingestSettlements();
  });

  // Trade ingestion: every 1 minute
  cron.schedule('* * * * *', async () => {
    await ingestTrades(prisma);
  });

  // Orderbook snapshots: every 1 minute
  cron.schedule('* * * * *', async () => {
    await ingestOrderbookSnapshots();
  });

  // Whale detection: every 1 minute
  cron.schedule('* * * * *', async () => {
    await detectWhales(prisma);
  });

  // Score recalculation: every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    await calculateScores(prisma);
  });

  // Alert creation & dispatch: every 1 minute
  cron.schedule('* * * * *', async () => {
    await createAlerts(prisma, 10);
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
