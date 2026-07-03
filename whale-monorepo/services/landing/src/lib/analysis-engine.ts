import { loadSignalsForMarket, type LiveSignal } from '@/lib/live-signals';
import { fetchMarketCategories, getWalletCategoryStats } from '@/lib/market-categories';

// ── Types ──────────────────────────────────────────────

export type Direction = 'bullish' | 'bearish' | 'neutral' | 'mixed';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

export type WalletEvidence = {
  addressShort: string;
  action: 'BUY' | 'SELL' | 'UNKNOWN';
  amountUsd: number;
  price?: number;
  outcome: string;
  timestamp: string;
  walletWeight: number; // 0-100
  categoryStats?: {
    category: string;
    totalTrades: number;
    winRate: number;
  }[];
};

export type AnalysisResult = {
  marketSlug: string;
  direction: Direction;
  confidenceLevel: ConfidenceLevel;
  confidenceScore: number; // 0-100
  topWallets: WalletEvidence[];
  whaleTradeCount: number;
  yesVolumeUsd: number;
  noVolumeUsd: number;
  dataFreshness: {
    lastUpdated: string;
    stalenessMinutes: number;
  };
  disclaimer: string;
  followedActivity: boolean; // E7: true if any followed wallet had trades in this market
};

// ── Constants ──────────────────────────────────────────

const DISCLAIMER = 'ⓘ Not financial advice. Signals are based on historical data and do not guarantee future results. Trade at your own risk.';

const MIN_TRADE_USD = 5_000; // trades below 5k are not "whale" trades
const CONFIDENCE_THRESHOLDS = { low: 40, medium: 70 } as const; // 0-40=low, 41-70=medium, 71-100=high
const DIRECTION_RATIO_THRESHOLD = 0.2; // YES/NO ratio diff > 20% → direction signal
const MIN_TRADES_FOR_SIGNAL = 3; // fewer than 3 trades → neutral/low confidence
const LOOKBACK_HOURS = 24;

// ── Helpers ────────────────────────────────────────────

export function sizeScore(amountUsd: number): number {
  if (amountUsd >= 100_000) return 100;
  if (amountUsd >= 50_000) return 80;
  if (amountUsd >= 20_000) return 60;
  if (amountUsd >= MIN_TRADE_USD) return 30;
  return 0;
}

export function timeDecayScore(tradeDate: string, now: Date): number {
  const tradeTs = new Date(tradeDate).getTime();
  const elapsedSec = (now.getTime() - tradeTs) / 1000;
  const maxSec = LOOKBACK_HOURS * 3600;
  return Math.max(0, 100 * (1 - elapsedSec / maxSec));
}

export function walletWeight(signal: LiveSignal, now: Date, _cumulativeSameOutcomeUsd?: number, _cumulativeTotalUsd?: number): number {
  const sz = sizeScore(signal.sizeUsd);
  const td = timeDecayScore(signal.occurredAt, now);
  // convictionScore: use wallet's total engagement as proxy (simplified — whaleScore if available)
  let conviction = 50; // neutral default
  if (signal.whaleScore != null && Number.isFinite(signal.whaleScore)) {
    conviction = Math.min(100, Math.max(0, (signal.whaleScore / 100) * 100));
  }
  return sz * 0.4 + td * 0.3 + conviction * 0.3;
}

export function classifyConfidence(score: number): ConfidenceLevel {
  if (score > CONFIDENCE_THRESHOLDS.medium) return 'high';
  if (score > CONFIDENCE_THRESHOLDS.low) return 'medium';
  return 'low';
}

export function classifyDirection(yesVolume: number, noVolume: number, tradeCount: number): Direction {
  if (tradeCount < MIN_TRADES_FOR_SIGNAL) return 'neutral';
  const total = yesVolume + noVolume;
  if (total === 0) return 'neutral';

  // Rule 1: conflicting signals (highest priority)
  if (yesVolume > total * DIRECTION_RATIO_THRESHOLD && noVolume > total * DIRECTION_RATIO_THRESHOLD) {
    return 'mixed';
  }

  // Rules 2-4: directional
  const ratio = (yesVolume - noVolume) / total;
  if (ratio > DIRECTION_RATIO_THRESHOLD) return 'bullish';
  if (ratio < -DIRECTION_RATIO_THRESHOLD) return 'bearish';
  return 'neutral';
}

// ── Public API ─────────────────────────────────────────

