/**
 * Lightweight analytics for the /analyze decision engine.
 *
 * Tracks: queries, success rate, market popularity, source, latency.
 * Logs structured JSON to stdout (consumed by Vercel/Render log drains).
 * Aggregated stats available via GET /api/analyze/stats.
 */

type AnalyzeEvent = {
  event: 'analyze_query';
  ts: string;
  query: string;
  matched: boolean;
  matchMethod?: string;
  marketSlug?: string;
  direction?: string;
  confidenceScore?: number;
  durationMs: number;
  source: 'telegram' | 'web' | 'api';
  userId?: string;
  error?: string;
};

// In-memory aggregate counters (reset on cold start — acceptable for prototype)
const counters = {
  total: 0,
  success: 0,
  fail: 0,
  byDirection: { bullish: 0, bearish: 0, neutral: 0, mixed: 0 } as Record<string, number>,
  topMarkets: new Map<string, number>(),
  totalDurationMs: 0,
};

export function logAnalyzeQuery(event: Omit<AnalyzeEvent, 'event' | 'ts'>) {
  const entry: AnalyzeEvent = {
    event: 'analyze_query',
    ts: new Date().toISOString(),
    ...event,
  };

  // Structured log line — readable by log drains
  console.log(JSON.stringify(entry));

  // Update counters
  counters.total++;
  if (entry.matched && entry.marketSlug) {
    counters.success++;
    if (entry.direction && counters.byDirection[entry.direction] !== undefined) {
      counters.byDirection[entry.direction]++;
    }
    const slug = entry.marketSlug;
    counters.topMarkets.set(slug, (counters.topMarkets.get(slug) || 0) + 1);
  } else {
    counters.fail++;
  }
  counters.totalDurationMs += entry.durationMs;
}

export function getAnalyzeStats() {
  const topMarkets = [...counters.topMarkets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([slug, count]) => ({ slug, count }));

  return {
    total: counters.total,
    success: counters.success,
    fail: counters.fail,
    successRate: counters.total > 0 ? (counters.success / counters.total * 100).toFixed(1) + '%' : '0%',
    avgDurationMs: counters.total > 0 ? Math.round(counters.totalDurationMs / counters.total) : 0,
    byDirection: counters.byDirection,
    topMarkets,
  };
}
