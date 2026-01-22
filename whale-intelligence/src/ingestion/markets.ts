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

// Global map to store Market ID / Token ID -> Market Title mapping
export const marketMap = new Map<string, string>();

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

  const BATCH_SIZE = 100;
  let offset = 0;
  let totalIngested = 0;
  // Limit to prevent infinite loops, but high enough to cover active markets
  const MAX_MARKETS = 5000; 
  
  const baseUrl = env.POLYMARKET_MARKETS_URL;
  // Handle existing query params in URL
  const separator = baseUrl.includes('?') ? '&' : '?';

  console.log('Starting market ingestion...');

  while (totalIngested < MAX_MARKETS) {
    try {
      // Prioritize active markets. 
      // Note: If the base URL is generic, we append params.
      const url = `${baseUrl}${separator}limit=${BATCH_SIZE}&offset=${offset}&active=true`;
      
      const data = await retryFetch(url);
      const markets = Array.isArray(data) ? data : (data?.markets || data?.data || []);
      
      if (!markets || markets.length === 0) {
        console.log('ingestMarkets: No more markets returned from API');
        break;
      }

      const now = new Date();
      let upsertCount = 0;

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

        // Process all IDs for this market
        for (const id of idsToStore) {
          if (!id) continue;
          marketMap.set(id, title);
          
          // Fire and forget upsert to speed up ingestion? 
          // No, await is safer to prevent DB saturation, but we can catch errors.
          try {
            await db.markets.upsert({
              where: { id },
              update: { title, category, status, resolved_at },
              create: { id, title, category, status, created_at, resolved_at }
            });
            upsertCount++;
          } catch (e) {
            console.warn(`Failed to upsert market ${id}:`, e);
          }
        }
      }

      totalIngested += markets.length;
      offset += BATCH_SIZE;
      
      console.log(`ingestMarkets: Processed batch ${offset / BATCH_SIZE}, total ${totalIngested} markets.`);
      
      // Respect rate limits (Gamma API is generous but let's be safe)
      await new Promise(r => setTimeout(r, 200));

    } catch (err) {
      console.error(`ingestMarkets failed at offset ${offset}`, err);
      // Wait a bit and retry the loop? Or just break?
      // If it's a transient network error, maybe we should retry.
      // For now, break to avoid infinite error loops.
      break;
    }
  }
  
  console.log(`ingestMarkets: Completed. Total ingested: ${totalIngested}`);
}

// Helper to fetch a single market by ID (Token ID or Market ID) on demand
export async function fetchMarketDetails(id: string): Promise<string | null> {
  try {
     // Try querying specific market endpoint if possible
     // Gamma API: /markets/:id 
     // This only works if ID is a Gamma Market ID. 
     // If ID is a Token ID, we might need to search?
     // Gamma API supports ?clob_token_id=... ? No, doc says usually filter by id.
     // But let's try the generic /markets endpoint with a query param if supported, or just ID.
     
     // 1. Assume it might be a Market ID
     let url = `${env.POLYMARKET_MARKETS_URL}/${id}`;
     try {
       const data = await retryFetch(url, 1, 0); // 1 retry
       if (data && (data.title || data.question)) {
          const title = data.title || data.question;
          marketMap.set(id, title);
          // Async save to DB
          db.markets.create({
             data: { id, title, status: 'fetched_ondemand', created_at: new Date() }
          }).catch(() => {}); 
          return title;
       }
     } catch (e) {
       // Ignore 404
     }

     // 2. If it's a Token ID, we can't easily lookup unless there's a reverse lookup endpoint.
     // But usually we rely on the bulk ingest.
     return null;
  } catch (e) {
    return null;
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