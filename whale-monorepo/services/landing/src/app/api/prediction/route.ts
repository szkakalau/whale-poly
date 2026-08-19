/**
 * GET /api/prediction?market=xxx[&tier=PRO]
 *
 * Returns a fused prediction for a single market by combining
 * whale quality, behavior, VW divergence, and flow direction signals.
 *
 * Plan gating:
 *   - Free: basic fusion (flow + behavior only, via fuseBasicSignals)
 *   - Pro/Elite: full fusion with whale quality + VW metrics + logistic probability
 *
 * Probability model: logistic regression trained on backtest data,
 * cached at module level with 60-minute TTL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { analyzeMarket } from '@/lib/analysis-engine';
import { fuseSignals, fuseBasicSignals, type FusionResult } from '@/lib/prediction-fusion';
import { getCurrentUser } from '@/lib/auth';
import { effectivePlan } from '@/lib/plans';
import { getVwMetrics } from '@/lib/vw-signals';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  trainModel,
  predictProbability,
  tierProbability,
  type ProbabilityModel,
  type TrainingRow,
} from '@/lib/prediction-model';
import {
  loadPersistedModel,
  savePersistedModel,
  fetchTierWinRates,
  type TierWinRates,
} from '@/lib/prediction-model-store';
import { loadBacktestData } from '@/lib/backtesting/engine';

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
};

function cached(body: object, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...(init?.headers as Record<string, string> | undefined), ...CACHE_HEADERS },
  });
}

// ── Model cache ─────────────────────────────────────────

let _cachedModel: ProbabilityModel | null = null;
let _modelTrainedAt = 0; // epoch ms
let _trainingPromise: Promise<ProbabilityModel | null> | null = null; // dedup concurrent training
let _cacheRetryAfter = 0; // epoch ms — independent retry backoff (fixes backoff when cachedModel is null)
const MODEL_TTL_MS = 24 * 60 * 60 * 1000; // persisted models are valid for 24h
const MODEL_RETRY_MS = 5 * 60 * 1000;  // 5 minutes (when data too sparse or training fails)

let _tierRatesCache: { rates: TierWinRates; at: number } | null = null;

/** Live calibration win rates, cached 5 minutes. */
async function getTierWinRates(): Promise<TierWinRates> {
  const now = Date.now();
  if (_tierRatesCache && now - _tierRatesCache.at < 5 * 60 * 1000) {
    return _tierRatesCache.rates;
  }
  const rates = await fetchTierWinRates();
  _tierRatesCache = { rates, at: now };
  return rates;
}

async function getModel(): Promise<ProbabilityModel | null> {
  const now = Date.now();

  // Cache hit: model exists and is still fresh
  if (_cachedModel && now - _modelTrainedAt < MODEL_TTL_MS) {
    return _cachedModel;
  }

  // Retry backoff: no cached model and still within cooldown
  if (!_cachedModel && now < _cacheRetryAfter) {
    return null;
  }

  // Deduplicate concurrent training attempts
  if (_trainingPromise) return _trainingPromise;

  _trainingPromise = (async (): Promise<ProbabilityModel | null> => {
    // 1) Try the persisted model first (survives cold starts, auditable).
    try {
      const persisted = await loadPersistedModel();
      if (persisted) {
        _cachedModel = persisted;
        _modelTrainedAt = new Date(persisted.trainedAt).getTime();
        if (persisted.sampleSize > 0 && now - _modelTrainedAt < MODEL_TTL_MS) {
          return _cachedModel; // fresh enough — no retraining needed
        }
      }
    } catch (err) {
      console.error('getModel: loadPersistedModel failed', err);
    }

    try {
      // 2) Train on last 30 days of backtest data and persist the result.
      const endDate = new Date().toISOString().slice(0, 10);
      const startDate = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

      const rows = await loadBacktestData({
        startDate,
        endDate,
        minWhaleScore: 0,
        minTradeSize: 0,
        planTier: 'elite',
      });

      const trainingRows: TrainingRow[] = rows.map(r => ({
        whaleScore: Number(r.whale_score) || 0,
        side: (r.trade_side?.toUpperCase() === 'SELL' ? 'SELL' : 'BUY') as 'BUY' | 'SELL',
        pnl: Number(r.pnl) || 0,
      }));

      if (trainingRows.length >= 20) {
        const trained = trainModel(trainingRows);
        _cachedModel = trained;
        _modelTrainedAt = Date.now();
        try {
          const version = await savePersistedModel(trained);
          console.log(`[prediction] model v${version} persisted (n=${trained.sampleSize}, acc=${trained.accuracy.toFixed(3)})`);
        } catch (err) {
          console.error('getModel: savePersistedModel failed', err);
        }
      } else {
        // Keep whatever persisted model we loaded; retry later.
        _cacheRetryAfter = Date.now() + MODEL_RETRY_MS;
      }
    } catch (err) {
      console.error('getModel: training failed', err);
      _cacheRetryAfter = Date.now() + MODEL_RETRY_MS;
    }

    return _cachedModel;
  })();

  try {
    return await _trainingPromise;
  } finally {
    _trainingPromise = null;
  }
}

