/**
 * Probability Prediction Model
 *
 * Logistic regression (Platt scaling variant) that calibrates the fused
 * composite score + direction into a calibrated P(correct) probability.
 *
 * Mathematical foundation:
 *   z = β₀ + β₁·(score/100) + β₂·isBullish + β₃·isBearish
 *   P(correct) = σ(z) = 1 / (1 + e^(-z))
 *
 * Trained via gradient descent on backtest data (whale_score + trade_side + pnl).
 * 3 parameters — robust with small sample sizes, no regularization needed.
 *
 * Fallback: score-tier lookup table when < 20 training samples available.
 */

import type { Direction } from '@/lib/analysis-engine';

// ── Types ──────────────────────────────────────────────

/** Trained logistic regression coefficients. */
export type ProbabilityModel = {
  intercept: number;         // β₀
  scoreCoef: number;         // β₁ (applied to score / 100)
  bullishCoef: number;       // β₂
  bearishCoef: number;       // β₃
  trainedAt: string;         // ISO timestamp
  sampleSize: number;        // number of training rows
  accuracy: number;          // training accuracy (0-1)
};

/** One row from the backtest data used for training. */
export type TrainingRow = {
  whaleScore: number;        // 0-100 composite score proxy
  side: 'BUY' | 'SELL';     // trade direction
  pnl: number;               // realized PnL (positive = profit)
};

// ── Sigmoid ────────────────────────────────────────────

/**
 * Logistic sigmoid function.
 * Clamped for numerical stability at extreme z values.
 */
export function sigmoid(z: number): number {
  if (z > 20) return 1;
  if (z < -20) return 0;
  return 1 / (1 + Math.exp(-z));
}

// ── Prediction ─────────────────────────────────────────

/**
 * Compute P(correct | score, direction) from trained coefficients.
 *
 * For a bullish signal, P(correct) ≈ P(YES resolves).
 * For a bearish signal, P(correct) ≈ P(NO resolves).
 * For neutral/mixed, P(correct) is driven by score alone.
 */
export function predictProbability(
  score: number,
  direction: Direction,
  model: ProbabilityModel,
): number {
  const x = score / 100;
  const isBullish = direction === 'bullish' ? 1 : 0;
  const isBearish = direction === 'bearish' ? 1 : 0;

  const z = model.intercept
    + model.scoreCoef * x
    + model.bullishCoef * isBullish
    + model.bearishCoef * isBearish;

  const p = sigmoid(z);

  // Map P(correct) to P(YES):
  //   bullish → P(correct) IS P(YES)
  //   bearish → 1 - P(correct) IS P(YES) (correct bearish = NO wins)
  //   neutral/mixed → P(correct) is directionless, return as-is
  if (direction === 'bearish') {
    return 1 - p;
  }
  return p;
}

// ── Training ───────────────────────────────────────────

/**
 * Extract features and labels from raw backtest rows.
 *
 * Label = 1 when the trade direction was correct:
 *   BUY + positive PnL → correct bullish call
 *   SELL + positive PnL → correct bearish call
 */
export function extractFeaturesAndLabels(
  rows: TrainingRow[],
): { features: number[][]; labels: number[] } {
  const features: number[][] = [];
  const labels: number[] = [];

  for (const row of rows) {
    if (row.whaleScore == null || !Number.isFinite(row.pnl)) continue;

    // Feature vector: [score/100, isBullish, isBearish]
    features.push([
      row.whaleScore / 100,
      row.side === 'BUY' ? 1 : 0,
      row.side === 'SELL' ? 1 : 0,
    ]);

    // Label: 1 if direction was correct
    const isCorrect = row.pnl > 0;
    labels.push(isCorrect ? 1 : 0);
  }

  return { features, labels };
}

/**
 * Train logistic regression via batch gradient descent.
 *
 * Hyperparameters (hardcoded — small model, no tuning needed):
 *   learningRate = 0.1
 *   iterations   = 200
 *
 * Initial coefficients: β₀=0, β₁=1, β₂=0.2, β₃=-0.2
 * (reasonable prior: higher score → higher probability,
 *  bullish slightly favoring correctness, bearish slightly disfavoring)
 */
export function trainModel(rows: TrainingRow[]): ProbabilityModel {
  const { features, labels } = extractFeaturesAndLabels(rows);
  const n = features.length;

  if (n < 5) {
    return createFallbackModel();
  }

  // Initial coefficients
  let b0 = 0;      // intercept
  let b1 = 1.0;    // score coefficient
  let b2 = 0.2;    // bullish coefficient
  let b3 = -0.2;   // bearish coefficient

  const lr = 0.1;
  const iterations = 200;

  for (let iter = 0; iter < iterations; iter++) {
    let gradB0 = 0;
    let gradB1 = 0;
    let gradB2 = 0;
    let gradB3 = 0;

    for (let i = 0; i < n; i++) {
      const [xScore, xBullish, xBearish] = features[i];
      const y = labels[i];

      // z = β₀ + β₁·xScore + β₂·xBullish + β₃·xBearish
      const z = b0 + b1 * xScore + b2 * xBullish + b3 * xBearish;
      const yHat = sigmoid(z);

      // Gradient of binary cross-entropy: (ŷ - y) · x_j
      const error = yHat - y;

      gradB0 += error;
      gradB1 += error * xScore;
      gradB2 += error * xBullish;
      gradB3 += error * xBearish;
    }

    // Update (average gradient)
    b0 -= lr * (gradB0 / n);
    b1 -= lr * (gradB1 / n);
    b2 -= lr * (gradB2 / n);
    b3 -= lr * (gradB3 / n);
  }

  // Compute training accuracy
  let correct = 0;
  for (let i = 0; i < n; i++) {
    const [xScore, xBullish, xBearish] = features[i];
    const z = b0 + b1 * xScore + b2 * xBullish + b3 * xBearish;
    const yHat = sigmoid(z);
    const predicted = yHat >= 0.5 ? 1 : 0;
    if (predicted === labels[i]) correct++;
  }

  return {
    intercept: round4(b0),
    scoreCoef: round4(b1),
    bullishCoef: round4(b2),
    bearishCoef: round4(b3),
    trainedAt: new Date().toISOString(),
    sampleSize: n,
    accuracy: correct / n,
  };
}

// ── Fallback ───────────────────────────────────────────

/** Zero-information model: P(correct) = 0.5 for all inputs. */
function createFallbackModel(): ProbabilityModel {
  return {
    intercept: 0,
    scoreCoef: 0,
    bullishCoef: 0,
    bearishCoef: 0,
    trainedAt: new Date().toISOString(),
    sampleSize: 0,
    accuracy: 0.5,
  };
}

// ── Tier-based probability (Free plan / no training data) ──

/** Pre-computed win rates by score tier (from SightWhale backtest aggregates). */
const TIER_WIN_RATES: Record<string, number> = {
  '90–100': 0.72,
  '80–89':  0.65,
  '70–79':  0.58,
  '<70':    0.52,
};

/**
 * Rough probability estimate from score tier alone.
 * Used as fallback when the logistic model has insufficient training data.
 */
export function tierProbability(score: number, direction: Direction): number {
  let tierKey: string;
  if (score >= 90) tierKey = '90–100';
  else if (score >= 80) tierKey = '80–89';
  else if (score >= 70) tierKey = '70–79';
  else tierKey = '<70';

  const baseProb = TIER_WIN_RATES[tierKey] ?? 0.5;

  // Small directional adjustment (±3%)
  if (direction === 'bearish') return baseProb - 0.03;
  if (direction === 'bullish') return baseProb + 0.03;
  return baseProb;
}

// ── Helpers ────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
