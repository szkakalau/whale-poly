import { PrismaClient } from '@prisma/client';

export async function updateWhaleProfiles(prisma: PrismaClient) {
  // Aggregate per wallet metrics
  const wallets = await prisma.trades_raw.groupBy({ by: ['wallet'] });
  for (const w of wallets) {
    const wallet = w.wallet;
    const trades = await prisma.trades_raw.findMany({ where: { wallet } });
    if (!trades.length) continue;

    const totalVolume = trades.reduce((sum, t) => sum + Number(t.amount), 0);
    const avgSize = totalVolume / trades.length;

    // Markets count
    const marketsSet = new Set(trades.map(t => t.market_id));
    const marketsCount = marketsSet.size;

    // Approx win rate:
    // For each market, if average sell price > average buy price -> win.
    let wins = 0;
    for (const m of marketsSet) {
      const mTrades = trades.filter(t => t.market_id === m);
      const buys = mTrades.filter(t => t.side === 'buy');
      const sells = mTrades.filter(t => t.side === 'sell');
      const avgBuy = buys.length ? buys.reduce((s, t) => s + Number(t.price), 0) / buys.length : 0;
      const avgSell = sells.length ? sells.reduce((s, t) => s + Number(t.price), 0) / sells.length : 0;
      if (avgSell > avgBuy && sells.length && buys.length) wins += 1;
    }
    const winRate = marketsCount ? wins / marketsCount : 0;

    await prisma.whale_profiles.upsert({
      where: { wallet },
      update: {
        total_volume: totalVolume,
        win_rate: winRate,
        avg_size: avgSize,
        markets_count: marketsCount
      },
      create: {
        wallet,
        total_volume: totalVolume,
        win_rate: winRate,
        avg_size: avgSize,
        markets_count: marketsCount
      }
    });
  }
}