import { PrismaClient } from '@prisma/client';

// Backtest V1: approximate price moves using trades_raw
// Time windows: T+6h / T+24h / T+72h
// Group metrics by Whale Score buckets: [0,4), [4,6), [6,8), [8,10]

type Bucket = '0-4' | '4-6' | '6-8' | '8-10';

function toTenScale(scoreHundred: number): number { return Math.round(scoreHundred) / 10; }

function bucketFor(scoreTen: number): Bucket {
  if (scoreTen < 4) return '0-4';
  if (scoreTen < 6) return '4-6';
  if (scoreTen < 8) return '6-8';
  return '8-10';
}

async function priceAtWindow(prisma: PrismaClient, market_id: string, base: Date, offsetHours: number, sampleMinutes = 60) {
  const start = new Date(base.getTime() + offsetHours * 60 * 60 * 1000);
  const end = new Date(start.getTime() + sampleMinutes * 60 * 1000);
  const trades = await prisma.trades_raw.findMany({ where: { market_id, timestamp: { gte: start, lte: end } }, select: { price: true } });
  if (!trades.length) return null;
  const avg = trades.reduce((s, t) => s + Number(t.price), 0) / trades.length;
  return avg;
}

async function lastPriceBefore(prisma: PrismaClient, market_id: string, base: Date) {
  const t = await prisma.trades_raw.findFirst({ where: { market_id, timestamp: { lte: base } }, orderBy: { timestamp: 'desc' } });
  return t ? Number(t.price) : null;
}

async function main() {
  const prisma = new PrismaClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // last 30d
  const alerts = await prisma.alerts.findMany({ where: { created_at: { gte: since } } });
  if (!alerts.length) {
    console.log('No alerts found in the last 30 days. Populate data to run backtest.');
    process.exit(0);
  }

  const stats: Record<Bucket, { count: number; moves6h: number[]; moves24h: number[]; moves72h: number[]; }> = {
    '0-4': { count: 0, moves6h: [], moves24h: [], moves72h: [] },
    '4-6': { count: 0, moves6h: [], moves24h: [], moves72h: [] },
    '6-8': { count: 0, moves6h: [], moves24h: [], moves72h: [] },
    '8-10': { count: 0, moves6h: [], moves24h: [], moves72h: [] },
  };

  for (const a of alerts) {
    const scoreTen = toTenScale(a.score);
    const bucket = bucketFor(scoreTen);
    const base = a.created_at;
    const before = await lastPriceBefore(prisma, a.market_id, base);
    if (before == null) continue;
    const p6 = await priceAtWindow(prisma, a.market_id, base, 6);
    const p24 = await priceAtWindow(prisma, a.market_id, base, 24);
    const p72 = await priceAtWindow(prisma, a.market_id, base, 72);
    const s = stats[bucket];
    s.count += 1;
    if (p6 != null) s.moves6h.push(p6 - before);
    if (p24 != null) s.moves24h.push(p24 - before);
    if (p72 != null) s.moves72h.push(p72 - before);
  }

  function mean(xs: number[]) { return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0; }
  function std(xs: number[]) {
    if (!xs.length) return 0;
    const m = mean(xs);
    const v = xs.reduce((s, v) => s + (v - m) * (v - m), 0) / xs.length;
    return Math.sqrt(v);
  }

  console.log('Backtest V1 — Whale Score buckets');
  for (const b of ['0-4','4-6','6-8','8-10'] as Bucket[]) {
    const s = stats[b];
    const avg6 = mean(s.moves6h), avg24 = mean(s.moves24h), avg72 = mean(s.moves72h);
    const sharpe6 = std(s.moves6h) ? avg6 / std(s.moves6h) : 0;
    const sharpe24 = std(s.moves24h) ? avg24 / std(s.moves24h) : 0;
    const sharpe72 = std(s.moves72h) ? avg72 / std(s.moves72h) : 0;
    const dd6 = s.moves6h.length ? Math.min(...s.moves6h) : 0;
    const dd24 = s.moves24h.length ? Math.min(...s.moves24h) : 0;
    const dd72 = s.moves72h.length ? Math.min(...s.moves72h) : 0;
    console.log(`${b} | samples=${s.count} | AvgMove(6/24/72h)=${avg6.toFixed(4)}/${avg24.toFixed(4)}/${avg72.toFixed(4)} | IR(6/24/72)=${sharpe6.toFixed(3)}/${sharpe24.toFixed(3)}/${sharpe72.toFixed(3)} | Drawdown(6/24/72)=${dd6.toFixed(4)}/${dd24.toFixed(4)}/${dd72.toFixed(4)}`);
  }

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });