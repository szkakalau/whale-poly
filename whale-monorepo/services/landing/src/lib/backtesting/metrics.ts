/**
 * Backtesting metrics — pure math functions.
 *
 * All functions are deterministic and testable without DB or network access.
 * They operate on arrays of numeric returns (decimal ROI per trade).
 */

// ── Types ──────────────────────────────────────────────

export type BacktestMetrics = {
  accuracy: number;          // % of correct directional predictions
  precision: number;         // TP / (TP + FP)
  recall: number;            // TP / (TP + FN)
  winRate: number;           // % of trades with positive ROI
  avgRoi: number;            // mean ROI per trade
  medianRoi: number;         // median ROI
  totalPnl: number;          // sum of all PnL
  sharpeRatio: number | null; // annualised Sharpe (risk-free = 0)
  maxDrawdown: number | null; // max peak-to-trough
  profitFactor: number;      // gross profit / |gross loss|
  avgHoldingDays: number;    // average days from entry to settlement
};

// ── Helpers ────────────────────────────────────────────

/** Clamp to [lo, hi]. */
function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

// ── Metric functions ───────────────────────────────────

/**
 * Accuracy = correct predictions / total resolved.
 * `correct` is a boolean array (true = direction was right).
 */
export function computeAccuracy(correct: boolean[]): number {
  if (correct.length === 0) return 0;
  return correct.filter(Boolean).length / correct.length;
}

/**
 * Precision = TP / (TP + FP).
 * Here TP = predicted bullish AND actually bullish (positive ROI).
 * FP = predicted bullish AND actually bearish (negative ROI).
 */
export function computePrecision(
  predictedBullish: boolean[],
  actuallyPositive: boolean[],
): number {
  let tp = 0;
  let fp = 0;
  for (let i = 0; i < predictedBullish.length; i++) {
    if (predictedBullish[i] && actuallyPositive[i]) tp++;
    if (predictedBullish[i] && !actuallyPositive[i]) fp++;
  }
  const denom = tp + fp;
  return denom === 0 ? 0 : tp / denom;
}

/**
 * Recall = TP / (TP + FN).
 */
export function computeRecall(
  predictedBullish: boolean[],
  actuallyPositive: boolean[],
): number {
  let tp = 0;
  let fn = 0;
  for (let i = 0; i < predictedBullish.length; i++) {
    if (predictedBullish[i] && actuallyPositive[i]) tp++;
    if (!predictedBullish[i] && actuallyPositive[i]) fn++;
  }
  const denom = tp + fn;
  return denom === 0 ? 0 : tp / denom;
}

/** Win rate = fraction of trades with positive ROI. */
export function computeWinRate(returns: number[]): number {
  if (returns.length === 0) return 0;
  return returns.filter(r => r > 0).length / returns.length;
}

/** Average ROI. */
export function computeAvgRoi(returns: number[]): number {
  if (returns.length === 0) return 0;
  return returns.reduce((s, r) => s + r, 0) / returns.length;
}

