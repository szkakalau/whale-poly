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

    // Whale identification conditions (PRD MVP)
    // 单笔大额: size_usd ≥ 50,000
    const singleLarge = arr.some(t => Number(t.amount) >= 50000);
    // 拆单行为: 10 分钟内同方向 ≥ 3 笔
    const within10m = arr.filter(t => t.timestamp.getTime() >= Date.now() - 10 * 60 * 1000);
    const buys10m = within10m.filter(t => t.side === 'buy');
    const sells10m = within10m.filter(t => t.side === 'sell');
    const splitBuild = buys10m.length >= 3 || sells10m.length >= 3;
    const whale = singleLarge || splitBuild;
    if (!whale) continue;

    // Behavior: Position Build (10m window >=3 same-direction trades)
    const buys = buys10m;
    const sells = sells10m;
    if (buys.length >= 3) {
      const last = buys[buys.length - 1];
      alerts.push({ wallet, market_id, type: 'build', scoreHint: 80, amount: Number(last.amount), side: 'buy' });
    }
    if (sells.length >= 3) {
      const last = sells[sells.length - 1];
      alerts.push({ wallet, market_id, type: 'build', scoreHint: 80, amount: Number(last.amount), side: 'sell' });
    }

    // Behavior: Exit (significant position reduction)
    const buyVol = buys.reduce((s, t) => s + Number(t.amount), 0);
    const recentSellVol = sells.filter(t => t.timestamp.getTime() >= Date.now() - 60 * 60 * 1000)
      .reduce((s, t) => s + Number(t.amount), 0);
    if (buyVol > 0 && recentSellVol >= 0.5 * buyVol) {
      const lastSell = sells[sells.length - 1];
      if (lastSell) alerts.push({ wallet, market_id, type: 'exit', scoreHint: 85, amount: Number(lastSell.amount), side: 'sell' });
    }

    // Behavior: Spike (abnormal volume in short window)
    const marketTrades = byMarket.get(market_id) || [];
    const window5m = marketTrades.filter(t => t.timestamp.getTime() >= Date.now() - 5 * 60 * 1000);
    const vol5m = window5m.reduce((s, t) => s + Number(t.amount), 0);
    const avgVol = marketTrades.length ? marketTrades.reduce((s, t) => s + Number(t.amount), 0) / marketTrades.length : 0;
    if (vol5m > 3 * avgVol && window5m.some(t => t.wallet === wallet)) {
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