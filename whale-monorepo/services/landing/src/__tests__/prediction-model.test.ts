/**
 * Unit tests for prediction-model.ts
 *
 * Covers: sigmoid, predictProbability, extractFeaturesAndLabels,
 * trainModel, tierProbability.
 */

import { describe, it, expect } from 'vitest';
import {
  sigmoid,
  predictProbability,
  extractFeaturesAndLabels,
  trainModel,
  tierProbability,
  type ProbabilityModel,
  type TrainingRow,
} from '@/lib/prediction-model';

// ── sigmoid ────────────────────────────────────────────

describe('sigmoid', () => {
  it('z=0 → 0.5', () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 4);
  });

  it('z > 20 → 1 (clamped)', () => {
    expect(sigmoid(25)).toBe(1);
    expect(sigmoid(100)).toBe(1);
  });

  it('z < -20 → 0 (clamped)', () => {
    expect(sigmoid(-25)).toBe(0);
    expect(sigmoid(-100)).toBe(0);
  });

  it('positive z → > 0.5', () => {
    const v = sigmoid(1);
    expect(v).toBeGreaterThan(0.5);
    expect(v).toBeCloseTo(0.7311, 2);
  });

  it('negative z → < 0.5', () => {
    const v = sigmoid(-1);
    expect(v).toBeLessThan(0.5);
    expect(v).toBeCloseTo(0.2689, 2);
  });
});

// ── predictProbability ─────────────────────────────────

describe('predictProbability', () => {
  const model: ProbabilityModel = {
    intercept: 0.5,
    scoreCoef: 2.0,
    bullishCoef: 0.3,
    bearishCoef: -0.3,
    trainedAt: new Date().toISOString(),
    sampleSize: 100,
    accuracy: 0.72,
  };

  it('high score + bullish → high P(YES)', () => {
    // z = 0.5 + 2.0*(0.85) + 0.3*1 + (-0.3)*0 = 0.5 + 1.7 + 0.3 = 2.5
    // P(correct) = sigmoid(2.5) ≈ 0.924
    // bullish → P(YES) = P(correct)
    const p = predictProbability(85, 'bullish', model);
    expect(p).toBeGreaterThan(0.85);
    expect(p).toBeCloseTo(0.924, 2);
  });

  it('high score + bearish → low P(YES)', () => {
    // z = 0.5 + 2.0*(0.85) + 0.3*0 + (-0.3)*1 = 0.5 + 1.7 - 0.3 = 1.9
    // P(correct) = sigmoid(1.9) ≈ 0.87
    // bearish → P(YES) = 1 - P(correct) ≈ 0.13
    const p = predictProbability(85, 'bearish', model);
    expect(p).toBeLessThan(0.2);
    expect(p).toBeCloseTo(1 - 0.8699, 2);
  });

  it('low score → near 0.5 with mild bias', () => {
    const p = predictProbability(50, 'bullish', model);
    // z = 0.5 + 2.0*(0.5) + 0.3 = 1.8 → σ ≈ 0.858, bullish → stays as-is
    expect(p).toBeGreaterThan(0.55);
  });

  it('neutral direction uses score only', () => {
    const pBull = predictProbability(70, 'bullish', model);
    const pNeutral = predictProbability(70, 'neutral', model);
    // neutral gets no directional bonus
    expect(pBull).toBeGreaterThan(pNeutral);
  });

  it('mixed direction same as neutral', () => {
    const pNeutral = predictProbability(70, 'neutral', model);
    const pMixed = predictProbability(70, 'mixed', model);
    expect(pMixed).toBeCloseTo(pNeutral, 4);
  });
});

// ── extractFeaturesAndLabels ────────────────────────────

