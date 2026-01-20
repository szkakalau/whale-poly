import { PrismaClient } from '@prisma/client';

// Typed escape hatch for newly added Prisma models
const asDb = (client: PrismaClient) => client as any;

// V1 weights per PRD (0–10 scaled subscores)
const V1_WEIGHTS = {
  capitalImpact: 0.35,
  timingAdvantage: 0.25,
  historicalAccuracy: 0.20,
  marketImpact: 0.20
};

function clampHundred(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clampTen(n: number) {
  return Math.max(0, Math.min(10, Number.isFinite(n) ? Number(n.toFixed(2)) : 0));
}

function stdDev(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

export async function calculateScores(prisma: PrismaClient) {
  // Use last 24h as scoring window
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const trades = await prisma.trades_raw.findMany({ where: { timestamp: { gte: since } } });
  const byMarket = new Map<string, typeof trades>();
  for (const t of trades) {
    const arr = byMarket.get(t.market_id) || [];
    arr.push(t);
    byMarket.set(t.market_id, arr);
  }

  const byWalletMarket = new Map<string, typeof trades>();
  for (const t of trades) {
    const key = `${t.wallet}|${t.market_id}`;
    const arr = byWalletMarket.get(key) || [];
    arr.push(t);
    byWalletMarket.set(key, arr);
  }

  for (const [key, arr] of byWalletMarket) {
    const [wallet, market_id] = key.split('|');
    arr.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Gather context
    const profile = await prisma.whale_profiles.findUnique({ where: { wallet } });
    const marketTrades = byMarket.get(market_id) || [];
    marketTrades.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const lastTrade = arr[arr.length - 1];
    const lastTs = lastTrade?.timestamp ?? new Date();

    // Sub-score: Capital Impact (0–10)
    const windowStart = new Date(lastTs.getTime() - 10 * 60 * 1000);
    const eventTrades = arr.filter(t => t.timestamp >= windowStart && t.timestamp <= lastTs);
    const whaleTradeSizeUsd = eventTrades.reduce((s, t) => s + Number(t.amount), 0);
    const marketVol24hUsd = marketTrades.reduce((s, t) => s + Number(t.amount), 0);
    const capitalRatio = marketVol24hUsd ? whaleTradeSizeUsd / marketVol24hUsd : 0;
    const capitalImpactTen = clampTen(Math.log10(capitalRatio * 100 + 1) * 5);

    // Sub-score: Timing Advantage (0–10)
    const marketMeta = await asDb(prisma).markets.findUnique({ where: { id: market_id } });
    const createdAt = marketMeta?.created_at ?? marketTrades[0]?.timestamp ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const resolvedAt = marketMeta?.resolved_at ?? new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    const marketLifetimeMs = Math.max(1, resolvedAt.getTime() - createdAt.getTime());
    const elapsedMs = Math.max(0, lastTs.getTime() - createdAt.getTime());
    const rawTiming = 1 - (elapsedMs / marketLifetimeMs);
    let timingAdvantageTen = clampTen(rawTiming * 10);
    // Weighting rules
    const earliestTs = arr[0]?.timestamp ?? lastTs;
    const spanMs = lastTs.getTime() - earliestTs.getTime();
    const seventyTwoHours = 72 * 60 * 60 * 1000;
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (spanMs >= seventyTwoHours) timingAdvantageTen = clampTen(timingAdvantageTen + 1);
    else if (spanMs <= twentyFourHours) timingAdvantageTen = clampTen(timingAdvantageTen - 1);

    // Sub-score: Historical Accuracy (0–10)
    const winRate = profile ? Number(profile.win_rate) : 0; // 0–1
    const resolvedCount = profile ? Number(profile.markets_count) : 0;
    const sampleWeight = Math.log(resolvedCount + 1);
    let historicalAccuracyTen = clampTen(winRate * sampleWeight * 10);
    if (resolvedCount < 5) historicalAccuracyTen = Math.min(historicalAccuracyTen, 5);

    // Sub-score: Market Impact (0–10)
    const priceBefore = Number(lastTrade?.price ?? 0);
    // Approx price_after: average of trades 6h after event (if existent); fallback to same price
    const after6hStart = new Date(lastTs.getTime() + 6 * 60 * 60 * 1000);
    const after6hEnd = new Date(after6hStart.getTime() + 60 * 60 * 1000);
    const marketAfter = await prisma.trades_raw.findMany({ where: { market_id, timestamp: { gte: after6hStart, lte: after6hEnd } }, select: { price: true } });
    const priceAfter = marketAfter.length ? (marketAfter.reduce((s, t) => s + Number(t.price), 0) / marketAfter.length) : priceBefore;
    const prices24h = marketTrades.map(t => Number(t.price));
    const marketAvgVolatility = stdDev(prices24h);
    const priceMove = Math.abs(priceAfter - priceBefore);
    const impactRatio = marketAvgVolatility ? (priceMove / marketAvgVolatility) : 0;
    const marketImpactTen = clampTen(impactRatio * 5);

    // Aggregate Whale Score (0–10)
    const whaleScoreTen = clampTen(
      V1_WEIGHTS.capitalImpact * capitalImpactTen +
      V1_WEIGHTS.timingAdvantage * timingAdvantageTen +
      V1_WEIGHTS.historicalAccuracy * historicalAccuracyTen +
      V1_WEIGHTS.marketImpact * marketImpactTen
    );

    // Persist aggregate (internal 0–100 int)
    await prisma.whale_scores.create({
      data: {
        wallet,
        market_id,
        score: Math.round(whaleScoreTen * 10),
        calculated_at: new Date()
      }
    });

    // Persist subdimensions (store as 0–100 int converted from 0–10)
    await asDb(prisma).whale_scores_ext.create({
      data: {
        wallet,
        market_id,
        calculated_at: new Date(),
        capital_impact: clampHundred(capitalImpactTen * 10),
        timing_advantage: clampHundred(timingAdvantageTen * 10),
        historical_accuracy: clampHundred(historicalAccuracyTen * 10),
        market_impact: clampHundred(marketImpactTen * 10)
      }
    });
  }
}