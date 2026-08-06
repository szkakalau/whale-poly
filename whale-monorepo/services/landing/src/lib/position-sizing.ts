/**
 * Position Sizing — Kelly Criterion
 *
 * Computes optimal position size based on historical edge estimation.
 * Uses the Kelly formula: f* = p - (1-p) / (W/L)
 *
 * Elite-tier feature — gated via plans.ts.
 */

// ── Types ──────────────────────────────────────────────

export type KellyResult = {
  winProbability: number;        // p — historical win rate (0-1)
  avgWinRoi: number;             // W — average ROI when winning (decimal)
  avgLossRoi: number;            // L — absolute average ROI when losing (decimal)
  winLossRatio: number;          // W / L
  kellyFraction: number;         // f* = p - (1-p)/(W/L)
  halfKellyFraction: number;     // f*/2 (recommended conservative)
  quarterKellyFraction: number;  // f*/4 (very conservative)
  recommendedFraction: number;   // final recommendation
  edge: number;                  // estimated edge per trade
  sampleSize: number;            // number of historical trades used
  confidence: 'high' | 'medium' | 'low';
  suggestion: string;            // human-readable recommendation
};

// ── Constants ──────────────────────────────────────────

const MAX_POSITION_FRACTION = 0.25;   // cap at 25% of bankroll
const MIN_SAMPLE_SIZE = 5;             // minimum trades for Kelly
const CONFIDENT_SAMPLE_SIZE = 30;      // threshold for full confidence

// ── Core Kelly ─────────────────────────────────────────

/**
 * Compute the Kelly fraction and derived values.
 *
 * @param winRate - historical win rate (0-1)
 * @param avgWinRoi - average ROI of winning trades (decimal, e.g. 0.25 = +25%)
 * @param avgLossRoi - average absolute ROI of losing trades (decimal, e.g. 0.15 = -15%)
 * @param sampleSize - number of trades backing these statistics
 */
export function computeKelly(
  winRate: number,
  avgWinRoi: number,
  avgLossRoi: number,
  sampleSize: number,
): KellyResult {
  const p = Math.max(0, Math.min(1, winRate));
  const W = Math.max(0.001, avgWinRoi);
  const L = Math.max(0.001, avgLossRoi);
  const b = W / L; // win/loss ratio

  // Kelly formula
  let kelly = p - (1 - p) / b;

  // Edge estimation: how much we expect to gain per dollar risked
  const edge = p * W - (1 - p) * L;

  // Conservative adjustments
  const halfKelly = kelly / 2;
  const quarterKelly = kelly / 4;

  // Recommendation logic
  let recommendedFraction: number;
  let confidence: KellyResult['confidence'];
  let suggestion: string;

  if (sampleSize < MIN_SAMPLE_SIZE) {
    // Insufficient data — conservative fixed sizing
    recommendedFraction = 0.02;
    confidence = 'low';
    suggestion = '历史数据不足（< 5 笔交易），使用保守的 2% 固定仓位。';
  } else if (kelly <= 0 || edge <= 0) {
    // No edge — minimum sizing or skip
    recommendedFraction = 0;
    confidence = sampleSize >= CONFIDENT_SAMPLE_SIZE ? 'high' : 'medium';
    suggestion = '当前信号缺乏统计优势（Kelly ≤ 0），建议观望或使用极小额 (< 1%) 试探。';
  } else if (sampleSize < CONFIDENT_SAMPLE_SIZE) {
    // Moderate data — use quarter Kelly
    recommendedFraction = clamp(quarterKelly, 0, MAX_POSITION_FRACTION);
    confidence = 'medium';
    suggestion = `数据量中等（${sampleSize} 笔），使用 Quarter-Kelly (${(recommendedFraction * 100).toFixed(1)}%) 以降低估计误差风险。`;
  } else if (p > 0.70) {
    // Very high win rate — cap to prevent overconfidence
    recommendedFraction = clamp(Math.min(halfKelly, 0.20), 0, MAX_POSITION_FRACTION);
    confidence = 'high';
    suggestion = `高胜率信号（${(p * 100).toFixed(0)}%），但由于参数不确定性，仓位上限为 ${(recommendedFraction * 100).toFixed(1)}%。`;
  } else {
    // Normal case — Half Kelly
    recommendedFraction = clamp(halfKelly, 0, MAX_POSITION_FRACTION);
    confidence = 'high';
    suggestion = `基于 ${sampleSize} 笔历史交易，推荐 Half-Kelly 仓位 ${(recommendedFraction * 100).toFixed(1)}% (Full Kelly = ${(kelly * 100).toFixed(1)}%)。`;
  }

  return {
    winProbability: Math.round(p * 1000) / 1000,
    avgWinRoi: Math.round(W * 1000) / 1000,
    avgLossRoi: Math.round(L * 1000) / 1000,
    winLossRatio: Math.round(b * 100) / 100,
    kellyFraction: Math.round(kelly * 10000) / 10000,
    halfKellyFraction: Math.round(halfKelly * 10000) / 10000,
    quarterKellyFraction: Math.round(quarterKelly * 10000) / 10000,
    recommendedFraction: Math.round(recommendedFraction * 10000) / 10000,
    edge: Math.round(edge * 10000) / 10000,
    sampleSize,
    confidence,
    suggestion,
  };
}

/** Clamp to [lo, hi]. */
function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

// ── Convenience: compute from tier summary ─────────────

export type TierStats = {
  tier: string;
  count: number;
  winRate: number | null;
  avgRoi: number | null;
};

/**
 * Compute Kelly sizing from a set of tier statistics.
 * Uses the matching tier, falling back to the broadest tier if not found.
 */
export function kellyFromTiers(
  score: number,
  tiers: TierStats[],
): KellyResult {
  // Map score to tier label
  let tierLabel: string;
  if (score >= 90) tierLabel = '90–100';
  else if (score >= 80) tierLabel = '80–89';
  else if (score >= 70) tierLabel = '70–79';
  else tierLabel = '<70';

  // Find matching tier
  let tier = tiers.find(t => t.tier === tierLabel);

  // Fallback: use all tiers combined
  if (!tier || tier.winRate == null) {
    // Aggregate all tiers
    const totalCount = tiers.reduce((s, t) => s + t.count, 0);
    const totalWinRate = totalCount > 0
      ? tiers.reduce((s, t) => s + (t.winRate ?? 0) * t.count, 0) / totalCount
      : null;
    const totalAvgRoi = totalCount > 0
      ? tiers.reduce((s, t) => s + (t.avgRoi ?? 0) * t.count, 0) / totalCount
      : null;

    if (totalWinRate == null || totalAvgRoi == null || totalCount < MIN_SAMPLE_SIZE) {
      return computeKelly(0.5, 0.1, 0.1, 0);
    }

    // Decompose avgRoi into avgWinRoi and avgLossRoi
    // Approximation: assume symmetric distribution around avgRoi
    const estAvgWin = totalAvgRoi > 0 ? totalAvgRoi * 1.5 : 0.1;
    const estAvgLoss = totalAvgRoi > 0 ? totalAvgRoi * 0.5 : 0.1;

    return computeKelly(totalWinRate, estAvgWin, estAvgLoss, totalCount);
  }

  // Decompose tier-level avgRoi
  const avgRoi = tier.avgRoi ?? 0;
  const estAvgWin = avgRoi > 0 ? avgRoi * 1.5 : 0.1;
  const estAvgLoss = avgRoi > 0 ? Math.abs(avgRoi) * 0.5 : 0.1;

  return computeKelly(tier.winRate, estAvgWin, estAvgLoss, tier.count);
}