export async function analyzeMarket(
  marketSlug: string,
  options?: { followedWallets?: string[] },
): Promise<AnalysisResult> {
  const now = new Date();
  const signals = await loadSignalsForMarket(marketSlug, LOOKBACK_HOURS);
  const followedSet = new Set((options?.followedWallets || []).map((w) => w.toLowerCase().trim()));

  // Compute YES/NO volumes
  let yesVolumeUsd = 0;
  let noVolumeUsd = 0;
  let followedActivity = false;
  const walletWeights: Map<string, { weight: number; signal: LiveSignal }> = new Map();

  for (const s of signals) {
    let w = walletWeight(s, now);

    // E7: Boost weight for followed wallets (1.5x, capped at 100)
    if (followedSet.size > 0 && followedSet.has(s.walletMasked.toLowerCase())) {
      w = Math.min(100, w * 1.5);
      followedActivity = true;
    }

    const key = `${s.walletMasked}-${s.occurredAt}`;
    walletWeights.set(key, { weight: w, signal: s });

    if (s.side === 'BUY') {
      // BUY = YES side by default (simplified — would need outcome mapping for multi-outcome)
      yesVolumeUsd += s.sizeUsd;
    } else if (s.side === 'SELL') {
      noVolumeUsd += s.sizeUsd;
    }
  }

  const direction = classifyDirection(yesVolumeUsd, noVolumeUsd, signals.length);

  // Aggregate confidence score (amount-weighted average of per-wallet weights)
  const totalVolume = yesVolumeUsd + noVolumeUsd;
  let confidenceScore = 0;
  if (totalVolume > 0) {
    for (const [, { weight, signal }] of walletWeights) {
      confidenceScore += weight * (signal.sizeUsd / totalVolume);
    }
  }
  confidenceScore = Math.round(Math.min(100, Math.max(0, confidenceScore)));

  // Build wallet evidence (top wallets by weight)
  const evidence: WalletEvidence[] = [...walletWeights.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map(({ weight, signal }) => ({
      addressShort: signal.walletMasked,
      action: signal.side,
      amountUsd: signal.sizeUsd,
      outcome: signal.side === 'BUY' ? 'YES' : signal.side === 'SELL' ? 'NO' : 'UNKNOWN',
      timestamp: signal.occurredAt,
      walletWeight: Math.round(weight),
    }));

  // Phase 0.5: Enrich evidence with per-category wallet stats (non-blocking)
  const marketCats = await fetchMarketCategories(marketSlug).catch(() => [] as string[]);
  if (marketCats.length > 0) {
    const uniqueWallets = [...new Set(evidence.map((e) => e.addressShort))];
    for (const wallet of uniqueWallets) {
      try {
        const stats = await getWalletCategoryStats(wallet, marketCats);
        if (stats.length > 0) {
          const ev = evidence.find((e) => e.addressShort === wallet);
          if (ev) {
            ev.categoryStats = stats
              .filter((s) => s.totalTrades >= 3) // require min trades for meaningful stats
              .slice(0, 3)
              .map((s) => ({
                category: s.category,
                totalTrades: s.totalTrades,
                winRate: s.winRate,
              }));
          }
        }
      } catch {
        // Non-blocking — evidence is still useful without category stats
      }
    }
  }

  // Data freshness: use most recent trade timestamp
  const lastUpdated = signals.length > 0
    ? new Date(Math.max(...signals.map(s => new Date(s.occurredAt).getTime()))).toISOString()
    : now.toISOString();
  const stalenessMinutes = Math.round((now.getTime() - new Date(lastUpdated).getTime()) / 60_000);

  // If direction is mixed, override confidence level to at most 'medium'
  let confidenceLevel = classifyConfidence(confidenceScore);
  if (direction === 'mixed' && confidenceLevel === 'high') {
    confidenceLevel = 'medium';
  }
  // If too few trades, force low confidence
  if (signals.length < MIN_TRADES_FOR_SIGNAL) {
    confidenceLevel = 'low';
  }

  return {
    marketSlug,
    direction,
    confidenceLevel,
    confidenceScore,
    topWallets: evidence,
    whaleTradeCount: signals.length,
    yesVolumeUsd,
    noVolumeUsd,
    dataFreshness: {
      lastUpdated,
      stalenessMinutes,
    },
    disclaimer: DISCLAIMER,
    followedActivity,
  };
}

/**
 * Returns a human-readable message for cases where no analysis is possible.
 */
export function getEmptyMessage(marketSlug: string): string {
  return `No large whale trades (≥ $${(MIN_TRADE_USD / 1000).toFixed(0)}k) matched "${marketSlug}" in the past ${LOOKBACK_HOURS} hours. This can mean no qualifying whale activity, delayed ingestion, or that the event URL maps to a different market slug in our dataset.`;
}

/**
 * Returns a limited-data warning.
 */
export function getLimitedDataMessage(tradeCount: number): string {
  return `⚠️ Limited data — only ${tradeCount} whale trade(s) detected. More data points are needed for a reliable direction signal.`;
}

/**
 * Returns a staleness warning when data is older than threshold.
 */
export function getStalenessMessage(stalenessMinutes: number): string {
  const hours = Math.floor(stalenessMinutes / 60);
  return `⚠️ Data last updated ${hours} hours ago. May not reflect the latest market activity.`;
}

/**
 * Returns a mixed-signal explanation.
 */
export function getMixedMessage(bullishCount: number, bearishCount: number): string {
  return `⚠️ Whale signals are divided — ${bullishCount} wallet(s) bullish, ${bearishCount} wallet(s) bearish. Signal confidence is low.`;
}
