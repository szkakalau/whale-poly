import { Router } from 'express';
import { prisma } from '../db/prisma';
import { getApiContext, paginate } from './auth';
// Typed escape hatch for newly added Prisma models (markets, etc.)
const db = prisma as any;

// Helper: convert 0–100 internal score to 0–10 public scale
function toTenScale(score: number) {
  return Math.round((score / 10) * 10) / 10; // one decimal
}

// Helper: parse number query param with default
function numParam(v: any, def: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// Helper: recent window trades aggregation for alert context
async function aggregateAlertContext(wallet: string, marketId: string, side?: string, around?: Date) {
  const since = new Date((around?.getTime() || Date.now()) - 10 * 60 * 1000); // 10m window
  const where: any = { wallet, market_id: marketId, timestamp: { gte: since } };
  if (side) where.side = side;
  const trades = await prisma.trades_raw.findMany({ where });
  const trade_count = trades.length;
  const total_size_usd = trades.reduce((s, t) => s + Number(t.amount), 0);
  const avg_price = trade_count ? trades.reduce((s, t) => s + Number(t.price), 0) / trade_count : 0;
  return { trade_count, total_size_usd, avg_price };
}

export const v1Router = Router();

// GET /api/v1/alerts/whale?since=timestamp&min_score=7.5
v1Router.get('/alerts/whale', async (req, res) => {
  try {
    const ctx = await getApiContext(req);
    const delayMs = ctx.delayMinutes * 60 * 1000;
    
    // History limits: Free=7d, Pro=30d, Elite=Unlimited
    const maxHistoryDays = ctx.tier === 'elite' ? 36500 : (ctx.tier === 'pro' ? 30 : 7);
    const minDate = new Date(Date.now() - maxHistoryDays * 24 * 60 * 60 * 1000);

    const requestedSince = req.query.since ? new Date(String(req.query.since)) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    // Ensure user doesn't go back further than plan allows
    const baseSince = requestedSince < minDate ? minDate : requestedSince;

    const sinceParam = new Date(baseSince.getTime() - delayMs);
    const minScoreTen = numParam(req.query.min_score, 0); // 0–10
    const minScoreHundred = Math.round(minScoreTen * 10);
    const limit = numParam(req.query.limit, ctx.resultLimit);
    const offset = numParam(req.query.offset, 0);

    const alertsAll = await prisma.alerts.findMany({ where: { created_at: { gte: sinceParam }, score: { gte: minScoreHundred } }, orderBy: { created_at: 'desc' } });
    const alerts = paginate(alertsAll, limit, offset);
    const results = [] as any[];
    for (const a of alerts) {
      const ctx = await aggregateAlertContext(a.wallet, a.market_id, undefined, a.created_at);
      const side = 'BUY'; // derive from context if needed; no side in alerts
      const outcome = side === 'BUY' ? 'YES' : 'NO';
      const marketMeta = await db.markets.findUnique({ where: { id: a.market_id } });
      results.push({
        alert_id: a.id,
        market_id: a.market_id,
        market_title: marketMeta?.title || '',
        outcome,
        side,
        total_size_usd: ctx.total_size_usd,
        avg_price: ctx.avg_price,
        trade_count: ctx.trade_count,
        address: a.wallet,
        whale_score: toTenScale(a.score),
        detected_at: a.created_at,
      });
    }
    res.json(results);
  } catch (err) {
    console.error('alerts/whale failed', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/v1/smart-money/addresses?min_win_rate=0.6&min_volume=500000
v1Router.get('/smart-money/addresses', async (req, res) => {
  try {
    const ctx = await getApiContext(req);
    if (ctx.tier === 'free') {
      return res.status(403).json({ error: 'Upgrade to Pro to access Smart Money Profiles' });
    }
    const minWinRate = numParam(req.query.min_win_rate, 0);
    const minVolume = numParam(req.query.min_volume, 0);
    const limit = numParam(req.query.limit, ctx.resultLimit);
    const offset = numParam(req.query.offset, 0);
    const profiles = await prisma.whale_profiles.findMany();
    const wallets = profiles.filter(p => Number(p.total_volume) >= minVolume && Number(p.win_rate) >= minWinRate && p.markets_count >= 10);
    const paged = paginate(wallets, limit, offset);
    const enriched = [] as any[];
    for (const p of paged) {
      const lastTrade = await prisma.trades_raw.findFirst({ where: { wallet: p.wallet }, orderBy: { timestamp: 'desc' } });
      // Preferred category from most traded market category
      const marketsForWallet = await prisma.trades_raw.findMany({ where: { wallet: p.wallet }, select: { market_id: true } });
      const marketIds = Array.from(new Set(marketsForWallet.map(m => m.market_id)));
      const metas = await db.markets.findMany({ where: { id: { in: marketIds } } });
      const catCounts = new Map<string, number>();
      for (const m of metas) {
        if (!m.category) continue;
        catCounts.set(m.category, (catCounts.get(m.category) || 0) + 1);
      }
      const preferredCategory = Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      // Avg entry time relative to market opening
      const firstTradeTimes: number[] = [];
      for (const mid of marketIds) {
        const mt = await db.markets.findUnique({ where: { id: mid } });
        const ft = await prisma.trades_raw.findFirst({ where: { wallet: p.wallet, market_id: mid }, orderBy: { timestamp: 'asc' } });
        if (mt?.created_at && ft?.timestamp) {
          firstTradeTimes.push(ft.timestamp.getTime() - mt.created_at.getTime());
        }
      }
      const avgEntryMs = firstTradeTimes.length ? Math.round(firstTradeTimes.reduce((s, n) => s + n, 0) / firstTradeTimes.length) : null;
      enriched.push({
        address: p.wallet,
        total_volume_usd: Number(p.total_volume),
        markets_participated: p.markets_count,
        win_rate: Number(p.win_rate),
        preferred_category: preferredCategory,
        avg_entry_time: avgEntryMs,
        last_active_at: lastTrade?.timestamp || null,
      });
    }
    res.json(enriched);
  } catch (err) {
    console.error('smart-money/addresses failed', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/v1/signals/conviction?min_score=7.5
v1Router.get('/signals/conviction', async (req, res) => {
  try {
    const ctx = await getApiContext(req);
    const minScoreTen = numParam(req.query.min_score, 7.5);
    const minScoreHundred = Math.round(minScoreTen * 10);
    const baseSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since = new Date(baseSince.getTime() - ctx.delayMinutes * 60 * 1000);
    const limit = numParam(req.query.limit, ctx.resultLimit);
    const offset = numParam(req.query.offset, 0);
    const alerts = await prisma.alerts.findMany({ where: { created_at: { gte: since }, score: { gte: minScoreHundred } } });

    // Smart money set per PRD
    const profiles = await prisma.whale_profiles.findMany();
    const smartSet = new Set(
      profiles
        .filter(p => Number(p.total_volume) >= 500000 && p.markets_count >= 10 && Number(p.win_rate) >= 0.6)
        .map(p => p.wallet)
    );

    // Group by market_id and outcome (approx via side mapping)
    const groups = new Map<string, { market_id: string; outcome: 'YES' | 'NO'; alerts: any[]; smartAddresses: Set<string> }>();
    for (const a of alerts) {
      // Approximate outcome from recent trades direction
      const ctxTrades = await prisma.trades_raw.findMany({ where: { wallet: a.wallet, market_id: a.market_id, timestamp: { gte: new Date(a.created_at.getTime() - 10 * 60 * 1000) } } });
      const buys = ctxTrades.filter(t => t.side === 'buy').length;
      const sells = ctxTrades.filter(t => t.side === 'sell').length;
      const outcome: 'YES' | 'NO' = buys >= sells ? 'YES' : 'NO';
      const key = `${a.market_id}|${outcome}`;
      const g = groups.get(key) || { market_id: a.market_id, outcome, alerts: [], smartAddresses: new Set<string>() };
      g.alerts.push(a);
      if (smartSet.has(a.wallet)) g.smartAddresses.add(a.wallet);
      groups.set(key, g);
    }

    const results = [] as any[];
    for (const [, g] of groups) {
      if (g.alerts.length < 2) continue; // at least 2 actions
      const avgScoreTen = g.alerts.reduce((s, a) => s + toTenScale(a.score), 0) / g.alerts.length;
      const supporting_addresses = g.smartAddresses.size;
      if (supporting_addresses < 1) continue;
      const conviction_score = Math.round((avgScoreTen + Math.min(2, g.alerts.length / 2)) * 10) / 10; // heuristic
      results.push({
        signal_id: `${g.market_id}-${g.outcome}-${Date.now()}`,
        market_id: g.market_id,
        outcome: g.outcome,
        conviction_score,
        supporting_addresses,
        first_detected_at: g.alerts.reduce((min, a) => (a.created_at < min ? a.created_at : min), g.alerts[0].created_at),
        last_updated_at: g.alerts.reduce((max, a) => (a.created_at > max ? a.created_at : max), g.alerts[0].created_at),
        explanation: `Consistent high-quality whale activity detected: ${g.alerts.length} alerts, ${supporting_addresses} smart addresses, avg score ${avgScoreTen.toFixed(1)}`
      });
    }
    res.json(paginate(results, limit, offset));
  } catch (err) {
    console.error('signals/conviction failed', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/v1/markets/whale-heatmap
v1Router.get('/markets/whale-heatmap', async (req, res) => {
  try {
    const ctx = await getApiContext(req);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const trades = await prisma.trades_raw.findMany({ where: { timestamp: { gte: since } } });

    // Smart money set per PRD
    const profiles = await prisma.whale_profiles.findMany();
    const smartSet = new Set(
      profiles
        .filter(p => Number(p.total_volume) >= 500000 && p.markets_count >= 10 && Number(p.win_rate) >= 0.6)
        .map(p => p.wallet)
    );

    const byMarket = new Map<string, typeof trades>();
    for (const t of trades) {
      const arr = byMarket.get(t.market_id) || [];
      arr.push(t);
      byMarket.set(t.market_id, arr);
    }

    const results = [] as any[];
    for (const [market_id, arr] of byMarket) {
      const total_volume_usd = arr.reduce((s, t) => s + Number(t.amount), 0);
      const whale_volume_usd = arr.filter(t => smartSet.has(t.wallet)).reduce((s, t) => s + Number(t.amount), 0);
      const whale_ratio = total_volume_usd ? whale_volume_usd / total_volume_usd : 0;
      const buys = arr.filter(t => t.side === 'buy').reduce((s, t) => s + Number(t.amount), 0);
      const sells = arr.filter(t => t.side === 'sell').reduce((s, t) => s + Number(t.amount), 0);
      const whale_net_flow = buys - sells;
      const trend = whale_net_flow > total_volume_usd * 0.02 ? 'UP' : (whale_net_flow < -total_volume_usd * 0.02 ? 'DOWN' : 'FLAT');
      results.push({ market_id, whale_volume_usd, total_volume_usd, whale_ratio, whale_net_flow, trend });
    }
    
    // Sort by volume descending
    results.sort((a, b) => b.total_volume_usd - a.total_volume_usd);

    let finalResults = results;
    if (ctx.tier === 'free') {
      finalResults = results.slice(0, 10);
    }

    const limit = numParam(req.query.limit, ctx.resultLimit);
    const offset = numParam(req.query.offset, 0);
    res.json(paginate(finalResults, limit, offset));
  } catch (err) {
    console.error('markets/whale-heatmap failed', err);
    res.status(500).json({ error: 'Server error' });
  }
});