/** Median ROI. */
export function computeMedianRoi(returns: number[]): number {
  if (returns.length === 0) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Total PnL (sum of returns, assumes returns are already in USD). */
export function computeTotalPnl(pnls: number[]): number {
  return pnls.reduce((s, p) => s + p, 0);
}

/**
 * Annualised Sharpe ratio.
 * Assumes returns are decimal per-trade returns.
 * riskFreeRate is annual (default 0 for prediction markets — no risk-free alternative).
 * tradingDaysPerYear defaults to 365 (markets trade every day).
 */
export function computeSharpeRatio(
  returns: number[],
  riskFreeRate = 0,
  tradingDaysPerYear = 365,
): number | null {
  if (returns.length < 2) return null;
  const mean = computeAvgRoi(returns);
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  if (variance < 1e-15) return null;  // epsilon — floating point can leave tiny residues
  const dailySharpe = (mean - riskFreeRate / tradingDaysPerYear) / Math.sqrt(variance);
  return dailySharpe * Math.sqrt(tradingDaysPerYear);
}

/**
 * Max drawdown from a sequence of cumulative PnL values.
 * Returns fraction (0-1) of peak-to-trough.
 */
export function computeMaxDrawdown(cumulativePnl: number[]): number | null {
  if (cumulativePnl.length < 2) return null;
  let peak = cumulativePnl[0];
  let maxDD = 0;
  for (const v of cumulativePnl) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? (peak - v) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

/** Profit factor = gross profit / |gross loss|. */
export function computeProfitFactor(returns: number[]): number {
  let grossProfit = 0;
  let grossLoss = 0;
  for (const r of returns) {
    if (r > 0) grossProfit += r;
    else grossLoss += Math.abs(r);
  }
  if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
  return grossProfit / grossLoss;
}

/**
 * Compute all metrics from raw trade outcomes.
 *
 * @param returns - decimal ROI per trade
 * @param predictedBullish - whether each trade was predicted bullish
 * @param pnls - USD PnL per trade (same length as returns)
 * @param holdingDays - days from entry to settlement per trade
 */
export function computeAllMetrics(
  returns: number[],
  predictedBullish: boolean[],
  pnls: number[],
  holdingDays: number[],
): BacktestMetrics {
  const actuallyPositive = returns.map(r => r > 0);
  const correct = returns.map((_r, i) => predictedBullish[i] === actuallyPositive[i]);

  const cumulative = pnls.reduce<number[]>((acc, p) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : 0;
    acc.push(prev + p);
    return acc;
  }, []);

  return {
    accuracy: computeAccuracy(correct),
    precision: computePrecision(predictedBullish, actuallyPositive),
    recall: computeRecall(predictedBullish, actuallyPositive),
    winRate: computeWinRate(returns),
    avgRoi: computeAvgRoi(returns),
    medianRoi: computeMedianRoi(returns),
    totalPnl: computeTotalPnl(pnls),
    sharpeRatio: computeSharpeRatio(returns),
    maxDrawdown: computeMaxDrawdown(cumulative),
    profitFactor: computeProfitFactor(returns),
    avgHoldingDays: holdingDays.length > 0
      ? holdingDays.reduce((s, d) => s + d, 0) / holdingDays.length
      : 0,
  };
}

// ── Baseline Comparisons ───────────────────────────────

export type BaselineComparison = {
  signalWinRate: number;
  randomBaseline: number;      // 0.50 for binary markets
  signalVsRandom: number;      // signalWinRate - randomBaseline
  signalAvgRoi: number;
  buyAndHoldRoi: number | null; // if every trade was BUY YES
};

export function computeBaselines(
  returns: number[],
  winRate: number,
  avgRoi: number,
): BaselineComparison {
  return {
    signalWinRate: winRate,
    randomBaseline: 0.5,
    signalVsRandom: winRate - 0.5,
    signalAvgRoi: avgRoi,
    buyAndHoldRoi: returns.length > 0 ? computeAvgRoi(returns) : null,
  };
}

// ── Tier Breakdown ─────────────────────────────────────

export type TierSummary = {
  tier: string;
  count: number;
  winRate: number;
  avgRoi: number;
  sharpeRatio: number | null;
};

/**
 * Group returns by score tier and compute per-tier metrics.
 */
export function computeTierBreakdown(
  tiers: string[],
  returns: number[],
): TierSummary[] {
  const groups = new Map<string, number[]>();
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t)!.push(returns[i] ?? 0);
  }

  return Array.from(groups.entries())
    .map(([tier, rets]) => ({
      tier,
      count: rets.length,
      winRate: computeWinRate(rets),
      avgRoi: computeAvgRoi(rets),
      sharpeRatio: computeSharpeRatio(rets),
    }))
    .sort((a, b) => {
      // Sort by tier numerically when possible
      const aNum = parseInt(a.tier, 10);
      const bNum = parseInt(b.tier, 10);
      if (!isNaN(aNum) && !isNaN(bNum)) return bNum - aNum;
      return a.tier.localeCompare(b.tier);
    });
}

// ── Walk-forward folds ─────────────────────────────────

export type WalkForwardFold = {
  trainIndices: number[];
  testIndices: number[];
};

/**
 * Create walk-forward folds from a time-sorted array of dates.
 *
 * @param dates - ISO date strings sorted ascending
 * @param trainDays - days in each training window
 * @param testDays - days in each test window
 * @param stepDays - how many days to advance per fold
 * @param minTestTrades - minimum trades required in test set
 */
export function createWalkForwardFolds(
  dates: string[],
  trainDays = 60,
  testDays = 30,
  stepDays = 30,
  minTestTrades = 10,
): WalkForwardFold[] {
  if (dates.length === 0) return [];

  const timestamps = dates.map(d => new Date(d).getTime());
  const start = Math.min(...timestamps);
  const end = Math.max(...timestamps);
  const msPerDay = 86_400_000;

  const folds: WalkForwardFold[] = [];
  let foldStart = start;

  while (foldStart + (trainDays + testDays) * msPerDay <= end) {
    const trainEnd = foldStart + trainDays * msPerDay;
    const testEnd = trainEnd + testDays * msPerDay;

    const trainIndices: number[] = [];
    const testIndices: number[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      if (timestamps[i] < trainEnd) trainIndices.push(i);
      else if (timestamps[i] < testEnd) testIndices.push(i);
    }

    if (testIndices.length >= minTestTrades && trainIndices.length >= minTestTrades) {
      folds.push({ trainIndices, testIndices });
    }

    foldStart += stepDays * msPerDay;
  }

  return folds;
}
