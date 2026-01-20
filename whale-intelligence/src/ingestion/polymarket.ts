import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

type RawTrade = {
  id?: string;
  trade_id?: string;
  market_id?: string;
  wallet?: string;
  maker?: string;
  taker?: string;
  side?: 'buy' | 'sell' | string;
  amount?: number | string;
  size?: number | string;
  price?: number | string;
  timestamp?: string | number;
  created_at?: string;
};

function parseTrade(t: RawTrade) {
  const tradeId = t.trade_id || t.id;
  const marketId = t.market_id || 'unknown';
  const wallet = t.wallet || t.maker || t.taker || 'unknown';
  const side = (t.side || '').toLowerCase() === 'sell' ? 'sell' : 'buy';
  const amount = (t.amount ?? t.size ?? 0) as number | string;
  const price = (t.price ?? 0) as number | string;
  const tsStr = (t.timestamp ?? t.created_at ?? Date.now()) as string | number;
  const timestamp = new Date(typeof tsStr === 'number' ? tsStr : tsStr);
  return { tradeId, marketId, wallet, side, amount: Number(amount), price: Number(price), timestamp };
}

export async function ingestTrades(prisma: PrismaClient) {
  try {
    const res = await axios.get(env.POLYMARKET_TRADES_URL, { timeout: 10000 });
    const data = Array.isArray(res.data) ? res.data : (res.data?.trades || []);
    if (!Array.isArray(data)) {
      console.warn('Trades API returned unexpected payload shape');
      return;
    }

    const batch = [] as any[];
    for (const raw of data as RawTrade[]) {
      const p = parseTrade(raw);
      if (!p.tradeId) continue;
      batch.push(
        prisma.trades_raw.upsert({
          where: { trade_id: p.tradeId },
          update: {},
          create: {
            trade_id: p.tradeId,
            market_id: p.marketId,
            wallet: p.wallet,
            side: p.side,
            amount: p.amount,
            price: p.price,
            timestamp: p.timestamp
          }
        })
      );
    }
    
    // Batch process to avoid too many concurrent operations in a single transaction
    if (batch.length) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < batch.length; i += BATCH_SIZE) {
        const chunk = batch.slice(i, i + BATCH_SIZE);
        await prisma.$transaction(chunk);
        console.log(`Ingested trades batch ${i / BATCH_SIZE + 1}/${Math.ceil(batch.length / BATCH_SIZE)}`);
      }
      console.log(`Ingested total ${batch.length} trades`);
    } else {
      console.log('No trades to ingest');
    }
  } catch (err) {
    console.error('Failed to ingest trades', err);
  }
}
