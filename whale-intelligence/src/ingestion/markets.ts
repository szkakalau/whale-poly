import { prisma } from '../db/prisma';
import { env } from '../config/env';

// Typed escape hatch for newly added Prisma models (markets, market_outcomes, market_settlements)
const db = prisma as any;

async function retryFetch(url: string, opts: any = {}, retries = 3, delayMs = 500): Promise<Response> {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, opts);
      // Gamma API returns { data: [...] } or just [...]
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
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
    const res = await retryFetch(env.POLYMARKET_MARKETS_URL);
    const data = await res.json();
    // Gamma API for /markets usually returns array directly or { markets: [...] } or { data: [...] }
    const markets = Array.isArray(data) ? data : (data?.markets || data?.data || []);
    const now = new Date();
    for (const m of markets) {
      // Try to find CLOB Token ID first to match Orderbook/Trade APIs
      let token_id = '';
      if (Array.isArray(m.clobTokenIds) && m.clobTokenIds.length > 0) {
        token_id = m.clobTokenIds[0];
      } else if (Array.isArray(m.tokens) && m.tokens.length > 0 && m.tokens[0].token_id) {
        token_id = m.tokens[0].token_id;
      }

      const id = String(token_id || m.id || m.market_id || m.slug || m.ticker || '').trim();
      if (!id) continue;
      const title = String(m.title || m.question || m.name || id);
      const category = m.category ? String(m.category) : null;
      const status = String(m.status || (m.resolved ? 'resolved' : 'open'));
      const created_at = m.created_at ? new Date(m.created_at) : now;
      const resolved_at = m.resolved_at ? new Date(m.resolved_at) : (m.resolved ? now : null);
      await db.markets.upsert({
        where: { id },
        update: { title, category, status, resolved_at },
        create: { id, title, category, status, created_at, resolved_at }
      });

      const outcomes = Array.isArray(m.outcomes) ? m.outcomes : (Array.isArray(m.markets) ? m.markets[0]?.outcomes : []);
      const labels: string[] = outcomes?.map((o: any) => String(o.label || o.name || o.ticker || o.side || '').toUpperCase()).filter(Boolean) || [];
      // Fallback to YES/NO for binary markets
      if (!labels.length) {
        labels.push('YES', 'NO');
      }
      for (const label of labels) {
        await db.market_outcomes.upsert({
          where: { id: `${id}-${label}` },
          update: { market_id: id, label },
          create: { id: `${id}-${label}`, market_id: id, label }
        });
      }
    }
    console.log(`ingestMarkets: upserted ${markets.length} markets`);
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
    const res = await retryFetch(env.POLYMARKET_SETTLEMENTS_URL);
    const data = await res.json();
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