import { PrismaClient } from '@prisma/client';

export type BehaviorType = 'build' | 'spike' | 'exit';

export async function detectWhales(prisma: PrismaClient) {
  const since = new Date(Date.now() - 60 * 60 * 1000); // last 1h window for detection
  const trades = await prisma.trades_raw.findMany({ where: { timestamp: { gte: since } } });
  const byWalletMarket = new Map<string, typeof trades>();
  for (const t of trades) {
    const key = `${t.wallet}|${t.market_id}`;
    const arr = byWalletMarket.get(key) || [];
    arr.push(t);
    byWalletMarket.set(key, arr);
  }

  const alerts: { wallet: string; market_id: string; type: BehaviorType; scoreHint: number; amount: number; side: 'buy' | 'sell' }[] = [];

  // Spike detection requires market-level volume context
  const byMarket = new Map<string, typeof trades>();
  for (const t of trades) {
    const arr = byMarket.get(t.market_id) || [];
    arr.push(t);
    byMarket.set(t.market_id, arr);
  }

  for (const [key, arr] of byWalletMarket) {
    arr.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const [wallet, market_id] = key.split('|');

    // Whale identification conditions (Revised for Noise Reduction)
    // 1. Single Large Trade: Value ≥ $10,000 (was 50k shares)
    const singleLarge = arr.some(t => (Number(t.amount) * Number(t.price)) >= 10000);
    
    // 2. Split Build/Sell: ≥ 3 trades in 10m AND Total Value ≥ $5,000
    const within10m = arr.filter(t => t.timestamp.getTime() >= Date.now() - 10 * 60 * 1000);
    const buys10m = within10m.filter(t => t.side === 'buy');
    const sells10m = within10m.filter(t => t.side === 'sell');
    
    const buyVal10m = buys10m.reduce((s, t) => s + (Number(t.amount) * Number(t.price)), 0);
    const sellVal10m = sells10m.reduce((s, t) => s + (Number(t.amount) * Number(t.price)), 0);

    const splitBuild = (buys10m.length >= 3 && buyVal10m >= 5000) || 
                       (sells10m.length >= 3 && sellVal10m >= 5000);

    const whale = singleLarge || splitBuild;
    if (!whale) continue;

    // Behavior: Position Build (10m window >=3 trades + >$5k vol)
    if (buys10m.length >= 3 && buyVal10m >= 5000) {
      const last = buys10m[buys10m.length - 1];
      alerts.push({ wallet, market_id, type: 'build', scoreHint: 80, amount: Number(last.amount), side: 'buy' });
    }
    if (sells10m.length >= 3 && sellVal10m >= 5000) {
      const last = sells10m[sells10m.length - 1];
      alerts.push({ wallet, market_id, type: 'build', scoreHint: 80, amount: Number(last.amount), side: 'sell' });
    }

    // Behavior: Exit (significant position reduction > 50% of recent buy vol)
    // Constraint: Exit volume must be meaningful (e.g. > $1000) to avoid noise
    const buyVol = buys10m.reduce((s, t) => s + Number(t.amount), 0); // Share volume for ratio
    const recentSellVol = sells10m.reduce((s, t) => s + Number(t.amount), 0);
    
    if (buyVol > 0 && recentSellVol >= 0.5 * buyVol && sellVal10m >= 1000) {
      const lastSell = sells10m[sells10m.length - 1];
      if (lastSell) alerts.push({ wallet, market_id, type: 'exit', scoreHint: 85, amount: Number(lastSell.amount), side: 'sell' });
    }

    // Behavior: Spike (abnormal volume in short window)
    const marketTrades = byMarket.get(market_id) || [];
    const window5m = marketTrades.filter(t => t.timestamp.getTime() >= Date.now() - 5 * 60 * 1000);
    
    // Calculate USD Volume for spike threshold
    const vol5mUsd = window5m.reduce((s, t) => s + (Number(t.amount) * Number(t.price)), 0);
    const avgVolUsd = marketTrades.length ? marketTrades.reduce((s, t) => s + (Number(t.amount) * Number(t.price)), 0) / (marketTrades.length / 50) : 0; // Rough avg per batch? 
    // Better avg: total volume / (time range in minutes / 5) -> 5m avg. 
    // Simplified: compare to average of last hour? 
    // Let's stick to relative volume but enforce a USD floor.
    
    const marketTotalUsd = marketTrades.reduce((s, t) => s + (Number(t.amount) * Number(t.price)), 0);
    // Average 5m volume = Total Volume / (Duration / 5m)
    const durationMs = marketTrades.length > 1 ? (marketTrades[marketTrades.length - 1].timestamp.getTime() - marketTrades[0].timestamp.getTime()) : 1;
    const duration5mChunks = Math.max(1, durationMs / (5 * 60 * 1000));
    const avg5mUsd = marketTotalUsd / duration5mChunks;

    if (vol5mUsd > 3 * avg5mUsd && vol5mUsd >= 5000 && window5m.some(t => t.wallet === wallet)) {
      const last = window5m.filter(t => t.wallet === wallet).pop();
      if (last) alerts.push({ wallet, market_id, type: 'spike', scoreHint: 82, amount: Number(last.amount), side: last.side as 'buy' | 'sell' });
    }

    // Behavior: Depth shock (PRD: consume ≥25% orderbook depth)
    // Use latest snapshot for outcome inferred by side
    const sideOutcome = buys10m.length >= sells10m.length ? 'YES' : 'NO';
    const latestSnap = await prisma.orderbook_snapshots.findFirst({
      where: { market_id, outcome_label: sideOutcome },
      orderBy: { timestamp: 'desc' }
    });
    if (latestSnap) {
      const depth = Number(latestSnap.total_depth_usd);
      const lastTrade = arr[arr.length - 1];
      const amt = Number(lastTrade?.amount || 0);
      if (depth > 0 && amt >= 0.25 * depth) {
        alerts.push({ wallet, market_id, type: 'spike', scoreHint: 88, amount: amt, side: lastTrade?.side as 'buy' | 'sell' });
      }
    }
  }

  // Persist alerts to database
  for (const alert of alerts) {
    // Deduplication: Check if similar alert exists in last 30 mins
    const existing = await prisma.alerts.findFirst({
      where: {
        wallet: alert.wallet,
        market_id: alert.market_id,
        alert_type: alert.type,
        created_at: { gte: new Date(Date.now() - 30 * 60 * 1000) }
      }
    });

    if (!existing) {
      await prisma.alerts.create({
        data: {
          wallet: alert.wallet,
          market_id: alert.market_id,
          alert_type: alert.type,
          score: alert.scoreHint,
          amount: alert.amount,
          side: alert.side,
          created_at: new Date()
        }
      });
      console.log(`Generated alert: ${alert.type} for ${alert.wallet} on ${alert.market_id}`);
    }
  }

  return alerts;
}