/**
 * Unit tests for position-sizing.ts
 *
 * Covers: computeKelly — pure math, no DB dependency.
 * Also covers: kellyFromTiers.
 */

import { describe, it, expect } from 'vitest';
import { computeKelly, kellyFromTiers, type TierStats } from '@/lib/position-sizing';

describe('computeKelly', () => {
  // ── Valid Kelly cases ─────────────────────────────

  it('should compute correct Kelly fraction for a strong edge', () => {
    const result = computeKelly(
      0.60,   // 60% win rate
      0.25,   // avg win ROI 25%
      0.10,   // avg loss ROI 10%
      50,     // sample size
    );

    // Kelly: f* = 0.60 - (0.40)/(0.25/0.10) = 0.60 - 0.40/2.5 = 0.60 - 0.16 = 0.44
    expect(result.kellyFraction).toBeCloseTo(0.44, 2);
    expect(result.halfKellyFraction).toBeCloseTo(0.22, 2);
    expect(result.winLossRatio).toBeCloseTo(2.5, 1);
    expect(result.confidence).toBe('high');
    expect(result.recommendedFraction).toBeLessThanOrEqual(0.25);
  });

  it('should recommend Half-Kelly for normal case', () => {
    const result = computeKelly(0.55, 0.20, 0.10, 100);
    // Kelly: 0.55 - 0.45/2.0 = 0.55 - 0.225 = 0.325
    // Half-Kelly: 0.1625
    expect(result.recommendedFraction).toBeCloseTo(result.halfKellyFraction, 4);
    // Should not exceed the cap
    expect(result.recommendedFraction).toBeLessThanOrEqual(0.25);
  });

  // ── Low sample size ───────────────────────────────

  it('should fall back to 2% with insufficient sample size', () => {
    const result = computeKelly(0.70, 0.30, 0.10, 3);
    expect(result.recommendedFraction).toBe(0.02);
    expect(result.confidence).toBe('low');
    expect(result.suggestion).toContain('保守');
  });

  // ── No edge / negative Kelly ─────────────────────

  it('should recommend 0 when edge is negative', () => {
    const result = computeKelly(0.30, 0.15, 0.20, 50);
    expect(result.recommendedFraction).toBe(0);
    expect(result.suggestion).toContain('观望');
  });

  it('should recommend 0 when Kelly is zero (break-even)', () => {
    // p = 0.4, W/L = (1-p)/p = 1.5
    // f* = 0.4 - 0.6/1.5 = 0.4 - 0.4 = 0
    const result = computeKelly(0.40, 0.15, 0.10, 40);
    // W/L = 1.5, Kelly = 0.4 - 0.6/1.5 = 0
    expect(result.kellyFraction).toBeCloseTo(0, 2);
  });

  // ── High win rate cap ─────────────────────────────

  it('should cap position at 25% even for high edge', () => {
    const result = computeKelly(0.80, 0.50, 0.05, 100);
    // W/L = 10, Kelly = 0.80 - 0.20/10 = 0.80 - 0.02 = 0.78
    // Half Kelly = 0.39 → capped at MAX_POSITION_FRACTION
    expect(result.recommendedFraction).toBeLessThanOrEqual(0.25);
  });

  it('should apply extra cap for very high win rates (>70%)', () => {
    const result = computeKelly(0.75, 0.40, 0.08, 60);
    expect(result.confidence).toBe('high');
    expect(result.recommendedFraction).toBeLessThanOrEqual(0.20);
  });

  // ── Medium sample size ────────────────────────────

  it('should use Quarter-Kelly for medium sample size', () => {
    const result = computeKelly(0.55, 0.20, 0.10, 15);
    expect(result.confidence).toBe('medium');
    // recommendedFraction should be close to quarterKelly
    expect(result.recommendedFraction).toBeCloseTo(result.quarterKellyFraction, 4);
  });

  // ── Edge calculation ──────────────────────────────

  it('should compute positive edge correctly', () => {
    const result = computeKelly(0.60, 0.30, 0.10, 50);
    // edge = 0.60 * 0.30 - 0.40 * 0.10 = 0.18 - 0.04 = 0.14
    expect(result.edge).toBeCloseTo(0.14, 4);
  });

  it('should compute negative edge correctly', () => {
    const result = computeKelly(0.35, 0.10, 0.15, 50);
    // edge = 0.35 * 0.10 - 0.65 * 0.15 = 0.035 - 0.0975 = -0.0625
    expect(result.edge).toBeLessThan(0);
  });

  // ── Boundary clamping ─────────────────────────────

  it('should clamp winRate to [0, 1]', () => {
    const result = computeKelly(1.5, 0.25, 0.10, 50);
    expect(result.winProbability).toBe(1.0);
  });

  it('should clamp negative winRate to 0', () => {
    const result = computeKelly(-0.2, 0.25, 0.10, 50);
    expect(result.winProbability).toBe(0);
  });

  it('should clamp zero ROI values to a small positive', () => {
    const result = computeKelly(0.5, 0, 0, 50);
    // Both avgWinRoi and avgLossRoi get clamped to 0.001 minimum
    expect(result.winLossRatio).toBe(1);
  });
});

// ── kellyFromTiers ──────────────────────────────────

describe('kellyFromTiers', () => {
  const tiers: TierStats[] = [
    { tier: '90–100', count: 15, winRate: 0.75, avgRoi: 0.20 },
    { tier: '80–89', count: 30, winRate: 0.60, avgRoi: 0.12 },
    { tier: '70–79', count: 40, winRate: 0.50, avgRoi: 0.05 },
    { tier: '<70', count: 50, winRate: 0.35, avgRoi: -0.05 },
  ];

  it('should match to the correct score tier', () => {
    const result = kellyFromTiers(92, tiers);
    expect(result.winProbability).toBeCloseTo(0.75, 2);
    expect(result.sampleSize).toBe(15);
  });

  it('should fall back to aggregate when tier not found', () => {
    const result = kellyFromTiers(95, [
      { tier: 'all', count: 100, winRate: 0.55, avgRoi: 0.08 },
    ]);
    // Should use aggregate since no matching tier label
    expect(result.sampleSize).toBe(100);
    expect(result.winProbability).toBeCloseTo(0.55, 2);
  });

  it('should return conservative result for empty tiers', () => {
    const result = kellyFromTiers(85, []);
    expect(result.recommendedFraction).toBe(0.02);
    expect(result.confidence).toBe('low');
  });

  it('should map score 75 to 70–79 tier', () => {
    const result = kellyFromTiers(75, tiers);
    expect(result.sampleSize).toBe(40);
    expect(result.winProbability).toBeCloseTo(0.50, 2);
  });
});
