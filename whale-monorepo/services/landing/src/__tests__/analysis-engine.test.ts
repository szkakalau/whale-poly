import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  sizeScore,
  timeDecayScore,
  walletWeight,
  classifyConfidence,
  classifyDirection,
} from '@/lib/analysis-engine';
import type { LiveSignal } from '@/lib/live-signals';
import { resolveMarketSlug, slugToSearchQuery } from '@/lib/nl-matcher';

/**
 * Unit tests for AnalysisEngine scoring logic.
 *
 * Imports pure functions directly from the source module — no code duplication.
 * TC-H6: previously duplicated these 6 functions; now tests run against the
 * same code that ships to production.
 */

// ── Test helpers ──────────────────────────────────────

function makeSignal(overrides: Partial<LiveSignal> = {}): LiveSignal {
  return {
    id: 'sig-test-1',
    occurredAt: '2026-05-29T12:00:00Z',
    walletMasked: '0xabc...123',
    market: 'test-market',
    side: 'BUY',
    sizeUsd: 50_000,
    whaleScore: 70,
    ...overrides,
  };
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
    const signal = makeSignal({ sizeUsd: 50_000, occurredAt: '2026-05-29T12:00:00Z', whaleScore: 70 });
    // size: 80*0.4=32, time: 100*0.3=30, conviction: 70*0.3=21 → 83
    const w = walletWeight(signal, now);
    expect(w).toBeCloseTo(83, -1);
  });

  it('should default conviction to 50 when whaleScore is missing', () => {
    const signal = makeSignal({ sizeUsd: 50_000, occurredAt: '2026-05-29T12:00:00Z' });
    delete signal.whaleScore;
    // size: 32, time: 30, conviction: 50*0.3=15 → 77
    const w = walletWeight(signal, now);
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
    // Both > 20% of total → mixed
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

describe('slugToSearchQuery', () => {
  it('should humanize event slugs for fallback market search', () => {
    expect(slugToSearchQuery('2026-nba-champion')).toBe('2026 nba champion');
    expect(slugToSearchQuery('will_btc_hit_150k')).toBe('will btc hit 150k');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should retry URL searches with a humanized slug before falling back', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            slug: 'who-will-win-the-2026-nba-championship',
            title: 'Who will win the 2026 NBA Championship?',
            conditionId: 'cond_1',
            outcomes: ['YES', 'NO'],
            outcomePrices: [0.5, 0.5],
            closed: false,
            volume24hr: 123456,
          },
        ],
      });

    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveMarketSlug('https://polymarket.com/event/2026-nba-champion');

    expect(result.matched).toBe('url');
    expect(result.slug).toBe('who-will-win-the-2026-nba-championship');
    expect(result.candidates).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('title=2026+nba+champion');
  });
});