/** Attach calibrated probability to a fusion result. */
async function attachProbability(
  prediction: FusionResult,
  model: ProbabilityModel | null,
  plan: string,
): Promise<void> {
  const tierRates = await getTierWinRates();
  if (model && (plan === 'PRO' || plan === 'ELITE')) {
    prediction.probability = predictProbability(
      prediction.compositeScore,
      prediction.direction,
      model,
    );
  } else {
    // Free tier or model not ready: live-calibration tier lookup
    prediction.probability = tierProbability(
      prediction.compositeScore,
      prediction.direction,
      tierRates,
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const marketSlug = searchParams.get('market');

  if (!marketSlug) {
    return cached({ error: 'market parameter is required' }, { status: 400 });
  }

  // Validate slug format: alphanumeric tokens separated by dashes, max 120 chars
  if (!/^[\w][\w-]{0,119}$/.test(marketSlug)) {
    return cached({ error: 'invalid market slug format' }, { status: 400 });
  }

  try {
    // Plan detection: cookie auth first, then fallback to ?tier= query param
    // (used by Telegram bot which calls this API server-to-server).
    // Tier param is ONLY trusted when accompanied by a valid x-internal-secret header.
    const user = await getCurrentUser();
    const tierParam = searchParams.get('tier')?.toUpperCase() as 'FREE' | 'PRO' | 'ELITE' | undefined;
    const gatewaySecret = process.env.INTERNAL_GATEWAY_SECRET;
    // Reject bypass when secret is empty (prevents misconfiguration bypass)
    const tierBypassOk = tierParam && gatewaySecret && gatewaySecret.length >= 16
      && (await headers()).get('x-internal-secret') === gatewaySecret;
    const plan = user
      ? effectivePlan(user)
      : (tierBypassOk && (tierParam === 'PRO' || tierParam === 'ELITE') ? tierParam : 'free' as const);
    const isPaid = plan === 'PRO' || plan === 'ELITE';

    // Run the base analysis (works for all tiers)
    const analysis = await analyzeMarket(marketSlug);

    if (analysis.whaleTradeCount === 0) {
      return cached({
        prediction: null,
        message: `No qualifying whale trades found for "${marketSlug}" in the past 24 hours.`,
      });
    }

    if (isPaid) {
      // Full fusion: get whale quality from DB and VW metrics
      const [vwRows, whaleStats] = await Promise.all([
        getVwMetrics('divergence', 1).catch(() => []),
        (async () => {
          try {
            const rows = await prisma.$queryRaw<{ whale_score: number }[]>(
              Prisma.sql`
                SELECT whale_score::float8 AS whale_score
                FROM whale_stats
                WHERE whale_score IS NOT NULL
                ORDER BY whale_score DESC
                LIMIT 1
              `
            );
            return rows.length > 0 ? Number(rows[0].whale_score) : null;
          } catch {
            return null;
          }
        })(),
      ]);

      const vwMetric = vwRows.length > 0 ? vwRows[0] : null;

      const prediction = fuseSignals(
        marketSlug,
        analysis,
        whaleStats != null ? { whaleScore: whaleStats, direction: analysis.direction } : null,
        analysis.topWallets.length > 0
          ? {
              behaviorType: analysis.whaleTradeCount >= 3 ? 'build' : null,
              side: analysis.direction === 'bullish' ? 'BUY'
                : analysis.direction === 'bearish' ? 'SELL'
                : 'UNKNOWN',
            }
          : null,
        vwMetric
          ? {
              vwDivergence: vwMetric.vwDivergence ?? 0,
              uai: vwMetric.uai ?? null,
              signalDirection: vwMetric.signalDirection ?? 'neutral',
              signalStrength: vwMetric.signalStrength ?? 0,
            }
          : null,
      );

      // Attach calibrated probability (logistic regression for Pro/Elite)
      const model = await getModel();
      await attachProbability(prediction, model, plan);

      return cached({ prediction, tier: plan });
    }

    // Free tier: basic fusion
    const prediction = fuseBasicSignals(marketSlug, analysis);
    await attachProbability(prediction, null, 'free');
    return cached({
      prediction,
      tier: 'free',
      upgradeHint: 'Upgrade to Pro for full fusion predictions with whale quality and VW analysis.',
    });

  } catch (err) {
    console.error('/api/prediction error', err);
    return cached({ error: 'Internal server error' }, { status: 500 });
  }
}
