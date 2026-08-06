/**
 * Backtesting Engine
 *
 * Loads historical whale alert data with PnL outcomes, computes metrics,
 * and runs walk-forward validation. Uses the same data pipeline as
 * history-signals.ts (alerts + whale_trade_history + trades_raw).
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  computeAllMetrics,
  computeBaselines,
  computeTierBreakdown,
  createWalkForwardFolds,
  type BacktestMetrics,
  type BaselineComparison,
  type TierSummary,
} from '@/lib/backtesting/metrics';
import { summarizeHistoryRows, type HistorySignalRow } from '@/lib/history-signals';

// ── Types ──────────────────────────────────────────────

export type BacktestConfig = {
  startDate: string;       // ISO date
  endDate: string;         // ISO date
  minWhaleScore: number;   // filter trades below this score
  minTradeSize: number;    // filter trades below this USD size
  planTier: 'free' | 'pro' | 'elite';
  walkForward?: {
    enabled: boolean;
    trainDays: number;
    testDays: number;
    stepDays: number;
  };
};

export type BacktestReport = {
  config: BacktestConfig;
  period: { start: string; end: string };
  totalSignals: number;
  settledSignals: number;
  metrics: BacktestMetrics;
  byScoreTier: TierSummary[];
  baselineComparison: BaselineComparison;
  walkForward?: {
    folds: number;
    avgOosAccuracy: number | null;
    avgOosWinRate: number | null;
    avgOosSharpe: number | null;
  };
};

// ── Raw row from the backtest query ────────────────────

type BacktestRow = {
  id: string;
  published_at: Date;
  market_title: string | null;
  whale_score: number | null;
  trade_side: string | null;
  entry_price: number | null;
  trade_size_usd: number | null;
  pnl: number | null;
  trade_usd: number | null;
  settled_at: Date | null;
};

// ── Query ──────────────────────────────────────────────

/**
 * Fetch historical alert data suitable for backtesting.
 * Filters to trades with non-null PnL (settled/resolved).
 */
export async function loadBacktestData(
  config: BacktestConfig,
): Promise<BacktestRow[]> {
  const startDate = new Date(config.startDate);
  const endDate = new Date(config.endDate);

  try {
    const rows = await prisma.$queryRaw<BacktestRow[]>(
      Prisma.sql`
        SELECT
          a.id,
          a.created_at AS published_at,
          COALESCE(NULLIF(TRIM(m.title), ''), a.market_id) AS market_title,
          a.whale_score,
          wth.side AS trade_side,
          wth.price::float AS entry_price,
          wth.trade_usd::float AS trade_size_usd,
          wth.pnl::float AS pnl,
          wth.trade_usd::float AS trade_usd,
          wth.timestamp AS settled_at
        FROM alerts a
        JOIN whale_trade_history wth ON wth.trade_id = a.whale_trade_id
        LEFT JOIN markets m ON m.id = a.market_id
        WHERE a.created_at >= ${startDate}
          AND a.created_at < ${endDate}
          AND wth.pnl IS NOT NULL
          AND ABS(wth.pnl) > 1e-9
          AND a.whale_score >= ${config.minWhaleScore}
          AND wth.trade_usd >= ${config.minTradeSize}
        ORDER BY a.created_at ASC
      `
    );
    return rows || [];
  } catch (err) {
    console.error('loadBacktestData: query failed', err);
    return [];
  }
}

// ── Core engine ────────────────────────────────────────

function rowToRoi(row: BacktestRow): number | null {
  const pnl = Number(row.pnl);
  const tradeUsd = Number(row.trade_usd);
  if (!Number.isFinite(pnl) || !Number.isFinite(tradeUsd) || tradeUsd <= 0) return null;
  return pnl / tradeUsd;
}

/** Determine if the trade direction was correct based on PnL. */
function isDirectionCorrect(row: BacktestRow): boolean {
  const pnl = Number(row.pnl);
  const side = (row.trade_side || '').toUpperCase();
  // BUY with positive PnL = correct bullish call
  // SELL with positive PnL = correct bearish call
  if (side === 'BUY') return pnl > 0;
  if (side === 'SELL') return pnl > 0;
  return false;
}

function scoreToTier(score: number | null): string {
  if (score == null) return '<70';
  if (score >= 90) return '90–100';
  if (score >= 80) return '80–89';
  if (score >= 70) return '70–79';
  return '<70';
}

/**
 * Run a backtest over the configured period.
 */
