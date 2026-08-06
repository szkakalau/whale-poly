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
const MODEL_TTL_MS = 60 * 60 * 1000; // 60 minutes

async function getModel(): Promise<ProbabilityModel | null> {
  const now = Date.now();
  if (_cachedModel && now - _modelTrainedAt < MODEL_TTL_MS) {
    return _cachedModel;
  }

  try {
    // Train on last 30 days of backtest data
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
      _cachedModel = trainModel(trainingRows);
    } else {
      _cachedModel = null; // insufficient data — use tier fallback
    }
  } catch (err) {
    console.error('getModel: training failed', err);
    _cachedModel = null;
  }

  _modelTrainedAt = now;
  return _cachedModel;
}

/** Attach calibrated probability to a fusion result. */
function attachProbability(
  prediction: FusionResult,
  model: ProbabilityModel | null,
  plan: string,
): FusionResult {
  if (model && (plan === 'PRO' || plan === 'ELITE')) {
    prediction.probability = predictProbability(
      prediction.compositeScore,
      prediction.direction,
      model,
    );
  } else {
    // Free tier or model not ready: use tier lookup
    prediction.probability = tierProbability(
      prediction.compositeScore,
      prediction.direction,
    );
  }
  return prediction;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const marketSlug = searchParams.get('market');

  if (!marketSlug) {
    return cached({ error: 'market parameter is required' }, { status: 400 });
  }

  try {
    // Plan detection: cookie auth first, then fallback to ?tier= query param
    // (used by Telegram bot which calls this API server-to-server).
    const user = await getCurrentUser();
    const tierParam = searchParams.get('tier')?.toUpperCase() as 'FREE' | 'PRO' | 'ELITE' | undefined;
    const plan = user
      ? effectivePlan(user)
      : (tierParam === 'PRO' || tierParam === 'ELITE' ? tierParam : 'free' as const);
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
            const walletAddrs = analysis.topWallets.map(w => w.addressShort);
            if (walletAddrs.length === 0) return null;

            const rows = await prisma.$queryRaw<{ whale_score: number }[]>(
              Prisma.sql`
                SELECT whale_score::int AS whale_score
                FROM whale_stats
                WHERE whale_score IS NOT NULL
                ORDER BY whale_score DESC
                LIMIT 1
              `
            );
            return rows.length > 0 ? rows[0].whale_score : null;
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
      attachProbability(prediction, model, plan);

      return cached({ prediction, tier: plan });
    }

    // Free tier: basic fusion
    const prediction = fuseBasicSignals(marketSlug, analysis);
    attachProbability(prediction, null, 'free');
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
