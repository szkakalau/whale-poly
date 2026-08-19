import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Trophy } from 'lucide-react';
import {
  getWhalesLeaderboard,
  shortWallet,
  formatUsd,
  formatSignedUsd,
  formatPct,
} from '@/lib/whale-profile-api';
import { BreadcrumbListScript, safeJsonLd } from '@/components/BreadcrumbListScript';

export const revalidate = 300; // ISR: refresh leaderboard every 5 minutes

export const metadata: Metadata = {
  title: { absolute: 'Top Polymarket Whales — SightWhale' },
  description:
    'The top Polymarket whales tracked by SightWhale, publicly audited. Browse verified whale scores, 30-day volume, win rates, and PnL — free.',
  alternates: { canonical: '/whales' },
  openGraph: {
    title: 'Top Polymarket Whales — SightWhale',
    description:
      'The top Polymarket whales tracked by SightWhale, publicly audited. Browse verified whale scores, 30-day volume, win rates, and PnL — free.',
    type: 'website',
    url: 'https://www.sightwhale.com/whales',
    siteName: 'SightWhale.com',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Top Polymarket Whales — SightWhale',
    description:
      'The top Polymarket whales tracked by SightWhale, publicly audited. Browse verified whale scores, 30-day volume, win rates, and PnL — free.',
    images: ['/opengraph-image'],
  },
  robots: { index: true, follow: true },
};

export default async function WhalesLeaderboardPage() {
  const entries = await getWhalesLeaderboard(50);

  const jsonLd = safeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Top Polymarket Whales',
    description: 'The top Polymarket whales tracked by SightWhale, publicly audited.',
    url: 'https://www.sightwhale.com/whales',
    numberOfItems: entries ? entries.length : 0,
    itemListElement: (entries || []).map((w, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: w.display_name || shortWallet(w.wallet),
      url: `https://www.sightwhale.com/whales/${w.wallet}`,
    })),
  });

  return (
    <div className="min-h-screen text-foreground selection:bg-accent selection:text-white pb-28">
      <main className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-28 sm:pt-36 pb-12">
        <BreadcrumbListScript items={[{ name: 'Whales', url: '/whales' }]} />

        {/* ── Header ── */}
        <header className="mb-8">
          <p className="eyebrow mb-3">Public whale leaderboard</p>
          <h1 className="text-balance mb-3 flex items-center gap-2">
            <Trophy size={24} className="text-accent shrink-0" aria-hidden />
            Top Polymarket whales
          </h1>
          <p className="text-sm text-muted max-w-2xl leading-relaxed">
            The top Polymarket whales tracked by SightWhale — publicly audited. Whale Score is our
            composite 0–100 signal-strength metric. Click any wallet for its full public profile.
          </p>
        </header>

        {/* ── CTA row ── */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <Link href="/history" className="btn-secondary inline-flex items-center gap-2 text-sm">
            Browse verified history
          </Link>
          <Link href="/pricing" className="btn-primary inline-flex items-center gap-2 text-sm">
            Get real-time alerts
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>

        {/* ── Table / empty states ── */}
        {entries === null ? (
          <div className="rounded-xl bg-surface card-shadow px-6 py-16 text-center">
            <p className="text-2xl font-bold font-display mb-3">Data temporarily unavailable</p>
            <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
              We could not load the whale leaderboard right now. Please refresh in a moment.
            </p>
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-xl bg-surface card-shadow px-6 py-16 text-center">
            <p className="text-sm text-muted">No whales on the leaderboard yet — check back soon.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-surface-hover text-[11px] font-semibold uppercase tracking-wider text-subtle">
                <tr>
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">Whale</th>
                  <th className="px-3 py-2.5 text-right">Score</th>
                  <th className="px-3 py-2.5 text-right normal-case">Win rate (30d)</th>
                  <th className="px-3 py-2.5 text-right normal-case">Volume (30d)</th>
                  <th className="px-3 py-2.5 text-right normal-case">PnL (30d)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted">
                {entries.map((w, i) => (
                  <tr key={w.wallet} className="hover:bg-surface-hover">
                    <td className="px-4 py-3 text-muted tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/whales/${w.wallet}`}
                        className="font-semibold text-foreground hover:text-accent transition-colors"
                      >
                        {w.display_name || shortWallet(w.wallet)}
                      </Link>
                      <div className="font-mono text-[11px] text-subtle">{shortWallet(w.wallet)}</div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <span className="font-semibold stat-number text-accent">{Math.round(w.whale_score || 0)}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-xs">{formatPct(w.win_rate_30d)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-xs">{formatUsd(w.volume_30d)}</td>
                    <td className={`px-3 py-3 text-right tabular-nums text-xs ${w.pnl_30d > 0 ? 'text-accent' : w.pnl_30d < 0 ? 'text-red-500' : 'text-muted'}`}>
                      {formatSignedUsd(w.pnl_30d)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Footnote ── */}
        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-[11px] text-subtle">
            Data refreshes every 5 minutes · Whale Score is a composite of performance, consistency,
            timing, risk, and impact ·{' '}
            <Link href="/methodology" className="text-accent hover:text-accent-hover transition-colors underline decoration-accent/20 underline-offset-2">
              Methodology
            </Link>
          </p>
        </div>
      </main>

      {/* ── Structured data ── */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
    </div>
  );
}
