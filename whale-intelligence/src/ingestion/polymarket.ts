import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

// Create agent instance outside the function to reuse it, or inside if you prefer.
// Since this is a module, creating it once is fine if env doesn't change.
const agent = env.HTTPS_PROXY ? new HttpsProxyAgent(env.HTTPS_PROXY) : undefined;

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
  // New keys from Data API
  proxyWallet?: string;
  conditionId?: string;
  asset?: string;
  transactionHash?: string;
};

function parseTrade(t: RawTrade) {
  // Use transactionHash as fallback ID if trade_id/id missing.
  // Note: This might skip multiple trades in same tx if no index provided, 
  // but it's better than skipping all.
  const tradeId = t.trade_id || t.id || t.transactionHash;
  const marketId = t.market_id || t.conditionId || t.asset || 'unknown';
  const wallet = t.wallet || t.maker || t.taker || t.proxyWallet || 'unknown';
  const side = (t.side || '').toLowerCase() === 'sell' ? 'sell' : 'buy';
  const amount = (t.amount ?? t.size ?? 0) as number | string;
  const price = (t.price ?? 0) as number | string;
  const tsStr = (t.timestamp ?? t.created_at ?? Date.now()) as string | number;
  // Handle timestamp in seconds (10 digits) vs ms
  const tsNum = typeof tsStr === 'number' ? tsStr : Number(tsStr);
  const timestamp = new Date(tsNum < 10000000000 ? tsNum * 1000 : tsNum);
  return { tradeId, marketId, wallet, side, amount: Number(amount), price: Number(price), timestamp };
}

export async function ingestTrades(prisma: PrismaClient) {
  try {
    console.log(`[Ingestion] Fetching trades from ${env.POLYMARKET_TRADES_URL}...`);
    const res = await axios.get(env.POLYMARKET_TRADES_URL, { 
      timeout: 30000, 
      validateStatus: () => true,
      httpsAgent: agent,
      proxy: false // prevent axios from using its own proxy logic which might conflict with https-proxy-agent
    });
    
    if (res.status !== 200) {
        console.error(`[Ingestion] API Error: ${res.status} ${res.statusText}`, res.data);
        return;
    }

    const data = Array.isArray(res.data) ? res.data : (res.data?.trades || []);
    if (!Array.isArray(data)) {
      console.warn('[Ingestion] Trades API returned unexpected payload shape:', typeof res.data, Object.keys(res.data || {}));
      return;
    }
    
    console.log(`[Ingestion] Received ${data.length} trades`);
    if (data.length > 0) {
      console.log('[Ingestion] Sample trade keys:', Object.keys(data[0]));
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
