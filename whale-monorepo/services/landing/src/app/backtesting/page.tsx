'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, TrendingUp, Shield, BarChart3 } from 'lucide-react';
import { BreadcrumbListScript } from '@/components/BreadcrumbListScript';

// ── Types ────────────────────────────────────────────────

type BacktestMetrics = {
  accuracy: number;
  precision: number;
  recall: number;
  winRate: number;
  avgRoi: number;
  medianRoi: number;
  totalPnl: number;
  sharpeRatio: number | null;
  maxDrawdown: number | null;
  profitFactor: number;
  avgHoldingDays: number;
};

type TierSummary = {
  tier: string;
  count: number;
  winRate: number;
  avgRoi: number;
  sharpeRatio: number | null;
};

type BacktestReport = {
  config: { startDate: string; endDate: string };
  period: { start: string; end: string };
  totalSignals: number;
  settledSignals: number;
  metrics: BacktestMetrics;
  byScoreTier: TierSummary[];
  baselineComparison: {
    signalWinRate: number;
    randomBaseline: number;
    signalVsRandom: number;
    signalAvgRoi: number;
    buyAndHoldRoi: number | null;
  };
  walkForward?: {
    folds: number;
    avgOosAccuracy: number | null;
    avgOosWinRate: number | null;
    avgOosSharpe: number | null;
  };
};

// ── Helpers ──────────────────────────────────────────────

