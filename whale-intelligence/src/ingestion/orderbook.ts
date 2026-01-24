import { prisma } from '../db/prisma';
import { env } from '../config/env';

// Use a typed escape hatch for newly added Prisma models to avoid TS property errors
const db = prisma as any;

async function retryFetch(url: string, opts: any = {}, retries = 3, delayMs = 500): Promise<Response> {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

export async function ingestOrderbookSnapshots() {
  if (!env.POLYMARKET_ORDERBOOK_URL) {
    console.warn('ingestOrderbookSnapshots skipped: POLYMARKET_ORDERBOOK_URL missing');
    return;
  }
  try {
    // Fetch recent markets to limit snapshot volume
    // Only fetch markets that had trade activity recently to save space
    const activeMarketIds = await db.trades_raw.findMany({
       where: { timestamp: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
       select: { market_id: true },
       distinct: ['market_id']
    });
    const activeIds = activeMarketIds.map((r: any) => r.market_id);

    const markets = await db.markets.findMany({ 
       where: { id: { in: activeIds } }, 
       take: 50 
    });

    const now = new Date();
    for (const m of markets) {
      // Validate ID: CLOB IDs are typically long hashes/UUIDs. 
      // Skip short numeric legacy IDs (e.g. "12", "44") which cause 404s.
      // This also helps clean up the loop from legacy data.
      if (!m.id || m.id.length < 10) {
        continue;
      }

      // CLOB API uses `token_id` instead of `market_id` for orderbooks in some endpoints, 
      // but standard /book endpoint uses `token_id` which corresponds to our market.id (condition ID or token ID).
      // Let's try `token_id` parameter.
      const url = `${env.POLYMARKET_ORDERBOOK_URL}?token_id=${encodeURIComponent(m.id)}`;
      let data: any;
      try {
        const res = await retryFetch(url);
        data = await res.json();
      } catch (err) {
        console.warn('Orderbook fetch failed for', m.id, err);
        continue;
      }
      const books = Array.isArray(data) ? data : (data?.orderbooks || []);
      const entries = books.length ? books : [data];
      for (const ob of entries) {
        const outcome = String(ob.outcome || ob.label || ob.side || 'YES').toUpperCase();
        const bid = Number(ob.bid_depth_usd || ob.bid_depth || ob.bids_total_usd || 0);
        const ask = Number(ob.ask_depth_usd || ob.ask_depth || ob.asks_total_usd || 0);
        const total = bid + ask;
        await db.orderbook_snapshots.create({
          data: {
            market_id: m.id,
            outcome_label: outcome,
            timestamp: now,
            bid_depth_usd: bid,
            ask_depth_usd: ask,
            total_depth_usd: total
          }
        });
      }
    }
    console.log('ingestOrderbookSnapshots: snapshots stored');
  } catch (err) {
    console.error('ingestOrderbookSnapshots failed', err);
  }
}