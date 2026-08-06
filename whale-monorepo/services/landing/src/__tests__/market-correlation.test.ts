/**
 * Unit tests for market-correlation.ts
 *
 * Covers: pearsonCorrelation — pure math, no DB dependency.
 */

import { describe, it, expect } from 'vitest';
import { pearsonCorrelation } from '@/lib/market-correlation';

describe('pearsonCorrelation', () => {
  // ── Perfect correlation ───────────────────────────

  it('should return 1.0 for perfectly positive linear relationship', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10]; // y = 2x
    expect(pearsonCorrelation(x, y)).toBeCloseTo(1.0, 5);
  });

  it('should return -1.0 for perfectly negative linear relationship', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [10, 8, 6, 4, 2]; // y = -2x + 12
    expect(pearsonCorrelation(x, y)).toBeCloseTo(-1.0, 5);
  });

  // ── Zero / no correlation ─────────────────────────

  it('should return 0 for uncorrelated data', () => {
    const x = [1, 2, 3, 1, 2, 3];
    const y = [2, 2, 2, 3, 3, 3];
    // Low variance in y gives 0 correlation
    const r = pearsonCorrelation(x, y);
    expect(r).toBeCloseTo(0, 1);
  });

  // ── Edge cases ────────────────────────────────────

  it('should return 0 for arrays with fewer than 3 elements', () => {
    expect(pearsonCorrelation([1], [1])).toBe(0);
    expect(pearsonCorrelation([1, 2], [3, 4])).toBe(0);
  });

  it('should return 0 for empty arrays', () => {
    expect(pearsonCorrelation([], [])).toBe(0);
  });

  it('should return 0 when one array has zero variance', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [7, 7, 7, 7, 7]; // zero variance
    expect(pearsonCorrelation(x, y)).toBe(0);
  });

  // ── Asymmetric lengths ────────────────────────────

  it('should use the shorter array length', () => {
    const x = [1, 2, 3, 4, 5, 6, 7];
    const y = [2, 4, 6, 8, 10]; // y = 2x, only 5 elements
    expect(pearsonCorrelation(x, y)).toBeCloseTo(1.0, 5);
  });

  // ── Realistic VW divergence data ──────────────────

  it('should detect moderate positive correlation in realistic data', () => {
    // Simulated VW divergence snapshots for two related markets
    const marketA = [0.01, 0.02, 0.03, 0.05, 0.04, 0.06, 0.08, 0.07, 0.09, 0.10];
    const marketB = [0.02, 0.03, 0.05, 0.06, 0.07, 0.08, 0.10, 0.09, 0.12, 0.13];
    const r = pearsonCorrelation(marketA, marketB);
    expect(r).toBeGreaterThan(0.7);
    expect(r).toBeLessThanOrEqual(1.0);
  });

  it('should detect negative correlation in opposing direction markets', () => {
    const upMarket = [0.01, 0.03, 0.05, 0.07, 0.09];
    const downMarket = [-0.01, -0.03, -0.06, -0.08, -0.10];
    const r = pearsonCorrelation(upMarket, downMarket);
    expect(r).toBeLessThan(-0.7);
    expect(r).toBeGreaterThanOrEqual(-1.0);
  });

  // ── Clamping ──────────────────────────────────────

  it('should clamp result to [-1, 1] range', () => {
    // Large numbers shouldn't overflow
    const x = [1000, 2000, 3000, 4000, 5000];
    const y = [2000, 4000, 6000, 8000, 10000];
    const r = pearsonCorrelation(x, y);
    expect(r).toBeGreaterThanOrEqual(-1);
    expect(r).toBeLessThanOrEqual(1);
  });
});