function formatPct(v: number): string {
  const sign = v > 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(1)}%`;
}

function formatPnl(v: number): string {
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function tierColorClass(tier: string): string {
  if (tier.startsWith('90')) return 'text-accent';
  if (tier.startsWith('80')) return 'text-foreground';
  if (tier.startsWith('70')) return 'text-muted';
  return 'text-red-500';
}

const DEFAULT_METRICS: BacktestMetrics = {
  accuracy: 0, precision: 0, recall: 0, winRate: 0, avgRoi: 0, medianRoi: 0,
  totalPnl: 0, sharpeRatio: null, maxDrawdown: null, profitFactor: 0, avgHoldingDays: 0,
};

// ── Metric card ──────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-surface-hover px-4 py-3 text-center">
      <p className="text-[10px] text-subtle uppercase tracking-wider mb-1">{label}</p>
      <p className="font-mono text-lg font-bold stat-number text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-subtle mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────

export default function BacktestingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<BacktestReport | null>(null);
  const [plan, setPlan] = useState<string>('free');

  useEffect(() => {
    Promise.all([
      fetch('/api/me/plan').then(r => r.json().catch(() => ({}))),
      fetch('/api/backtest?start=2026-06-01&end=2026-08-07').then(r => r.json().catch(() => null)),
    ]).then(([planData, backtestData]) => {
      setPlan(planData.plan || 'free');
      if (backtestData?.report) {
        setReport(backtestData.report);
      }
    }).catch(() => {
      setError('Failed to load backtest data.');
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  const isElite = plan === 'ELITE';
  const m = report?.metrics ?? DEFAULT_METRICS;
  const bl = report?.baselineComparison;

  return (
    <div className="min-h-screen text-foreground selection:bg-accent selection:text-white pb-28">
      <main className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-28 sm:pt-36 pb-12">
        <BreadcrumbListScript items={[{ name: 'Backtesting', url: '/backtesting' }]} />

        <header className="mb-10">
          <p className="eyebrow mb-3">Backtesting</p>
          <h1 className="text-balance mb-4">Historical Performance</h1>
          <p className="text-sm text-subtle max-w-xl leading-relaxed">
            Validate whale signal predictions against settled market outcomes.
            Elite plan unlocks full walk-forward analysis and Sharpe ratio metrics.
          </p>
        </header>

        {loading ? (
          <div className="rounded-xl bg-surface card-shadow px-6 py-12 space-y-6 animate-pulse">
            <div className="grid grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 rounded-lg bg-foreground/5" />
              ))}
            </div>
            <div className="h-48 rounded-lg bg-foreground/5" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] px-5 py-4">
            <p className="text-sm text-red-500 font-semibold">{error}</p>
          </div>
        ) : !report ? (
          <div className="rounded-xl bg-surface card-shadow px-6 py-12 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 border border-accent/20 mb-5">
              <BarChart3 className="w-7 h-7 text-accent" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-2">No backtest data available</p>
            <p className="text-xs text-subtle max-w-md mx-auto">
              Backtest data accumulates as markets settle. Check back after more trades have resolved.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── Period info ── */}
            <div className="flex items-center gap-3 text-sm">
              <span className="text-subtle">Period:</span>
              <span className="font-mono text-xs font-semibold text-foreground">
                {report.period.start} → {report.period.end}
              </span>
              <span className="text-border">·</span>
              <span className="text-subtle">{report.totalSignals} total signals</span>
              <span className="text-border">·</span>
              <span className="text-subtle">{report.settledSignals} settled</span>
            </div>

            {/* ── Key metrics ── */}
            <section className="rounded-xl bg-surface card-shadow px-5 sm:px-8 py-6">
              <h2 className="text-sm font-semibold text-foreground mb-4">Key Metrics</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <MetricCard label="Accuracy" value={formatPct(m.accuracy)} />
                <MetricCard label="Win Rate" value={formatPct(m.winRate)} />
                <MetricCard label="Avg ROI" value={formatPct(m.avgRoi)} />
                <MetricCard
                  label="Sharpe"
                  value={m.sharpeRatio != null ? m.sharpeRatio.toFixed(2) : '—'}
                  sub={!isElite ? 'Elite only' : undefined}
                />
                <MetricCard
                  label="Max Drawdown"
                  value={m.maxDrawdown != null ? formatPct(-m.maxDrawdown) : '—'}
                  sub={!isElite ? 'Elite only' : undefined}
                />
              </div>

              {/* Profit factor + holding days row */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard label="Profit Factor" value={m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2)} />
                <MetricCard label="Total PnL" value={formatPnl(m.totalPnl)} />
                <MetricCard label="Median ROI" value={formatPct(m.medianRoi)} />
                <MetricCard label="Avg Holding" value={`${m.avgHoldingDays.toFixed(1)}d`} />
              </div>
            </section>

            {/* ── Tier breakdown ── */}
            {report.byScoreTier.length > 0 && (
              <section className="rounded-xl bg-surface card-shadow px-5 sm:px-8 py-6">
                <h2 className="text-sm font-semibold text-foreground mb-4">By Score Tier</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border-muted text-[11px] font-semibold uppercase tracking-wider text-subtle">
                      <tr>
                        <th className="pb-2.5 pr-4">Score Tier</th>
                        <th className="pb-2.5 pr-4 text-right">Trades</th>
                        <th className="pb-2.5 pr-4 text-right">Win Rate</th>
                        <th className="pb-2.5 pr-4 text-right">Avg ROI</th>
                        {isElite && <th className="pb-2.5 text-right">Sharpe</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-muted">
                      {report.byScoreTier.map(tier => (
                        <tr key={tier.tier} className="hover:bg-surface-hover transition-colors">
                          <td className={`py-2.5 pr-4 font-semibold ${tierColorClass(tier.tier)}`}>
                            Score {tier.tier}
                          </td>
                          <td className="py-2.5 pr-4 text-right font-mono text-xs stat-number text-foreground">
                            {tier.count}
                          </td>
                          <td className="py-2.5 pr-4 text-right font-mono text-xs stat-number text-foreground">
                            {formatPct(tier.winRate)}
                          </td>
                          <td className="py-2.5 pr-4 text-right font-mono text-xs stat-number text-foreground">
                            {formatPct(tier.avgRoi)}
                          </td>
                          {isElite && (
                            <td className="py-2.5 text-right font-mono text-xs stat-number text-foreground">
                              {tier.sharpeRatio != null ? tier.sharpeRatio.toFixed(2) : '—'}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── Baseline comparison ── */}
            {bl && (
              <section className="rounded-xl bg-surface card-shadow px-5 sm:px-8 py-6">
                <h2 className="text-sm font-semibold text-foreground mb-4">vs Baselines</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 rounded-lg bg-surface-hover px-4 py-3">
                    <TrendingUp className="w-5 h-5 text-accent shrink-0" />
                    <div>
                      <p className="text-[10px] text-subtle uppercase tracking-wider">Signal Edge</p>
                      <p className="font-mono text-sm font-bold stat-number text-accent">
                        {bl.signalVsRandom > 0 ? '+' : ''}{formatPct(bl.signalVsRandom)}
                      </p>
                      <p className="text-[10px] text-subtle mt-0.5">vs 50% random baseline</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-surface-hover px-4 py-3">
                    <Shield className="w-5 h-5 text-foreground shrink-0" />
                    <div>
                      <p className="text-[10px] text-subtle uppercase tracking-wider">Signal Win Rate</p>
                      <p className="font-mono text-sm font-bold stat-number text-foreground">
                        {formatPct(bl.signalWinRate)}
                      </p>
                    </div>
                  </div>
                  {bl.buyAndHoldRoi != null && (
                    <div className="flex items-center gap-3 rounded-lg bg-surface-hover px-4 py-3">
                      <BarChart3 className="w-5 h-5 text-muted shrink-0" />
                      <div>
                        <p className="text-[10px] text-subtle uppercase tracking-wider">Buy & Hold ROI</p>
                        <p className="font-mono text-sm font-bold stat-number text-foreground">
                          {formatPct(bl.buyAndHoldRoi)}
                        </p>
                        <p className="text-[10px] text-subtle mt-0.5">Signal: {formatPct(bl.signalAvgRoi)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── Walk-forward ── */}
            {report.walkForward && report.walkForward.folds > 0 && isElite && (
              <section className="rounded-xl bg-surface card-shadow px-5 sm:px-8 py-6">
                <h2 className="text-sm font-semibold text-foreground mb-4">
                  Walk-Forward Validation ({report.walkForward.folds} folds)
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard
                    label="OOS Accuracy"
                    value={report.walkForward.avgOosAccuracy != null ? formatPct(report.walkForward.avgOosAccuracy) : '—'}
                  />
                  <MetricCard
                    label="OOS Win Rate"
                    value={report.walkForward.avgOosWinRate != null ? formatPct(report.walkForward.avgOosWinRate) : '—'}
                  />
                  <MetricCard
                    label="OOS Sharpe"
                    value={report.walkForward.avgOosSharpe != null ? report.walkForward.avgOosSharpe.toFixed(2) : '—'}
                  />
                </div>
              </section>
            )}

            {/* Upgrade prompt for non-Elite */}
            {!isElite && (
              <div className="rounded-xl border border-dashed border-border bg-surface/50 px-5 py-4 text-center">
                <p className="text-xs text-subtle">
                  <span className="font-semibold text-muted">Elite Plan</span> unlocks full backtesting:
                  Sharpe ratio, max drawdown, walk-forward validation, and tier-level Sharpe.{' '}
                  <Link href="/pricing" className="text-accent hover:text-accent-hover font-semibold underline">
                    Upgrade →
                  </Link>
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
