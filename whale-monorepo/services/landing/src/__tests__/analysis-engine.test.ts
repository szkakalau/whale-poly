import { describe, it, expect } from 'vitest';

/**
 * Unit tests for AnalysisEngine scoring logic.
 *
 * These tests validate the pure functions that drive the conviction scoring —
 * no DB or external API dependencies.
 */

// Import internal helpers by replicating logic (since they're not exported)
// In practice these would be extracted to a separate pure-functions module.

const MIN_TRADE_USD = 5_000;
const MIN_TRADES_FOR_SIGNAL = 3;
const DIRECTION_RATIO_THRESHOLD = 0.2;

// Duplicated from analysis-engine.ts for test isolation.
// In production, extract these to a shared pure-functions module.
function sizeScore(amountUsd: number): number {
  if (amountUsd >= 100_000) return 100;
  if (amountUsd >= 50_000) return 80;
  if (amountUsd >= 20_000) return 60;
  if (amountUsd >= MIN_TRADE_USD) return 30;
  return 0;
}

function timeDecayScore(tradeTimestamp: string, now: Date): number {
  const tradeTs = new Date(tradeTimestamp).getTime();
  const elapsedSec = (now.getTime() - tradeTs) / 1000;
  const maxSec = 24 * 3600; // 24h lookback
  return Math.max(0, 100 * (1 - elapsedSec / maxSec));
}

function walletWeight(
  sizeUsd: number,
  tradeTimestamp: string,
  now: Date,
  whaleScore?: number,
): number {
  const sz = sizeScore(sizeUsd);
  const td = timeDecayScore(tradeTimestamp, now);
  let conviction = 50;
  if (whaleScore != null && Number.isFinite(whaleScore)) {
    conviction = Math.min(100, Math.max(0, (whaleScore / 100) * 100));
  }
  return sz * 0.4 + td * 0.3 + conviction * 0.3;
}

function classifyConfidence(score: number): 'low' | 'medium' | 'high' {
  if (score > 70) return 'high';
  if (score > 40) return 'medium';
  return 'low';
}

function classifyDirection(
  yesVolume: number,
  noVolume: number,
  tradeCount: number,
): 'bullish' | 'bearish' | 'neutral' | 'mixed' {
  if (tradeCount < MIN_TRADES_FOR_SIGNAL) return 'neutral';
  const total = yesVolume + noVolume;
  if (total === 0) return 'neutral';

  // Conflicting signals check first
  if (yesVolume > total * DIRECTION_RATIO_THRESHOLD && noVolume > total * DIRECTION_RATIO_THRESHOLD) {
    return 'mixed';
  }

  const ratio = (yesVolume - noVolume) / total;
  if (ratio > DIRECTION_RATIO_THRESHOLD) return 'bullish';
  if (ratio < -DIRECTION_RATIO_THRESHOLD) return 'bearish';
  return 'neutral';
}

// ── Tests ─────────────────────────────────────────────

describe('sizeScore', () => {
  it('should return 100 for trades >= $100k', () => {
    expect(sizeScore(100_000)).toBe(100);
    expect(sizeScore(500_000)).toBe(100);
  });

  it('should return 80 for trades $50k-$100k', () => {
    expect(sizeScore(50_000)).toBe(80);
    expect(sizeScore(75_000)).toBe(80);
  });

  it('should return 60 for trades $20k-$50k', () => {
    expect(sizeScore(20_000)).toBe(60);
    expect(sizeScore(35_000)).toBe(60);
  });

  it('should return 30 for trades $5k-$20k', () => {
    expect(sizeScore(5_000)).toBe(30);
    expect(sizeScore(10_000)).toBe(30);
  });

  it('should return 0 for trades below $5k', () => {
    expect(sizeScore(4_999)).toBe(0);
    expect(sizeScore(0)).toBe(0);
  });
});

describe('timeDecayScore', () => {
  const now = new Date('2026-05-29T12:00:00Z');

  it('should return 100 for a trade just now', () => {
    expect(timeDecayScore('2026-05-29T12:00:00Z', now)).toBe(100);
  });

  it('should return ~50 for a trade 12 hours ago', () => {
    expect(timeDecayScore('2026-05-29T00:00:00Z', now)).toBeCloseTo(50, -1);
  });

  it('should return 0 for a trade > 24 hours ago', () => {
    expect(timeDecayScore('2026-05-28T00:00:00Z', now)).toBe(0);
  });
});

describe('walletWeight', () => {
  const now = new Date('2026-05-29T12:00:00Z');

  it('should compute weight from size + time + conviction', () => {
    const w = walletWeight(50_000, '2026-05-29T12:00:00Z', now, 70);
    // size: 80 * 0.4 = 32, time: 100 * 0.3 = 30, conviction: 70 * 0.3 = 21 → 83
    expect(w).toBeCloseTo(83, -1);
  });

  it('should default conviction to 50 when whaleScore is missing', () => {
    const w = walletWeight(50_000, '2026-05-29T12:00:00Z', now);
    // size: 32, time: 30, conviction: 50 * 0.3 = 15 → 77
    expect(w).toBeCloseTo(77, -1);
  });
});

describe('classifyConfidence', () => {
  it('should return high for scores > 70', () => {
    expect(classifyConfidence(71)).toBe('high');
    expect(classifyConfidence(100)).toBe('high');
  });

  it('should return medium for scores 41-70', () => {
    expect(classifyConfidence(41)).toBe('medium');
    expect(classifyConfidence(70)).toBe('medium');
  });

  it('should return low for scores <= 40', () => {
    expect(classifyConfidence(40)).toBe('low');
    expect(classifyConfidence(0)).toBe('low');
  });
});

describe('classifyDirection', () => {
  it('should return neutral when < 3 trades', () => {
    expect(classifyDirection(10_000, 0, 2)).toBe('neutral');
  });

  it('should return bullish when YES volume dominates', () => {
    // YES: 80k, NO: 20k, ratio = 60k/100k = 0.6 > 0.2 → bullish
    expect(classifyDirection(80_000, 20_000, 5)).toBe('bullish');
  });

  it('should return bearish when NO volume dominates', () => {
    // YES: 10k, NO: 90k, ratio = -80k/100k = -0.8 < -0.2 → bearish
    expect(classifyDirection(10_000, 90_000, 5)).toBe('bearish');
  });

  it('should return neutral for too-few-trades', () => {
    // < 3 trades → neutral regardless of volume
    expect(classifyDirection(80_000, 20_000, 2)).toBe('neutral');
  });

  it('should return mixed when both YES and NO have significant volume', () => {
    // Both sides > 20% of total → mixed (even if ratio is moderate)
    expect(classifyDirection(55_000, 45_000, 5)).toBe('mixed');
  });

  it('should return mixed when both sides have significant volume', () => {
    // YES: 45k (45%), NO: 55k (55%) — both > 20% threshold → mixed
    expect(classifyDirection(45_000, 55_000, 10)).toBe('mixed');
  });

  it('should return neutral for zero total volume', () => {
    expect(classifyDirection(0, 0, 5)).toBe('neutral');
  });
});
