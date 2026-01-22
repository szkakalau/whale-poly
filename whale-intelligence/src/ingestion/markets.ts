import { prisma } from '../db/prisma';
import { env } from '../config/env';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Typed escape hatch for newly added Prisma models (markets, market_outcomes, market_settlements)
const db = prisma as any;

// Configure proxy agent if needed
const proxyUrl = process.env.HTTPS_PROXY || process.env.http_proxy;
const httpsAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

const apiClient = axios.create({
  httpsAgent,
  proxy: false, // Disable axios internal proxy handling to use agent
  timeout: 30000
});

async function retryFetch(url: string, retries = 3, delayMs = 500): Promise<any> {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await apiClient.get(url);
      return res.data;
    } catch (err) {
      lastErr = err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

export async function ingestMarkets() {
  if (!env.POLYMARKET_MARKETS_URL) {
    console.warn('ingestMarkets skipped: POLYMARKET_MARKETS_URL missing');
    return;
  }
  try {
    const data = await retryFetch(env.POLYMARKET_MARKETS_URL);
    // Gamma API for /markets usually returns array directly or { markets: [...] } or { data: [...] }
    const markets = Array.isArray(data) ? data : (data?.markets || data?.data || []);
    const now = new Date();
    for (const m of markets) {
      // Gamma API returns clobTokenIds array (e.g. [yes_token, no_token])
      // We must store a mapping for EACH token ID so that trades on any outcome can find the market title.
      const idsToStore = new Set<string>();
      
      // 1. Add Gamma Market ID
      if (m.id) idsToStore.add(String(m.id));
      
      // 2. Add all CLOB Token IDs
      if (Array.isArray(m.clobTokenIds)) {
        m.clobTokenIds.forEach((tid: any) => idsToStore.add(String(tid)));
      }
      // 3. Fallback/Alternative structure
      if (Array.isArray(m.tokens)) {
        m.tokens.forEach((t: any) => {
          if (t.token_id) idsToStore.add(String(t.token_id));
        });
      }

      // If no tokens found, try legacy single ID fields
      if (idsToStore.size === 0) {
        const fallback = m.market_id || m.slug || m.ticker;
        if (fallback) idsToStore.add(String(fallback));
      }

      const title = String(m.title || m.question || m.name || 'Unknown Market');
      const category = m.category ? String(m.category) : null;
      const status = String(m.status || (m.resolved ? 'resolved' : 'open'));
      const created_at = m.created_at ? new Date(m.created_at) : now;
      const resolved_at = m.resolved_at ? new Date(m.resolved_at) : (m.resolved ? now : null);

      for (const id of idsToStore) {
        if (!id) continue;
        await db.markets.upsert({
          where: { id },
          update: { title, category, status, resolved_at },
          create: { id, title, category, status, created_at, resolved_at }
        });
      }

      const outcomes = Array.isArray(m.outcomes) ? m.outcomes : (Array.isArray(m.markets) ? m.markets[0]?.outcomes : []);
      const labels: string[] = outcomes?.map((o: any) => String(o.label || o.name || o.ticker || o.side || '').toUpperCase()).filter(Boolean) || [];
      // Fallback to YES/NO for binary markets
      if (!labels.length) {
        labels.push('YES', 'NO');
      }
      
      // We only link outcomes to the primary ID (Gamma ID) to avoid clutter, 
      // but for alerts we just need the Market Title lookup via ID.
      // So upserting markets table with all IDs is sufficient for title resolution.
    }
    console.log(`ingestMarkets: upserted ${markets.length} markets (expanded IDs)`);
  } catch (err) {
    console.error('ingestMarkets failed', err);
  }
}

export async function ingestSettlements() {
  if (!env.POLYMARKET_SETTLEMENTS_URL) {
    console.warn('ingestSettlements skipped: POLYMARKET_SETTLEMENTS_URL missing');
    return;
  }
  try {
    const data = await retryFetch(env.POLYMARKET_SETTLEMENTS_URL);
    const items = Array.isArray(data) ? data : (data?.settlements || []);
    for (const s of items) {
      const market_id = String(s.market_id || s.id || '').trim();
      const settled_outcome = String(s.outcome || s.winner || '').toUpperCase();
      const settled_at = new Date(s.settled_at || s.timestamp || Date.now());
      if (!market_id || !settled_outcome) continue;
      await db.market_settlements.upsert({
        where: { market_id },
        update: { settled_outcome, settled_at },
        create: { market_id, settled_outcome, settled_at }
      });
    }
    console.log('ingestSettlements: upserted settlements');
  } catch (err) {
    console.error('ingestSettlements failed', err);
  }
}