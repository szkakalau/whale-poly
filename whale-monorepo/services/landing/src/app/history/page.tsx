import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  loadPublicHistorySignals,
  summarizeHistoryRows,
  MAX_GAMMA_CONDITION_LOOKUPS,
} from '@/lib/history-signals';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Historical Signals — SightWhale',
  description:
    'Verified historical whale alerts through end of yesterday UTC. Today’s live feed is available to paid members.',
  alternates: {
    canonical: '/history',
  },
};

function formatPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(1)}%`;
}

function formatPrice(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(3);
}

function formatUsdCompact(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${value < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${value < 0 ? '-' : ''}$${(abs / 1_000).toFixed(1)}K`;
  return `${value < 0 ? '-' : ''}$${abs.toFixed(0)}`;
}

/** Signed USD for realized PnL (compact). */
function formatSignedPnlUsd(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const abs = Math.abs(value);
  let body: string;
  if (abs >= 1_000_000) body = `$${(abs / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) body = `$${(abs / 1_000).toFixed(1)}K`;
  else body = `$${abs.toFixed(0)}`;
  return `${sign}${body}`;
}

function yesterdayUtcIsoDate(): string {
  const now = new Date();
  const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return y.toISOString().slice(0, 10);
}

export default async function HistoryPage() {
  const rows = await loadPublicHistorySignals();
  const { total, winRate, avgRoi } = summarizeHistoryRows(rows);
  const cutoffLabel = yesterdayUtcIsoDate();

  return (
    <div className="min-h-screen text-foreground selection:bg-accent-primary/25 overflow-hidden pb-28">
      <div className="fixed inset-0 z-[-1] bg-background" />

      <main className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-14 sm:pt-20 pb-12">
        <header className="mb-10 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground mb-4">
            Historical signal performance
          </h1>
          <p className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100">
            Data through {cutoffLabel} 23:59 UTC · Today&apos;s live feed is for paid members only
          </p>
          <p className="mt-4 text-sm text-muted max-w-3xl">
            Every alert stays on the ledger—we don&apos;t delete losing trades.
          </p>
        </header>

        <div className="overflow-x-auto rounded-2xl border border-border bg-surface/80">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-border bg-surface/90 text-[11px] font-black uppercase tracking-wider text-subtle">
              <tr>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3">Market</th>
                <th className="px-4 py-3 text-right">Whale score</th>
                <th className="px-4 py-3 text-right normal-case">Entry (price)</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Side</th>
                <th className="px-4 py-3 text-right">Size</th>
                <th className="px-4 py-3 font-mono">Wallet</th>
                <th className="px-4 py-3 text-right normal-case">Settlement (price)</th>
                <th className="px-4 py-3 text-right normal-case">ROI (realized)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-muted">
                    No historical rows yet, or alerts haven&apos;t synced to this database.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const roi = row.roiPct;
                  const roiClass =
                    roi == null
                      ? 'text-muted'
                      : roi > 0
                        ? 'text-emerald-400 font-semibold'
                        : roi < 0
                          ? 'text-red-400 font-semibold'
                          : 'text-muted';
                  return (
                    <tr key={row.id} className="hover:bg-surface-hover/60">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-subtle">
                        {new Date(row.publishedAt).toISOString().replace('T', ' ').slice(0, 19)} UTC
                      </td>
                      <td className="max-w-[280px] px-4 py-3 text-foreground">{row.marketTitle}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.whaleScore != null ? row.whaleScore.toFixed(0) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatPrice(row.publishPrice)}</td>
                      <td className="max-w-[140px] px-4 py-3 text-foreground">
                        {row.outcomeLabel ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{row.sideLabel ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatUsdCompact(row.sizeUsd)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-subtle">{row.walletMasked}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">{formatPrice(row.endPrice)}</td>
                      <td className={`px-4 py-3 text-right align-top tabular-nums ${roiClass}`}>
                        <div>{formatPct(roi)}</div>
                        {row.realizedPnlUsd != null && Number.isFinite(row.realizedPnlUsd) && (
                          <div className="mt-0.5 text-[11px] font-medium text-muted">{formatSignedPnlUsd(row.realizedPnlUsd)}</div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <section className="mt-8 rounded-2xl border border-border-muted bg-surface/50 p-6 layout-diagonal-band">
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-subtle mb-4">Summary</h2>
          <dl className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-12 sm:gap-y-6">
            <div className="sm:translate-y-2">
              <dt className="text-[11px] text-muted">Total signals</dt>
              <dd className="font-display text-3xl font-black tabular-nums">{total}</dd>
            </div>
            <div className="sm:-translate-y-1 sm:ml-[6%]">
              <dt className="text-[11px] text-muted">Win rate</dt>
              <dd className="font-display text-3xl font-black tabular-nums text-accent-primary">
                {winRate != null ? `${(winRate * 100).toFixed(1)}%` : '—'}
              </dd>
            </div>
            <div className="sm:translate-y-3 sm:ml-auto">
              <dt className="text-[11px] text-muted">Average ROI</dt>
              <dd className="font-display text-3xl font-black tabular-nums text-accent-sharp">
                {avgRoi != null ? formatPct(avgRoi) : '—'}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-[11px] text-subtle leading-relaxed">
            <strong className="text-foreground/90">ROI notes:</strong> we prefer realized PnL from{' '}
            <code className="text-[10px]">whale_trade_history</code> when present and meaningful. When Gamma shows a clear
            resolved winner, ROI uses that leg price; if the market is still trading, ROI uses the same leg price as the
            settlement column (mark-to-market vs entry): BUY (S − entry) / entry, SELL (entry − S) / (1 − entry). Rows with no
            entry price, side, or Gamma match show &quot;—&quot;. Up to {MAX_GAMMA_CONDITION_LOOKUPS} distinct Gamma queries per request.
          </p>
        </section>
      </main>


      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <p className="hidden text-sm text-muted sm:block">Unlock today&apos;s live stream and optional Telegram</p>
          <Link
            href="/pricing"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-accent-primary px-6 py-3 text-center text-sm font-black text-white transition-colors hover:bg-accent-hover sm:ml-auto"
          >
            Get real-time signals
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
