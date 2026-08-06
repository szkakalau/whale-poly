/**
 * Multi-Signal Fusion Layer
 *
 * Combines 4 independent signal sources into a single composite prediction:
 *   1. Whale Quality   — historical performance (whale_score from whale_stats)
 *   2. Behavior        — current trade pattern (spike / build / exit)
 *   3. VW Analysis     — volume-weighted divergence from market price
 *   4. Flow Direction  — YES/NO volume ratio and confidence from analysis-engine
 *
 * Design principle: weighted linear fusion with agreement-based adjustment.
 * No ML — fully transparent and debuggable.
 */

import type { AnalysisResult, Direction, ConfidenceLevel } from '@/lib/analysis-engine';
export type { AnalysisResult };
import { classifyConfidence } from '@/lib/analysis-engine';

// ── Types ──────────────────────────────────────────────

/** Identifies which signal pipeline produced a component. */
export type SignalSource = 'whale_quality' | 'behavior' | 'vw_analysis' | 'flow_direction';

/** One normalised signal contribution to the fusion score. */
export type SignalComponent = {
  source: SignalSource;
  name: string;
  rawValue: number;          // original value before normalisation
  normalizedValue: number;   // 0-100
  signedValue: number;       // -100 to +100 (positive = bullish)
  weight: number;            // configured fusion weight
  contribution: number;      // normalizedValue * weight
};

/** The fused prediction for a single market. */
export type FusionResult = {
  marketSlug: string;
  compositeScore: number;         // 0-100
  direction: Direction;
  confidenceLevel: ConfidenceLevel;
  signalComponents: SignalComponent[];
  dominantSignal: SignalSource;   // which signal contributed the most
  agreementScore: number;         // 0-100 — how consistent the signals are
  timestamp: string;
};

/** Tunable weights and adjustment factors. */
export type FusionConfig = {
  weights: Record<SignalSource, number>;
  agreementBonus: number;    // multiplier when signals agree (default 1.2)
  conflictPenalty: number;   // multiplier when signals conflict (default 0.7)
  agreementThreshold: number; // agreementScore above this → bonus (default 0.7)
  conflictThreshold: number;  // agreementScore below this → penalty (default 0.3)
  directionThreshold: number; // |weightedDirection| above this → non-neutral (default 15)
};

// ── Defaults ───────────────────────────────────────────

export const DEFAULT_FUSION_CONFIG: FusionConfig = {
  weights: {
    whale_quality: 0.25,
    behavior: 0.25,
    vw_analysis: 0.25,
    flow_direction: 0.25,
  },
  agreementBonus: 1.2,
  conflictPenalty: 0.7,
  agreementThreshold: 0.7,
  conflictThreshold: 0.3,
  directionThreshold: 15,
};

// ── Input types (what callers must provide) ────────────

export type WhaleQualityInput = {
  whaleScore: number;          // 0-100, from whale_stats
  direction: Direction;        // net direction of active whales
};

export type BehaviorInput = {
  behaviorType: 'spike' | 'build' | 'exit' | null;
  side: 'BUY' | 'SELL' | 'UNKNOWN';
};

export type VwAnalysisInput = {
  vwDivergence: number;        // -1 to +1
  uai: number | null;          // 0+
  signalDirection: string;     // 'bullish' | 'bearish' | 'neutral'
  signalStrength: number;      // 0-100
};

// ── Helpers ────────────────────────────────────────────

