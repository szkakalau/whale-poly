'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Link2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BreadcrumbListScript } from '@/components/BreadcrumbListScript';

// ── Types ────────────────────────────────────────────────

type MarketCorrelation = {
  marketA: { slug: string; title: string };
  marketB: { slug: string; title: string };
  pearsonR: number;
  overlapCount: number;
  commonCategory: string | null;
  significance: 'high' | 'medium' | 'low';
};

type CategoryFlowMap = {
  category: string;
  totalVolumeUsd: number;
  bullishCount: number;
  bearishCount: number;
  dominantDirection: 'bullish' | 'bearish' | 'neutral';
  marketCount: number;
};

// ── Helpers ──────────────────────────────────────────────

function formatVol(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v}`;
}

function directionEmoji(d: string): string {
  switch (d) {
    case 'bullish': return '🟢';
    case 'bearish': return '🔴';
    default: return '⚪';
  }
}

function directionLabel(d: string): string {
  switch (d) {
    case 'bullish': return '看涨';
    case 'bearish': return '看跌';
    default: return '中性';
  }
}

function rBarColor(r: number): string {
  const abs = Math.abs(r);
  if (abs >= 0.7) return 'var(--accent)';
  if (abs >= 0.5) return '#D97706';
  return 'var(--text-tertiary)';
}

function rLabel(r: number): string {
  if (r > 0.7) return 'Strong +';
  if (r > 0.5) return 'Moderate +';
  if (r > 0.3) return 'Weak +';
  if (r < -0.7) return 'Strong −';
  if (r < -0.5) return 'Moderate −';
  if (r < -0.3) return 'Weak −';
  return 'Uncorrelated';
}

// ── Sub: correlation row ─────────────────────────────────

function CorrelationRow({ c }: { c: MarketCorrelation }) {
  const barPct = Math.abs(c.pearsonR) * 100;
  const color = rBarColor(c.pearsonR);

  return (
    <div className="rounded-lg bg-surface-hover px-4 py-3 hover:bg-surface transition-colors">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate">{c.marketA.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Link2 className="w-3 h-3 text-subtle shrink-0" />
            <p className="text-xs text-subtle truncate">{c.marketB.title}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className="font-mono text-sm font-bold stat-number" style={{ color }}>
            r = {c.pearsonR >= 0 ? '+' : ''}{c.pearsonR.toFixed(2)}
          </span>
          <p className="text-[10px] text-subtle mt-0.5">{rLabel(c.pearsonR)}</p>
        </div>
      </div>

      {/* Correlation bar */}
      <div className="relative h-1.5 overflow-hidden rounded-full bg-foreground/8">
        <div
          className="absolute top-0 h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${barPct}%`,
            backgroundColor: color,
            left: c.pearsonR >= 0 ? '50%' : `${50 - barPct}%`,
          }}
        />
        {/* Center line */}
        <div className="absolute top-0 left-1/2 h-full w-px bg-foreground/15" />
      </div>

      <div className="flex items-center gap-3 mt-1.5">
        <span className="text-[10px] text-subtle">{c.overlapCount} snapshots</span>
        {c.significance === 'high' && (
          <span className="rounded-full bg-accent/10 border border-accent/20 px-2 py-0.5 text-[9px] font-semibold text-accent">
            HIGH
          </span>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────

export default function MarketCorrelationPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [correlations, setCorrelations] = useState<MarketCorrelation[]>([]);
  const [categoryFlows, setCategoryFlows] = useState<CategoryFlowMap[]>([]);
  const [plan, setPlan] = useState<string>('free');
  const [hours, setHours] = useState(48);

  useEffect(() => {
    Promise.all([
      fetch('/api/me/plan').then(r => r.json().catch(() => ({}))),
      fetch(`/api/market-correlation?hours=${hours}`).then(r => r.json().catch(() => null)),
    ]).then(([planData, corrData]) => {
      setPlan(planData.plan || 'free');
      if (corrData) {
        setCorrelations(corrData.correlations || []);
        setCategoryFlows(corrData.categoryFlows || []);
      }
      if (!planData.plan || planData.plan !== 'ELITE') {
        setError('Market correlation requires Elite plan.');
      }
    }).catch(() => {
      setError('Failed to load correlation data.');
    }).finally(() => {
      setLoading(false);
    });
  }, [hours]);

  const isElite = plan === 'ELITE';

  return (
    <div className="min-h-screen text-foreground selection:bg-accent selection:text-white pb-28">
      <main className="relative mx-auto max-w-4xl px-4 sm:px-6 pt-28 sm:pt-36 pb-12">
        <BreadcrumbListScript items={[{ name: 'Market Correlation', url: '/market-correlation' }]} />

        <header className="mb-10">
          <p className="eyebrow mb-3">Market Correlation</p>
          <h1 className="text-balance mb-4">Cross-Market Analysis</h1>
          <p className="text-sm text-subtle max-w-xl leading-relaxed">
            Discover how Polymarket markets move together. Pearson correlation on VW divergence
            time series reveals hidden connections between seemingly unrelated events.
          </p>
        </header>

        {/* Time window selector */}
        {isElite && (
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs text-subtle">Lookback:</span>
            {[24, 48, 72, 168].map(h => (
              <button
                key={h}
                type="button"
                onClick={() => setHours(h)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  hours === h
                    ? 'bg-accent text-white'
                    : 'bg-surface-hover text-subtle hover:text-foreground'
                }`}
              >
                {h >= 168 ? `${h / 24}d` : `${h}h`}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-foreground/5" />
              ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-foreground/5" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/50 px-5 py-8 text-center">
            <p className="text-sm text-subtle mb-3">{error}</p>
            {!isElite && (
              <Link
                href="/pricing"
                className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
              >
                Upgrade to Elite →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* ── Category Flows ── */}
            {categoryFlows.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-4">Category Fund Flows</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {categoryFlows.map(cat => (
                    <div
                      key={cat.category}
                      className="rounded-xl bg-surface card-shadow px-4 py-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{directionEmoji(cat.dominantDirection)}</span>
                        <span className="text-xs font-semibold text-foreground capitalize">{cat.category}</span>
                      </div>
                      <p className="font-mono text-sm font-bold stat-number text-foreground">
                        {formatVol(cat.totalVolumeUsd)}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-subtle">
                        <span>{cat.marketCount} markets</span>
                        <span>{cat.bullishCount}🟢 {cat.bearishCount}🔴</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Correlations List ── */}
            <section>
              <h2 className="text-sm font-semibold text-foreground mb-4">
                Correlated Market Pairs
                {correlations.length > 0 && (
                  <span className="text-xs text-subtle font-normal ml-2">
                    (showing {correlations.length})
                  </span>
                )}
              </h2>

              {correlations.length === 0 ? (
                <div className="rounded-xl bg-surface card-shadow px-6 py-10 text-center">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 border border-accent/20 mb-5">
                    <Link2 className="w-7 h-7 text-accent" />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-2">No strong correlations found</p>
                  <p className="text-xs text-subtle max-w-md mx-auto">
                    Try extending the lookback window or check back when more VW snapshot data has accumulated.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {correlations.map((c, i) => (
                    <CorrelationRow key={`${c.marketA.slug}-${c.marketB.slug}-${i}`} c={c} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