export async function runBacktest(config: BacktestConfig): Promise<BacktestReport> {
  const rows = await loadBacktestData(config);

  // Extract metrics arrays
  const returns: number[] = [];
  const predictedBullish: boolean[] = [];
  const pnls: number[] = [];
  const holdingDays: number[] = [];
  const tiers: string[] = [];

  for (const row of rows) {
    const roi = rowToRoi(row);
    if (roi == null) continue;

    returns.push(roi);
    pnls.push(Number(row.pnl) || 0);
    predictedBullish.push((row.trade_side || '').toUpperCase() === 'BUY');
    tiers.push(scoreToTier(row.whale_score));

    // Approximate holding days
    const entry = new Date(row.published_at).getTime();
    const exit = row.settled_at ? new Date(row.settled_at).getTime() : entry;
    holdingDays.push(Math.max(0, (exit - entry) / 86_400_000));
  }

  const settledSignals = returns.length;

  // Compute full-period metrics
  const metrics = computeAllMetrics(returns, predictedBullish, pnls, holdingDays);
  const baselineComparison = computeBaselines(returns, metrics.winRate, metrics.avgRoi);
  const byScoreTier = computeTierBreakdown(tiers, returns);

  // Walk-forward (if enabled)
  let walkForward: BacktestReport['walkForward'] | undefined;
  if (config.walkForward?.enabled && rows.length > 20) {
    const dates = rows.map(r => r.published_at instanceof Date
      ? r.published_at.toISOString()
      : String(r.published_at));

    const folds = createWalkForwardFolds(
      dates,
      config.walkForward.trainDays,
      config.walkForward.testDays,
      config.walkForward.stepDays,
    );

    if (folds.length > 0) {
      const foldAccuracies: number[] = [];
      const foldWinRates: number[] = [];
      const foldSharpes: (number | null)[] = [];

      for (const fold of folds) {
        const testReturns = fold.testIndices.map(i => returns[i]).filter(r => r != null);
        const testPnls = fold.testIndices.map(i => pnls[i]).filter(p => p != null);
        const testBullish = fold.testIndices.map(i => predictedBullish[i]);
        const testHolding = fold.testIndices.map(i => holdingDays[i]);

        if (testReturns.length < 5) continue;

        const foldMetrics = computeAllMetrics(testReturns, testBullish, testPnls, testHolding);
        foldAccuracies.push(foldMetrics.accuracy);
        foldWinRates.push(foldMetrics.winRate);
        if (foldMetrics.sharpeRatio != null) foldSharpes.push(foldMetrics.sharpeRatio);
      }

      walkForward = {
        folds: folds.length,
        avgOosAccuracy: foldAccuracies.length > 0
          ? foldAccuracies.reduce((s, a) => s + a, 0) / foldAccuracies.length
          : null,
        avgOosWinRate: foldWinRates.length > 0
          ? foldWinRates.reduce((s, w) => s + w, 0) / foldWinRates.length
          : null,
        avgOosSharpe: foldSharpes.length > 0
          ? (foldSharpes as number[]).reduce((s, sh) => s + sh, 0) / foldSharpes.length
          : null,
      };
    }
  }

  return {
    config,
    period: { start: config.startDate, end: config.endDate },
    totalSignals: rows.length,
    settledSignals,
    metrics,
    byScoreTier,
    baselineComparison,
    walkForward,
  };
}

/**
 * Lightweight backtest summary suitable for non-Elite tiers.
 * Returns only win rate by score tier (uses existing history-signals).
 */
export async function runBasicBacktest(
  startDate: string,
  endDate: string,
): Promise<{ total: number; winRate: number | null; avgRoi: number | null }> {
  // Reuse the existing history pipeline which already computes these summaries
  const rows = await prisma.$queryRaw<HistorySignalRow[]>(
    Prisma.sql`
      SELECT
        a.id,
        a.created_at AS "publishedAt",
        COALESCE(NULLIF(TRIM(m.title), ''), a.market_id) AS "marketTitle",
        a.whale_score::float8 AS "whaleScore",
        tr.price::float8 AS "publishPrice",
        tr.outcome AS "outcomeLabel",
        tr.side AS "sideLabel",
        (tr.amount::numeric * tr.price::numeric)::float8 AS "sizeUsd",
        COALESCE(NULLIF(TRIM(wt.wallet_address), ''), NULLIF(TRIM(a.wallet_address), '')) AS "walletMasked",
        NULL::float8 AS "endPrice",
        wth.pnl::float8 AS "realizedPnlUsd",
        wth.pnl::float8 AS "computedPnlUsd",
        CASE WHEN wth.trade_usd > 0 THEN wth.pnl::float8 / wth.trade_usd::float8 ELSE NULL END AS "roiPct"
      FROM alerts a
      JOIN whale_trade_history wth ON wth.trade_id = a.whale_trade_id
      LEFT JOIN whale_trades wt ON wt.trade_id = wth.trade_id
      LEFT JOIN trades_raw tr ON tr.trade_id = wth.trade_id
      LEFT JOIN markets m ON m.id = a.market_id
      WHERE a.created_at >= ${new Date(startDate)}
        AND a.created_at < ${new Date(endDate)}
        AND wth.pnl IS NOT NULL
        AND ABS(wth.pnl) > 1e-9
      ORDER BY a.created_at DESC
      LIMIT 500
    `
  );

  const filtered = (rows || []).filter(r => r.roiPct != null && Number.isFinite(r.roiPct));
  return summarizeHistoryRows(filtered as unknown as HistorySignalRow[]);
}