/** Clamp a number to [lo, hi]. */
export function clamp(value: number, lo: number, hi: number): number {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

/** Convert direction + confidence to a signed value (-100 to +100). */
export function directionToSigned(direction: Direction, confidence: number): number {
  const c = clamp(confidence, 0, 100);
  switch (direction) {
    case 'bullish': return +c;
    case 'bearish': return -c;
    case 'mixed':  return 0;  // mixed signals cancel out
    default:       return 0;
  }
}

/** Map behavior type to a signed strength value. */
export function behaviorToSigned(behaviorType: string | null, side: string): number {
  const s = (side || '').toUpperCase();
  const isBuy = s === 'BUY';
  const isSell = s === 'SELL';

  switch (behaviorType) {
    case 'spike': return isBuy ? 80 : isSell ? -80 : 0;
    case 'build': return isBuy ? 75 : isSell ? -75 : 0;
    case 'exit':  return 85;  // exit is always bearish (whale closing position = expects price drop)
    default:      return 0;
  }
}

/**
 * Normalise VW divergence to 0-100 score.
 * Uses the existing formula from vw.py: min(100, |divergence| * 200).
 * divergence range is typically [-0.5, +0.5].
 */
export function vwDivergenceToScore(divergence: number): number {
  return clamp(Math.abs(divergence) * 200, 0, 100);
}

/**
 * Compute signal agreement — how consistently the signals point in the same direction.
 * Returns 0-1 where 1 = all signals agree, 0 = perfectly balanced conflict.
 *
 * Uses normalised standard deviation of signed weighted values:
 *   agreement = 1 - σ(signed_weights) / σ_max
 * where σ_max = 50 (max possible stddev when 4 signals are at extremes ±100).
 */
export function computeAgreement(signals: SignalComponent[]): number {
  if (signals.length <= 1) return 1.0;

  const signedWeights = signals.map(s => s.signedValue * s.weight);

  // Weighted mean
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const mean = totalWeight > 0
    ? signedWeights.reduce((sum, sw) => sum + sw, 0) / totalWeight
    : 0;

  // Weighted variance
  const variance = totalWeight > 0
    ? signals.reduce((sum, s, i) => sum + s.weight * (s.signedValue - mean) ** 2, 0) / totalWeight
    : 0;

  const stddev = Math.sqrt(variance);
  const sigmaMax = 50; // theoretical max stddev for 4 signals at ±100

  return clamp(1 - stddev / sigmaMax, 0, 1);
}

// ── Core Fusion ────────────────────────────────────────

/**
 * Fuse multiple signal sources into a single prediction.
 *
 * Algorithm:
 *   1. Normalise each signal to 0-100
 *   2. Convert to signed values (positive = bullish, negative = bearish)
 *   3. Compute signal agreement (how consistently they point the same way)
 *   4. Weighted sum → compositeScore
 *   5. Apply agreement bonus / conflict penalty
 *   6. Determine final direction and confidence level
 */
export function fuseSignals(
  marketSlug: string,
  analysisResult: AnalysisResult,
  whaleQuality: WhaleQualityInput | null,
  behavior: BehaviorInput | null,
  vwAnalysis: VwAnalysisInput | null,
  config: FusionConfig = DEFAULT_FUSION_CONFIG,
): FusionResult {
  const components: SignalComponent[] = [];
  const now = new Date().toISOString();

  // ── 1. Whale Quality ──────────────────────────────
  if (whaleQuality && whaleQuality.whaleScore > 0) {
    const norm = clamp(whaleQuality.whaleScore, 0, 100);
    const signed = directionToSigned(whaleQuality.direction, norm);
    components.push({
      source: 'whale_quality',
      name: 'Whale Quality',
      rawValue: whaleQuality.whaleScore,
      normalizedValue: norm,
      signedValue: signed,
      weight: config.weights.whale_quality,
      contribution: 0, // computed after
    });
  }

  // ── 2. Behavior ───────────────────────────────────
  if (behavior && behavior.behaviorType) {
    const signed = behaviorToSigned(behavior.behaviorType, behavior.side);
    const norm = Math.abs(signed);
    if (norm > 0) {
      components.push({
        source: 'behavior',
        name: `Behavior (${behavior.behaviorType})`,
        rawValue: signed,
        normalizedValue: norm,
        signedValue: signed,
        weight: config.weights.behavior,
        contribution: 0,
      });
    }
  }

  // ── 3. VW Analysis ────────────────────────────────
  if (vwAnalysis && vwAnalysis.vwDivergence !== undefined) {
    const norm = vwDivergenceToScore(vwAnalysis.vwDivergence);
    const dirSign = vwAnalysis.signalDirection === 'bearish' ? -1 : 1;
    const signed = norm * dirSign;
    if (norm > 0) {
      components.push({
        source: 'vw_analysis',
        name: 'VW Divergence',
        rawValue: vwAnalysis.vwDivergence,
        normalizedValue: norm,
        signedValue: signed,
        weight: config.weights.vw_analysis,
        contribution: 0,
      });
    }
  }

  // ── 4. Flow Direction ─────────────────────────────
  {
    const conf = analysisResult.confidenceScore;
    const signed = directionToSigned(analysisResult.direction, conf);
    if (conf > 0) {
      components.push({
        source: 'flow_direction',
        name: 'Flow Direction',
        rawValue: conf,
        normalizedValue: conf,
        signedValue: signed,
        weight: config.weights.flow_direction,
        contribution: 0,
      });
    }
  }

  // ── Re-normalise weights when some signals are missing ──
  let totalWeight = components.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight > 0 && totalWeight !== 1.0) {
    for (const c of components) {
      c.weight = c.weight / totalWeight;
    }
    totalWeight = 1.0;
  }

  // ── Compute contributions ─────────────────────────
  for (const c of components) {
    c.contribution = c.normalizedValue * c.weight;
  }

  // ── Agreement ─────────────────────────────────────
  const agreementScore = computeAgreement(components);

  // ── Composite score ───────────────────────────────
  let compositeScore = components.reduce((sum, c) => sum + c.contribution, 0);

  // Agreement adjustment
  if (agreementScore >= config.agreementThreshold) {
    compositeScore *= config.agreementBonus;
  } else if (agreementScore <= config.conflictThreshold) {
    compositeScore *= config.conflictPenalty;
  }
  compositeScore = clamp(Math.round(compositeScore), 0, 100);

  // ── Direction ─────────────────────────────────────
  const weightedDirection = components.reduce((sum, c) => sum + c.signedValue * c.weight, 0);
  let direction: Direction;
  if (weightedDirection > config.directionThreshold) {
    direction = 'bullish';
  } else if (weightedDirection < -config.directionThreshold) {
    direction = 'bearish';
  } else {
    // Check for mixed: both strong bullish AND bearish components
    const hasBullish = components.some(c => c.signedValue > config.directionThreshold);
    const hasBearish = components.some(c => c.signedValue < -config.directionThreshold);
    direction = hasBullish && hasBearish ? 'mixed' : 'neutral';
  }

  // ── Dominant signal ───────────────────────────────
  const dominant = components.length > 0
    ? components.reduce((best, c) => c.contribution > best.contribution ? c : best, components[0])
    : null;

  // ── Confidence level ──────────────────────────────
  let confidenceLevel = classifyConfidence(compositeScore);
  // Override: mixed direction cannot be high confidence
  if (direction === 'mixed' && confidenceLevel === 'high') {
    confidenceLevel = 'medium';
  }
  // Override: too few signals → low confidence
  if (components.length < 2) {
    confidenceLevel = 'low';
  }

  return {
    marketSlug,
    compositeScore,
    direction,
    confidenceLevel,
    signalComponents: components,
    dominantSignal: dominant?.source ?? 'flow_direction',
    agreementScore: Math.round(agreementScore * 100),
    timestamp: now,
  };
}

/**
 * Lightweight fusion that only needs the AnalysisResult.
 * Whale quality and VW metrics are fetched separately by the caller
 * when available (plan-gated). This ensures FREE tier still gets a
 * basic prediction from flow + behavior alone.
 */
export function fuseBasicSignals(
  marketSlug: string,
  analysisResult: AnalysisResult,
): FusionResult {
  // Derive a minimal behavior signal from the analysis result
  const behavior: BehaviorInput | null =
    analysisResult.topWallets.length > 0
      ? {
          behaviorType: analysisResult.whaleTradeCount >= 5 ? 'build' : null,
          side: analysisResult.direction === 'bullish' ? 'BUY'
            : analysisResult.direction === 'bearish' ? 'SELL'
            : 'UNKNOWN',
        }
      : null;

  return fuseSignals(
    marketSlug,
    analysisResult,
    null, // whale_quality — requires whale_stats table access (Pro+)
    behavior,
    null, // vw_analysis — requires market_vw_metrics table access (Pro+)
    {
      ...DEFAULT_FUSION_CONFIG,
      weights: {
        whale_quality: 0,
        behavior: 0.3,
        vw_analysis: 0,
        flow_direction: 0.7,
      },
    },
  );
}
