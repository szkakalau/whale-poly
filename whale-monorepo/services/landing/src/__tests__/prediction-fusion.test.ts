/**
 * Unit tests for prediction-fusion.ts
 *
 * Covers: clamp, directionToSigned, behaviorToSigned, vwDivergenceToScore,
 * computeAgreement, fuseBasicSignals, fuseSignals.
 */

import { describe, it, expect } from 'vitest';
import {
  fuseSignals,
  fuseBasicSignals,
  type FusionConfig,
  type AnalysisResult,
} from '@/lib/prediction-fusion';

// ── Test helpers ──────────────────────────────────────

function makeAnalysis(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    marketSlug: 'test-market',
    direction: 'bullish',
    confidenceLevel: 'high',
    confidenceScore: 85,
    whaleTradeCount: 5,
    topWallets: [
      { addressShort: '0xabc1', action: 'BUY', amountUsd: 50_000, outcome: 'YES', timestamp: new Date().toISOString(), walletWeight: 88 },
      { addressShort: '0xabc2', action: 'BUY', amountUsd: 25_000, outcome: 'YES', timestamp: new Date().toISOString(), walletWeight: 75 },
    ],
    yesVolumeUsd: 120_000,
    noVolumeUsd: 30_000,
    dataFreshness: { lastUpdated: new Date().toISOString(), stalenessMinutes: 0 },
    disclaimer: '',
    followedActivity: false,
    ...overrides,
  };
}

const DEFAULT_CONFIG: FusionConfig = {
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

// ── fuseBasicSignals (Free tier) ──────────────────────

describe('fuseBasicSignals', () => {
  it('should return a valid fusion result for basic input', () => {
    const analysis = makeAnalysis();
    const result = fuseBasicSignals('test-market', analysis);

    expect(result.marketSlug).toBe('test-market');
    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
    expect(result.direction).toBe('bullish');
    expect(result.signalComponents.length).toBeGreaterThanOrEqual(1);
    expect(result.timestamp).toBeDefined();
  });

  it('should return neutral direction for neutral analysis', () => {
    const analysis = makeAnalysis({ direction: 'neutral', confidenceScore: 30 });
    const result = fuseBasicSignals('neutral-market', analysis);
    expect(result.direction).toBe('neutral');
  });

  it('should return bearish direction for bearish analysis', () => {
    const analysis = makeAnalysis({ direction: 'bearish', yesVolumeUsd: 30_000, noVolumeUsd: 120_000 });
    const result = fuseBasicSignals('bearish-market', analysis);
    expect(result.direction).toBe('bearish');
  });

  it('should have lower score with 0 trades', () => {
    const analysis = makeAnalysis({
      whaleTradeCount: 0,
      topWallets: [],
      confidenceScore: 30,
      direction: 'neutral',
    });
    const result = fuseBasicSignals('empty-market', analysis);
    // Flow direction is always included; with neutral direction + low confidence → lower score
    expect(result.compositeScore).toBeLessThanOrEqual(50);
  });
});

// ── fuseSignals (Full fusion) ─────────────────────────

describe('fuseSignals', () => {
  it('should fuse all 4 signals when all inputs provided', () => {
    const analysis = makeAnalysis();
    const result = fuseSignals(
      'test-market',
      analysis,
      { whaleScore: 85, direction: 'bullish' },
      { behaviorType: 'build', side: 'BUY' },
      { vwDivergence: 0.15, uai: 0.6, signalDirection: 'bullish', signalStrength: 70 },
      DEFAULT_CONFIG,
    );

    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
    expect(result.signalComponents.length).toBe(4);
    expect(result.dominantSignal).toBeDefined();
    expect(result.agreementScore).toBeGreaterThanOrEqual(0);
  });

  it('should re-normalize weights when some signals are null', () => {
    const analysis = makeAnalysis();
    // Only provide whale_quality and flow; behavior and vw are null
    const result = fuseSignals(
      'test-market',
      analysis,
      { whaleScore: 85, direction: 'bullish' },
      null,
      null,
      DEFAULT_CONFIG,
    );

    // Should still produce a valid score with re-normalized weights
    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.signalComponents.length).toBe(2);
  });

  it('should fall back to flow-only when whale/behavior/vw are null', () => {
    const analysis = makeAnalysis({ whaleTradeCount: 0, topWallets: [], confidenceScore: 40 });
    const result = fuseSignals(
      'empty-market',
      analysis,
      null,
      null,
      null,
      DEFAULT_CONFIG,
    );

    // Only flow_direction component (always present)
    expect(result.signalComponents.length).toBe(1);
    expect(result.signalComponents[0].source).toBe('flow_direction');
    expect(result.confidenceLevel).toBe('low'); // < 2 signals → low
  });

  it('should award agreement bonus when signals point same direction', () => {
    const analysis = makeAnalysis({ direction: 'bullish' });
    const result = fuseSignals(
      'agreement-market',
      analysis,
      { whaleScore: 85, direction: 'bullish' },
      { behaviorType: 'build', side: 'BUY' },
      { vwDivergence: 0.20, uai: 0.7, signalDirection: 'bullish', signalStrength: 80 },
      DEFAULT_CONFIG,
    );

    // With all 4 signals bullish, agreementScore should be high
    expect(result.agreementScore).toBeGreaterThan(60);
  });

  it('should apply conflict penalty when signals disagree', () => {
    const analysis = makeAnalysis({ direction: 'bullish' });
    const result = fuseSignals(
      'conflict-market',
      analysis,
      { whaleScore: 85, direction: 'bullish' },
      { behaviorType: 'exit', side: 'SELL' },
      { vwDivergence: -0.15, uai: 0.3, signalDirection: 'bearish', signalStrength: 65 },
      DEFAULT_CONFIG,
    );

    // Whale quality bullish vs behavior+VW bearish — conflict
    expect(result.agreementScore).toBeLessThan(50);
  });

  it('should correctly weight dominant signal', () => {
    const analysis = makeAnalysis();
    // Custom config: whale_quality dominates
    const config: FusionConfig = {
      weights: { whale_quality: 0.7, behavior: 0.1, vw_analysis: 0.1, flow_direction: 0.1 },
      agreementBonus: 1.2,
      conflictPenalty: 0.7,
      agreementThreshold: 0.7,
      conflictThreshold: 0.3,
      directionThreshold: 15,
    };

    const result = fuseSignals(
      'whale-heavy',
      analysis,
      { whaleScore: 95, direction: 'bullish' },
      { behaviorType: null, side: 'UNKNOWN' },
      { vwDivergence: 0.01, uai: null, signalDirection: 'neutral', signalStrength: 10 },
      config,
    );

    expect(result.dominantSignal).toBe('whale_quality');
    expect(result.compositeScore).toBeGreaterThan(55);
  });
});
