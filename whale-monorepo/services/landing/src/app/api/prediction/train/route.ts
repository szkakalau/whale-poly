/**
 * POST /api/prediction/train — admin-only manual retraining.
 *
 * Trains the logistic-regression probability model on the last N days of
 * backtest data and persists the coefficients to the prediction_models table
 * (versioned). Use a cron/GitHub Action to keep the model fresh, or rely on
 * the automatic train-on-demand in GET /api/prediction.
 *
 * Auth: x-admin-token header must equal ADMIN_TOKEN (404 on mismatch).
 */

import { NextResponse } from 'next/server';
import { trainModel, type TrainingRow } from '@/lib/prediction-model';
import { savePersistedModel } from '@/lib/prediction-model-store';
import { loadBacktestData } from '@/lib/backtesting/engine';

export async function POST(request: Request) {
  const adminToken = process.env.ADMIN_TOKEN || '';
  const headerToken = request.headers.get('x-admin-token') || '';
  if (!adminToken || headerToken !== adminToken) {
    return NextResponse.json({ detail: 'not_found' }, { status: 404 });
  }

  const url = new URL(request.url);
  const daysRaw = Number(url.searchParams.get('days') || 30);
  const days = Number.isFinite(daysRaw) ? Math.min(Math.max(daysRaw, 7), 90) : 30;

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  let rows;
  try {
    rows = await loadBacktestData({
      startDate,
      endDate,
      minWhaleScore: 0,
      minTradeSize: 0,
      planTier: 'elite',
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'backtest_data_load_failed', detail: String(err) },
      { status: 500 },
    );
  }

  const trainingRows: TrainingRow[] = rows.map((r) => ({
    whaleScore: Number(r.whale_score) || 0,
    side: (r.trade_side?.toUpperCase() === 'SELL' ? 'SELL' : 'BUY') as 'BUY' | 'SELL',
    pnl: Number(r.pnl) || 0,
  }));

  if (trainingRows.length < 20) {
    return NextResponse.json(
      {
        ok: false,
        error: 'insufficient_training_data',
        sampleSize: trainingRows.length,
        minimum: 20,
      },
      { status: 200 },
    );
  }

  const model = trainModel(trainingRows);
  let version: number | null = null;
  try {
    version = await savePersistedModel(model);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'persist_failed', detail: String(err) },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    version,
    model,
    windowDays: days,
    note: 'Model persisted. GET /api/prediction/model returns it publicly.',
  });
}
