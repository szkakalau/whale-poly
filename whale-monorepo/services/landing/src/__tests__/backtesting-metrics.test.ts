/**
 * Unit tests for backtesting/metrics.ts
 *
 * Pure math functions — no DB dependency.
 * Covers: computeAccuracy, computePrecision, computeRecall, computeWinRate,
 * computeAvgRoi, computeSharpeRatio, computeMaxDrawdown, computeProfitFactor,
 * computeBaselines, createWalkForwardFolds, computeTierBreakdown.
 */

import { describe, it, expect } from 'vitest';
import {
  computeAccuracy,
  computePrecision,
  computeRecall,
  computeWinRate,
  computeAvgRoi,
  computeMedianRoi,
  computeSharpeRatio,
  computeMaxDrawdown,
  computeProfitFactor,
  computeAllMetrics,
  computeBaselines,
  computeTierBreakdown,
  createWalkForwardFolds,
} from '@/lib/backtesting/metrics';

// ── computeAccuracy ───────────────────────────────────

describe('computeAccuracy', () => {
  it('should return 1.0 for all correct predictions', () => {
    expect(computeAccuracy([true, true, true])).toBe(1.0);
  });

  it('should return 0.0 for all incorrect predictions', () => {
    expect(computeAccuracy([false, false])).toBe(0.0);
  });

  it('should return 0.5 for half correct', () => {
    expect(computeAccuracy([true, false])).toBe(0.5);
  });

  it('should return 0 for empty array', () => {
    expect(computeAccuracy([])).toBe(0);
  });
});

// ── computePrecision ──────────────────────────────────

describe('computePrecision', () => {
  it('should return 1.0 when all bullish predictions are correct', () => {
    // Bullish predictions at indices 0, 2 are both correct
    expect(computePrecision([true, false, true], [true, true, true])).toBe(1.0);
  });

  it('should return 0 when no bullish predictions', () => {
    expect(computePrecision([true, false], [false, false])).toBe(0);
  });

  it('should return 0.5 when half of bullish predictions correct', () => {
    // predictedBullish=[true,true], actuallyPositive=[true,false] → TP=1, FP=1 → 0.5
    expect(computePrecision([true, true], [true, false])).toBe(0.5);
  });
});

// ── computeRecall ─────────────────────────────────────

describe('computeRecall', () => {
  it('should return 1.0 when all correct outcomes were predicted bullish', () => {
    // predictedBullish=[true,true], actuallyPositive=[true,true] → TP=2, FN=0 → 1.0
    expect(computeRecall([true, true], [true, true])).toBe(1.0);
  });

  it('should return 0 when no correct outcomes', () => {
    expect(computeRecall([false, false], [true, true])).toBe(0);
  });
});

// ── computeWinRate ────────────────────────────────────

describe('computeWinRate', () => {
  it('should count positive returns as wins', () => {
    expect(computeWinRate([0.10, 0.25, -0.05, 0.30])).toBe(0.75);
  });

  it('should return 0 for all negative returns', () => {
    expect(computeWinRate([-0.10, -0.20])).toBe(0);
  });

  it('should return 0 for empty array', () => {
    expect(computeWinRate([])).toBe(0);
  });
});

// ── computeAvgRoi ─────────────────────────────────────

describe('computeAvgRoi', () => {
  it('should compute average ROI', () => {
    expect(computeAvgRoi([0.10, 0.20, 0.30])).toBeCloseTo(0.20, 5);
  });

  it('should handle negative ROIs', () => {
    expect(computeAvgRoi([-0.10, 0.20])).toBeCloseTo(0.05, 5);
  });

  it('should return 0 for empty array', () => {
    expect(computeAvgRoi([])).toBe(0);
  });
});

// ── computeSharpeRatio ────────────────────────────────

describe('computeSharpeRatio', () => {
  it('should return positive Sharpe for consistent profits', () => {
    const returns = [0.02, 0.03, 0.02, 0.04, 0.03];
    const sharpe = computeSharpeRatio(returns);
    expect(sharpe).toBeGreaterThan(0);
  });

  it('should return negative Sharpe for consistent losses', () => {
    const returns = [-0.02, -0.03, -0.02, -0.04];
    const sharpe = computeSharpeRatio(returns);
    expect(sharpe).toBeLessThan(0);
  });

  it('should return null when stddev is zero', () => {
    // All identical returns → zero variance → null
    expect(computeSharpeRatio([0.10, 0.10, 0.10, 0.10])).toBeNull();
  });

  it('should return null for empty array', () => {
    expect(computeSharpeRatio([])).toBeNull();
  });
});

// ── computeMaxDrawdown ────────────────────────────────

