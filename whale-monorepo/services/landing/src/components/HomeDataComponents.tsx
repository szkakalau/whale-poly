/**
 * Async data-fetching sub-components for the homepage.
 * Extracted from page.tsx — one component per data concern.
 */

import { Suspense } from 'react';
import { unstable_cache } from 'next/cache';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { loadLiveSignals } from '@/lib/live-signals';
import { getCurrentUser } from '@/lib/auth';
import { filterLiveSignalsForUser } from '@/lib/live-signals-access';
import LiveSignalsFeedLazy from '@/components/LiveSignalsFeedLazy';

const API_BASE = process.env.TRADE_INGEST_API_URL || 'https://trade-ingest-api.onrender.com';

const loadHomeStats = unstable_cache(
  async () => {
    const res = await fetch(`${API_BASE}/stats/home`);
    if (!res.ok) throw new Error(`Stats API ${res.status}`);
    return res.json() as Promise<{
      historyTotal: number;
      scoreTiers: { tier: string; labelName: string; count: number; resolvedCount: number; winRate: number | null; avgRoi: number | null }[];
      starWhale: { walletMasked: string; totalPnl: number; roi: number; winRate: number; whaleScore: number; totalTrades: number } | null;
    }>;
  },
  ['home-stats-v2'],
  { revalidate: 120 },
);

function formatPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(1)}%`;
}

function formatPnlCompact(v: number): string {
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/* ── StatsBar ── */

export function StatsFallback() {
  return <div className="h-6 w-80 rounded-md bg-surface-hover animate-pulse" aria-hidden />;
}

export async function StatsBar() {
  try {
    const stats = await loadHomeStats();
    const total = stats.historyTotal;
    const allTiers = stats.scoreTiers;
    const totalResolved = allTiers.reduce((s, t) => s + (t.resolvedCount ?? 0), 0);
    const avgRoi = totalResolved > 0
      ? allTiers.reduce((s, t) => s + (t.avgRoi ?? 0) * (t.resolvedCount ?? 0), 0) / totalResolved
      : null;
    const totalWins = allTiers.reduce((s, t) => s + (t.winRate ?? 0) * (t.resolvedCount ?? 0), 0);
    const winRate = totalResolved > 0 ? totalWins / totalResolved : null;
    const wr = winRate != null ? `${(winRate * 100).toFixed(1)}%` : '—';

    return (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted">
        <span>
          <span className="font-semibold tabular-nums text-foreground stat-number">{total}</span>{' '}
          audited signals
        </span>
        <span className="text-border hidden sm:inline">·</span>
        <span>
          <span className="font-semibold tabular-nums text-muted stat-number">{totalResolved}</span>{' '}
          resolved
        </span>
        <span className="text-border hidden sm:inline">·</span>
        <span>
          <span className="font-semibold tabular-nums text-accent stat-number">{formatPct(avgRoi)}</span>{' '}
          cumulative ROI
        </span>
        <span className="text-border hidden sm:inline">·</span>
        <span>
          <span className="font-semibold text-accent">Publicly verified</span>
        </span>
        <span className="text-border hidden sm:inline">·</span>
        <span>
          <span className="font-semibold tabular-nums text-foreground stat-number">{wr}</span>{' '}
          win rate
        </span>
      </div>
    );
  } catch {
    return <StatsFallback />;
  }
}

export function StatsSection() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 mb-24 sm:mb-32">
      <div className="rounded-lg bg-surface card-shadow px-6 py-5 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">Live Track Record</p>
            <Suspense fallback={<StatsFallback />}>
              <StatsBar />
            </Suspense>
          </div>
          <Link
            href="/history"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-hover transition-colors shrink-0"
          >
            Browse full history
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── ScorePerformanceSection ── */

export async function ScorePerformanceSection() {
  try {
    const stats = await loadHomeStats();
    const visible = stats.scoreTiers.filter((t) => t.count > 0);
    if (visible.length === 0) return null;

    return (
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-24 sm:mb-32">
        <p className="eyebrow mb-3">Proof in the numbers</p>
        <h2 className="text-balance mb-3">Higher score = better results.</h2>
        <p className="text-sm text-muted max-w-xl mb-8 leading-relaxed">
          We grouped every audited signal by its Whale Score. The pattern is clear.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((t, i) => {
            const isTop = i === 0;
            return (
              <div key={t.tier} className={`rounded-lg px-5 py-5 card-shadow ${isTop ? 'bg-accent/[0.04] shadow-[0_1px_3px_rgba(13,92,63,0.08),_0_4px_14px_rgba(13,92,63,0.08),_0_0_0_1px_rgba(13,92,63,0.12)]' : 'bg-surface'}`}>
                <p className={`text-xs font-semibold tracking-wide uppercase mb-3 ${isTop ? 'text-accent' : 'text-muted'}`}>{t.labelName}</p>
                <p className="text-2xl font-bold tabular-nums stat-number text-foreground mb-1">Score {t.tier}</p>
                <div className="space-y-1 mt-3">
                  <p className="text-sm text-muted"><span className="font-semibold text-accent stat-number">{t.avgRoi != null ? formatPct(t.avgRoi) : '—'}</span> avg ROI</p>
                  <p className="text-sm text-muted"><span className="font-semibold text-foreground stat-number">{t.winRate != null ? `${(t.winRate * 100).toFixed(1)}%` : '—'}</span> win rate</p>
                  <p className="text-xs text-subtle">{t.count} signal{t.count !== 1 ? 's' : ''}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  } catch { return null; }
}

/* ── StarWhaleSection ── */

export async function StarWhaleSection() {
  try {
    const stats = await loadHomeStats();
    const whale = stats.starWhale;
    if (!whale) return null;

    return (
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-24 sm:mb-32">
        <p className="eyebrow mb-3">Top whale</p>
        <h2 className="text-balance mb-8">Meet the #1 performer.</h2>
        <div className="rounded-lg bg-accent/[0.03] card-shadow px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="min-w-0">
              <p className="text-xs text-subtle mb-1">Wallet</p>
              <p className="text-base font-mono font-semibold text-foreground tabular-nums">{whale.walletMasked}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-muted">{whale.totalTrades} lifetime trades</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-6 sm:gap-8 shrink-0">
              <div className="text-center sm:text-right"><p className="text-xs text-subtle mb-0.5">Historical ROI</p><p className="text-xl font-bold tabular-nums stat-number text-accent">{formatPct(whale.roi)}</p></div>
              <div className="text-center sm:text-right"><p className="text-xs text-subtle mb-0.5">Total Profit</p><p className="text-xl font-bold tabular-nums stat-number text-accent">{formatPnlCompact(whale.totalPnl)}</p></div>
            </div>
          </div>
        </div>
      </section>
    );
  } catch { return null; }
}

/* ── HeroStat ── */

export function HeroStatFallback() {
  return (
    <span className="text-accent font-semibold italic">
      a provable track record
    </span>
  );
}

export async function HeroStat() {
  try {
    const stats = await loadHomeStats();
    const tiers = stats.scoreTiers;
    const totalSignals = tiers.reduce((s, t) => s + t.count, 0);
    const totalWins = tiers.reduce((s, t) => s + (t.winRate ?? 0) * t.count, 0);
    const winRate = totalSignals > 0 ? totalWins / totalSignals : null;
    const wr = winRate != null && winRate > 0 ? `${(winRate * 100).toFixed(1)}%` : null;

    if (!wr) {
      return (
        <span className="text-accent font-semibold italic">
          a provable track record
        </span>
      );
    }

    return (
      <span className="text-accent font-semibold not-italic">
        {wr} of the time
      </span>
    );
  } catch {
    return (
      <span className="text-accent font-semibold italic">
        a provable track record
      </span>
    );
  }
}

/* ── LivePreview ── */

export async function LivePreview() {
  const [liveSignals, user] = await Promise.all([loadLiveSignals(), getCurrentUser()]);
  const signals = filterLiveSignalsForUser(liveSignals, user).slice(0, 3);
  return <LiveSignalsFeedLazy signals={signals} homePreview />;
}
