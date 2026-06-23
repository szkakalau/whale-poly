import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  loadPublicHistorySignals,
  summarizeHistoryRows,
  MAX_GAMMA_CONDITION_LOOKUPS,
} from '@/lib/history-signals';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: { absolute: 'Historical Signals — SightWhale.com' },
  description:
    'Verified historical whale alerts through end of yesterday UTC. Today\'s live feed is available to paid members.',
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
    <div className="min-h-screen text-foreground selection:bg-accent selection:text-white pb-28">
      <main className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-28 sm:pt-36 pb-12">
        {/* ── Hero + summary stats (above the fold) ── */}
        <header className="mb-8">
          <h1 className="text-balance mb-6">
            Historical signal performance
          </h1>

          <div className="rounded-xl border border-border bg-surface px-6 py-5 sm:px-8">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted mb-3">
              <span>
                <span className="font-semibold tabular-nums text-foreground stat-number">{total}</span>{' '}
                resolved signals
              </span>
              <span className="text-border hidden sm:inline">·</span>
              <span>
                <span className="font-semibold tabular-nums text-accent stat-number">
                  {winRate != null ? `${(winRate * 100).toFixed(1)}%` : '—'}
                </span>{' '}
                win rate
              </span>
              <span className="text-border hidden sm:inline">·</span>
              <span>
                <span className="font-semibold tabular-nums text-accent stat-number">
                  {avgRoi != null ? formatPct(avgRoi) : '—'}
                </span>{' '}
                avg ROI
              </span>
            </div>
            <p className="text-xs text-subtle">
              Data through {cutoffLabel} 23:59 UTC · Today&apos;s live feed is for paid members only
            </p>
          </div>
        </header>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border bg-surface-hover text-[11px] font-semibold uppercase tracking-wider text-subtle">
              <tr>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-4 py-2.5">Market</th>
                <th className="px-2.5 py-2.5 text-right">Score</th>
                <th className="px-2.5 py-2.5 text-right normal-case">Entry</th>
                <th className="px-3 py-2.5">Outcome</th>
                <th className="px-2.5 py-2.5">Side</th>
                <th className="px-2.5 py-2.5 text-right">Size</th>
                <th className="px-2 py-2.5 font-mono">Wallet</th>
                <th className="px-2.5 py-2.5 text-right normal-case">Settl.</th>
                <th className="px-2.5 py-2.5 text-right normal-case">PnL</th>
                <th className="px-2.5 py-2.5 text-right normal-case">ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-16 text-center text-muted">
                    No historical rows yet, or alerts haven&apos;t synced to this database.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const roi = row.roiPct;
                  const roiColorClass =
                    roi == null
                      ? 'text-muted'
                      : roi > 0
                        ? 'text-accent font-semibold'
                        : roi < 0
                          ? 'text-red-500 font-semibold'
                          : 'text-muted';
                  const pnl = row.computedPnlUsd;
                  const pnlColorClass =
                    pnl == null
                      ? 'text-muted'
                      : pnl > 0
                        ? 'text-accent font-semibold'
                        : pnl < 0
                          ? 'text-red-500 font-semibold'
                          : 'text-muted';
                  const pubDate = new Date(row.publishedAt);
                  const dateStr = pubDate.toISOString().slice(0, 10);
                  const timeStr = pubDate.toISOString().slice(11, 16);
                  return (
                    <tr key={row.id} className="hover:bg-surface-hover">
                      <td className="px-3 py-2.5 font-mono text-[11px] leading-tight text-subtle">
                        <div>{dateStr}</div>
                        <div className="text-[10px] text-muted">{timeStr} UTC</div>
                      </td>
                      <td className="max-w-[260px] px-4 py-2.5 text-foreground">{row.marketTitle}</td>
                      <td className="px-2.5 py-2.5 text-right tabular-nums text-xs">
                        {row.whaleScore != null ? row.whaleScore.toFixed(0) : '—'}
                      </td>
                      <td className="px-2.5 py-2.5 text-right tabular-nums text-xs">{formatPrice(row.publishPrice)}</td>
                      <td className="max-w-[120px] px-3 py-2.5 text-xs text-foreground">
                        {row.outcomeLabel ?? '—'}
                      </td>
                      <td className="px-2.5 py-2.5 font-mono text-[11px]">{row.sideLabel ?? '—'}</td>
                      <td className="px-2.5 py-2.5 text-right tabular-nums text-xs">{formatUsdCompact(row.sizeUsd)}</td>
                      <td className="px-2 py-2.5 font-mono text-[11px] text-subtle">{row.walletMasked}</td>
                      <td className="px-2.5 py-2.5 text-right tabular-nums text-xs text-muted">{formatPrice(row.endPrice)}</td>
                      <td className={`px-2.5 py-2.5 text-right tabular-nums text-xs ${pnlColorClass}`}>
                        {pnl != null ? formatSignedPnlUsd(pnl) : '—'}
                      </td>
                      <td className={`px-2.5 py-2.5 text-right tabular-nums text-xs ${roiColorClass}`}>
                        {formatPct(roi)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Methodology — collapsible, reference only */}
        <details className="mt-8 group">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.2em] text-subtle hover:text-muted transition-colors select-none">
            How ROI is calculated
          </summary>
          <p className="mt-3 text-xs text-subtle leading-relaxed max-w-3xl">
            We prefer realized PnL from{' '}
            <code className="text-[11px]">whale_trade_history</code> when present and meaningful. When Gamma shows a clear
            resolved winner, ROI uses that leg price; if the market is still trading, ROI uses the same leg price as the
            settlement column (mark-to-market vs entry): BUY (S − entry) / entry, SELL (entry − S) / (1 − entry). Rows with no
            entry price, side, or Gamma match show &quot;—&quot;. Up to {MAX_GAMMA_CONDITION_LOOKUPS} distinct Gamma queries per request.
          </p>
        </details>
      </main>

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <p className="hidden text-sm text-muted sm:block">Unlock today&apos;s live stream and optional Telegram</p>
          <Link
            href="/pricing"
            className="btn-primary inline-flex w-full sm:w-auto items-center justify-center gap-2 px-6 py-3 text-sm font-semibold"
          >
            Get real-time signals
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