describe('computeMaxDrawdown', () => {
  it('should return 0 for monotonically increasing cumulative PnL', () => {
    // computeMaxDrawdown expects cumulative PnL, not per-trade returns
    expect(computeMaxDrawdown([100, 150, 200, 300])).toBe(0);
  });

  it('should compute drawdown correctly from cumulative PnL', () => {
    // Cumulative: peaked at 150, dropped to 130 → dd ≈ (150-130)/150 ≈ 0.133
    const cumulative = [100, 150, 130, 120, 140];
    expect(computeMaxDrawdown(cumulative)).toBeGreaterThan(0);
  });

  it('should return null for empty array', () => {
    expect(computeMaxDrawdown([])).toBeNull();
  });
});

// ── computeProfitFactor ───────────────────────────────

describe('computeProfitFactor', () => {
  it('should be > 1 when profits exceed losses', () => {
    const pnls = [100, 50, -30, -20];
    expect(computeProfitFactor(pnls)).toBe(3.0); // 150 / 50
  });

  it('should be Infinity when no losses', () => {
    expect(computeProfitFactor([100, 50, 0])).toBe(Infinity);
  });

  it('should be 0 for empty array', () => {
    expect(computeProfitFactor([])).toBe(0);
  });
});

// ── computeAllMetrics ─────────────────────────────────

describe('computeAllMetrics', () => {
  const returns = [0.10, -0.05, 0.20, 0.03, -0.02, 0.15];
  const predictedBullish = [true, true, true, false, false, true];
  const pnls = [100, -50, 200, 30, -20, 150];
  const holdingDays = [3, 5, 2, 1, 4, 3];

  it('should return complete metrics object', () => {
    const m = computeAllMetrics(returns, predictedBullish, pnls, holdingDays);
    expect(m.accuracy).toBeGreaterThanOrEqual(0);
    expect(m.winRate).toBeGreaterThanOrEqual(0);
    expect(m.avgRoi).toBeCloseTo(computeAvgRoi(returns), 5);
    expect(m.totalPnl).toBeCloseTo(410, 0);
    expect(m.profitFactor).toBeGreaterThan(0);
  });

  it('should handle empty inputs gracefully', () => {
    const m = computeAllMetrics([], [], [], []);
    expect(m.accuracy).toBe(0);
    expect(m.winRate).toBe(0);
    expect(m.sharpeRatio).toBeNull();
  });
});

// ── computeBaselines ──────────────────────────────────

describe('computeBaselines', () => {
  const returns = [0.10, -0.05, 0.20, 0.03];

  it('should return baseline comparison object', () => {
    const b = computeBaselines(returns, 0.6, 0.07);
    expect(b.signalWinRate).toBe(0.6);
    expect(b.randomBaseline).toBe(0.5);
    expect(b.signalVsRandom).toBeCloseTo(0.1, 5);
    expect(b.signalAvgRoi).toBeCloseTo(0.07, 5);
    expect(b.buyAndHoldRoi).toBeCloseTo(computeAvgRoi(returns), 5);
  });
});

// ── computeTierBreakdown ──────────────────────────────

describe('computeTierBreakdown', () => {
  it('should group returns by tier', () => {
    const tiers = ['90–100', '90–100', '70–79', '<70'];
    const returns = [0.15, 0.20, 0.05, -0.03];
    const breakdown = computeTierBreakdown(tiers, returns);

    expect(breakdown.length).toBeGreaterThanOrEqual(1);
    const topTier = breakdown.find(b => b.tier === '90–100');
    expect(topTier).toBeDefined();
    if (topTier) {
      expect(topTier.count).toBe(2);
      expect(topTier.winRate).toBeCloseTo(1.0, 1);
    }
  });

  it('should handle empty arrays', () => {
    const breakdown = computeTierBreakdown([], []);
    expect(breakdown).toEqual([]);
  });
});

// ── createWalkForwardFolds ────────────────────────────

describe('createWalkForwardFolds', () => {
  // Generate 60 daily dates — enough for trainDays=15, testDays=5 with minTestTrades overridden
  const dates = Array.from({ length: 60 }, (_, i) => {
    const d = new Date('2026-01-01');
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  it('should create folds with train/test split when enough data', () => {
    // trainDays=15, testDays=5, stepDays=10, minTestTrades=1 (low bar)
    const folds = createWalkForwardFolds(dates, 15, 5, 10, 1);
    expect(folds.length).toBeGreaterThan(0);
    const first = folds[0];
    expect(first.trainIndices.length).toBeGreaterThan(0);
    expect(first.testIndices.length).toBeGreaterThan(0);
    // train + test should be disjoint
    const trainSet = new Set(first.trainIndices);
    for (const idx of first.testIndices) {
      expect(trainSet.has(idx)).toBe(false);
    }
  });

  it('should return empty for insufficient data', () => {
    const short = ['2026-01-01', '2026-01-02'];
    const folds = createWalkForwardFolds(short, 5, 3, 2);
    expect(folds).toEqual([]);
  });
});