describe('extractFeaturesAndLabels', () => {
  it('BUY + positive PnL → label 1 (2-feature)', () => {
    const rows: TrainingRow[] = [
      { whaleScore: 85, side: 'BUY', pnl: 500 },
    ];
    const { features, labels } = extractFeaturesAndLabels(rows);
    // 2-element features: [score/100, isBullish] — isBearish removed (dummy variable trap)
    expect(features[0]).toEqual([0.85, 1]);
    expect(labels[0]).toBe(1);
  });

  it('BUY + negative PnL → label 0', () => {
    const rows: TrainingRow[] = [
      { whaleScore: 75, side: 'BUY', pnl: -200 },
    ];
    const { labels } = extractFeaturesAndLabels(rows);
    expect(labels[0]).toBe(0);
  });

  it('SELL + positive PnL → label 1 (2-feature)', () => {
    const rows: TrainingRow[] = [
      { whaleScore: 80, side: 'SELL', pnl: 300 },
    ];
    const { features, labels } = extractFeaturesAndLabels(rows);
    // SELL → isBullish=0 (bearish implied by absence of bullish)
    expect(features[0]).toEqual([0.8, 0]);
    expect(labels[0]).toBe(1);
  });

  it('SELL + negative PnL → label 0', () => {
    const rows: TrainingRow[] = [
      { whaleScore: 60, side: 'SELL', pnl: -150 },
    ];
    const { labels } = extractFeaturesAndLabels(rows);
    expect(labels[0]).toBe(0);
  });
});

// ── trainModel ──────────────────────────────────────────

describe('trainModel', () => {
  it('converges on synthetic linearly separable data', () => {
    // Generate synthetic data: BUY with high score → win, SELL with high score → win
    const rows: TrainingRow[] = [];
    for (let i = 0; i < 100; i++) {
      const score = 50 + Math.random() * 50; // 50-100
      if (Math.random() > 0.5) {
        // BUY — high score wins, low score loses
        const wins = score > 70;
        rows.push({
          whaleScore: score,
          side: 'BUY',
          pnl: wins ? 100 + Math.random() * 100 : -(100 + Math.random() * 100),
        });
      } else {
        // SELL — high score wins, low score loses
        const wins = score > 70;
        rows.push({
          whaleScore: score,
          side: 'SELL',
          pnl: wins ? 100 + Math.random() * 100 : -(100 + Math.random() * 100),
        });
      }
    }

    const model = trainModel(rows);
    // Higher score → more confident
    const pHigh = predictProbability(90, 'bullish', model);
    const pLow = predictProbability(55, 'bullish', model);
    expect(pHigh).toBeGreaterThan(pLow);

    // Accuracy should be better than random
    expect(model.accuracy).toBeGreaterThan(0.55);
    expect(model.sampleSize).toBe(100);
  });

  it('returns fallback model for empty data', () => {
    const model = trainModel([]);
    expect(model.sampleSize).toBe(0);
    expect(model.intercept).toBe(0);
    expect(model.scoreCoef).toBe(0);
    // With fallback model, P=0.5 for any input
    const p = predictProbability(90, 'bullish', model);
    expect(p).toBeCloseTo(0.5, 2);
  });

  it('returns fallback model for < 5 samples', () => {
    const rows: TrainingRow[] = [
      { whaleScore: 80, side: 'BUY', pnl: 100 },
      { whaleScore: 70, side: 'SELL', pnl: 50 },
    ];
    const model = trainModel(rows);
    expect(model.sampleSize).toBe(0);
  });
});

// ── tierProbability ─────────────────────────────────────

describe('tierProbability', () => {
  it('high score bullish → > 0.7', () => {
    const p = tierProbability(92, 'bullish');
    expect(p).toBeGreaterThan(0.7);
  });

  it('high score bearish → adjusted down', () => {
    const pBull = tierProbability(92, 'bullish');
    const pBear = tierProbability(92, 'bearish');
    expect(pBear).toBeLessThan(pBull);
  });

  it('low score → near 0.5', () => {
    const p = tierProbability(60, 'neutral');
    expect(p).toBeCloseTo(0.52, 1);
  });

  it('mid score → proportional', () => {
    const pHigh = tierProbability(95, 'bullish');
    const pMid = tierProbability(75, 'bullish');
    expect(pHigh).toBeGreaterThan(pMid);
  });
});
