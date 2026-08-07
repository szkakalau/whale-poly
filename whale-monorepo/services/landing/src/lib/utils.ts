/**
 * Shared utility functions used across the prediction/backtesting pipeline.
 *
 * Split out to eliminate duplicate clamp / scoreTier implementations
 * that previously existed independently in 4+ files.
 */

/** Clamp a number to [lo, hi]. */
export function clamp(value: number, lo: number, hi: number): number {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

/** Map a composite score (0-100) to a tier label. Null-safe — returns '<70' for null. */
export function scoreToTier(score: number | null): string {
  if (score == null) return '<70';
  if (score >= 90) return '90–100';
  if (score >= 80) return '80–89';
  if (score >= 70) return '70–79';
  return '<70';
}
