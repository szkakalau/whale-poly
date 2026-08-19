import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import {
  getWhaleProfile,
  shortWallet,
  formatNumber,
  formatUsd,
  formatSignedUsd,
  formatPct,
  formatDecimal,
  type WhaleProfile,
  type WhaleScoreBreakdown,
} from '@/lib/whale-profile-api';
import { BreadcrumbListScript, safeJsonLd } from '@/components/BreadcrumbListScript';

export const revalidate = 300; // ISR: refresh whale profiles every 5 minutes

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;

type Props = { params: Promise<{ wallet: string }> };

const FACTOR_LABELS: { key: keyof WhaleScoreBreakdown; label: string }[] = [
  { key: 'performance', label: 'Performance' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'timing', label: 'Timing' },
  { key: 'risk', label: 'Risk' },
  { key: 'impact', label: 'Impact' },
];

function pnlColorClass(v: number): string {
  if (!Number.isFinite(v) || v === 0) return 'text-muted';
  return v > 0 ? 'text-accent' : 'text-red-500';
}

function formatTradeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { wallet } = await params;
  if (!WALLET_RE.test(wallet)) {
    return { title: 'Whale Not Found', robots: { index: false } };
  }

  const profile = await getWhaleProfile(wallet);
  if (!profile || (profile.total_trades === 0 && profile.whale_score === 0)) {
    return { title: 'Whale Not Found', robots: { index: false } };
  }

  const name = profile.display_name || shortWallet(profile.wallet);
  const score = Math.round(profile.whale_score || 0);
  const description = `${name} has a Whale Score of ${score} with a ${formatPct(
    profile.win_rate,
  )} win rate, ${formatNumber(profile.total_trades)} lifetime trades and ${formatSignedUsd(
    profile.realized_pnl,
  )} realized PnL on Polymarket.`;

  return {
    title: { absolute: `${name} Whale Profile — SightWhale` },
    description,
    alternates: { canonical: `/whales/${profile.wallet}` },
    openGraph: {
      title: `${name} Whale Profile — SightWhale`,
      description,
      type: 'website',
      url: `https://www.sightwhale.com/whales/${profile.wallet}`,
      siteName: 'SightWhale.com',
      images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} Whale Profile — SightWhale`,
      description,
      images: ['/opengraph-image'],
    },
    robots: { index: true, follow: true },
  };
}

/** Graceful state for transient upstream failure / rate limiting. */
function UnavailableState({ wallet, rateLimited }: { wallet: string; rateLimited?: boolean }) {
  return (
    <div className="min-h-screen text-foreground selection:bg-accent selection:text-white pb-28">
      <main className="relative mx-auto max-w-3xl px-4 sm:px-6 pt-28 sm:pt-36 pb-12">
        <BreadcrumbListScript items={[{ name: 'Whales', url: '/whales' }]} />
        <Link
          href="/whales"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden />
          Back to whale leaderboard
        </Link>

        <div className="rounded-xl bg-surface card-shadow px-6 py-12 sm:px-10 text-center">
          <p className="text-2xl font-bold font-display mb-3">Data temporarily unavailable</p>
          <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
            {rateLimited
              ? 'This profile was just refreshed and is momentarily rate-limited. Check back in a few seconds.'
              : 'We could not load this whale profile right now. Please try again shortly.'}
          </p>
          <p className="mt-4 font-mono text-xs text-subtle break-all">{wallet}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/whales" className="btn-secondary inline-flex items-center gap-2 text-sm">
              <ArrowLeft className="w-4 h-4" aria-hidden />
              Browse leaderboard
            </Link>
            <Link href="/history" className="btn-primary inline-flex items-center gap-2 text-sm">
              View historical signals
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default async function WhaleProfilePage({ params }: Props) {
  const { wallet } = await params;

  // Invalid wallet format → hard 404 (never render a page for a malformed address).
  if (!WALLET_RE.test(wallet)) notFound();

  const profile = await getWhaleProfile(wallet);

  // Transient rate limit → graceful state (valid whale, just throttled).
  if (profile && profile.detail === 'rate_limited') {
    return <UnavailableState wallet={wallet} rateLimited />;
  }

  // Upstream unreachable / fetch failed → graceful state, never a crash.
  if (!profile) {
    return <UnavailableState wallet={wallet} />;
  }

  // Empty profile (unknown wallet) → 404 to avoid blank pages.
  if (profile.total_trades === 0 && profile.whale_score === 0) {
    notFound();
  }

  return <ProfileContent profile={profile} />;
}

function ProfileContent({ profile }: { profile: WhaleProfile }) {
  const name = profile.display_name || shortWallet(profile.wallet);
  const breakdown = profile.whale_score_breakdown;
  const winRateLabel = formatPct(profile.win_rate);

  const jsonLd = safeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${name} Whale Profile`,
    description: `${name} is a Polymarket whale tracked by SightWhale.`,
    url: `https://www.sightwhale.com/whales/${profile.wallet}`,
    publisher: {
      '@type': 'Organization',
      name: 'SightWhale',
      url: 'https://www.sightwhale.com',
    },
    about: {
      '@type': 'Person',
      name,
      identifier: profile.wallet,
      description: 'Polymarket whale tracked by SightWhale.',
    },
    variableMeasured: [
      { '@type': 'PropertyValue', name: 'Whale Score', value: Math.round(profile.whale_score || 0) },
      { '@type': 'PropertyValue', name: 'Win Rate', value: Number((profile.win_rate || 0).toFixed(4)) },
      { '@type': 'PropertyValue', name: 'Realized PnL (USD)', value: Number((profile.realized_pnl || 0).toFixed(2)) },
      { '@type': 'PropertyValue', name: 'Total Volume (USD)', value: Number((profile.total_volume || 0).toFixed(2)) },
      { '@type': 'PropertyValue', name: 'Total Trades', value: Math.round(profile.total_trades || 0) },
    ],
  });

  return (
    <div className="min-h-screen text-foreground selection:bg-accent selection:text-white pb-28">
      <main className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-28 sm:pt-36 pb-12">
        <BreadcrumbListScript items={[{ name: 'Whales', url: '/whales' }, { name, url: `/whales/${profile.wallet}` }]} />

        {/* ── Back + top CTA ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <Link
            href="/whales"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden />
            Back to whale leaderboard
          </Link>
          <div className="flex items-center gap-3">
            <a
              href={`https://polymarket.com/profile/${profile.wallet}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              View on Polymarket
              <ExternalLink className="w-3.5 h-3.5" aria-hidden />
            </a>
            <Link
              href="/pricing"
              className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
            >
              Get real-time signals
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>
        </div>

        {/* ── Header ── */}
        <header className="mb-8">
          <p className="eyebrow mb-3">Public whale profile</p>
          <h1 className="text-balance mb-3">{name}</h1>
          <p className="font-mono text-sm text-subtle break-all">{profile.wallet}</p>
        </header>

        {/* ── Score + breakdown ── */}
        <section className="grid gap-4 lg:grid-cols-3 mb-8">
          <div className="rounded-xl bg-accent/[0.04] card-shadow px-6 py-6 flex flex-col justify-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle mb-2">Whale Score</p>
            <p className="text-5xl font-bold tabular-nums stat-number text-accent">
              {Math.round(profile.whale_score || 0)}
            </p>
            <p className="text-xs text-subtle mt-2">0–100 · higher = stronger signal</p>
          </div>

          <div className="lg:col-span-2 rounded-xl bg-surface card-shadow px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle mb-4">Score breakdown</p>
            {breakdown ? (
              <div className="space-y-3">
                {FACTOR_LABELS.map(({ key, label }) => {
                  const value = Number(breakdown[key]) || 0;
                  const pct = Math.min(Math.max(value, 0), 100);
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted">{label}</span>
                        <span className="font-semibold tabular-nums text-foreground">{Math.round(value)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted">Breakdown not available for this whale yet.</p>
            )}
          </div>
        </section>

        {/* ── Stat cards ── */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
          <StatCard label="Total volume" value={formatUsd(profile.total_volume)} />
          <StatCard label="Total trades" value={formatNumber(profile.total_trades)} />
          <StatCard label="Win rate" value={winRateLabel} />
          <StatCard
            label="Realized PnL"
            value={formatSignedUsd(profile.realized_pnl)}
            valueClass={pnlColorClass(profile.realized_pnl)}
          />
        </section>

        {/* ── Top markets ── */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold font-display mb-4">Top markets</h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-surface-hover text-[11px] font-semibold uppercase tracking-wider text-subtle">
                <tr>
                  <th className="px-4 py-2.5">Market</th>
                  <th className="px-3 py-2.5 text-right">Trades</th>
                  <th className="px-3 py-2.5 text-right">Volume</th>
                  <th className="px-3 py-2.5 text-right">PnL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted">
                {profile.top_markets.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted">
                      No market breakdown available.
                    </td>
                  </tr>
                ) : (
                  profile.top_markets.map((m, i) => (
                    <tr key={`${m.market_id || m.market}-${i}`} className="hover:bg-surface-hover">
                      <td className="max-w-[360px] px-4 py-3 text-foreground truncate" title={m.market || undefined}>
                        {m.market || m.market_id || '—'}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs">{formatNumber(m.trades)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs">{formatUsd(m.volume)}</td>
                      <td className={`px-3 py-3 text-right tabular-nums text-xs ${pnlColorClass(m.pnl)}`}>
                        {formatSignedUsd(m.pnl)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Recent trades ── */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold font-display mb-4">Recent trades</h2>
          {profile.recent_trades.length === 0 ? (
            <p className="text-sm text-muted">No recent trades on record.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border bg-surface-hover text-[11px] font-semibold uppercase tracking-wider text-subtle">
                  <tr>
                    <th className="px-4 py-2.5">Time (UTC)</th>
                    <th className="px-4 py-2.5">Market</th>
                    <th className="px-3 py-2.5">Side</th>
                    <th className="px-3 py-2.5 text-right">Size</th>
                    <th className="px-3 py-2.5 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-muted">
                  {profile.recent_trades.map((t, i) => {
                    const market = t.market || t.market_title || t.market_id || '—';
                    const side = (t.side || '').toUpperCase();
                    return (
                      <tr key={t.trade_id || t.whale_trade_id || i} className="hover:bg-surface-hover">
                        <td className="px-4 py-3 font-mono text-[11px] text-subtle whitespace-nowrap">
                          {formatTradeTime(t.time || t.created_at)}
                        </td>
                        <td className="max-w-[320px] px-4 py-3 text-foreground truncate" title={market}>
                          {market}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                              side === 'BUY' ? 'bg-accent/10 text-accent' : side === 'SELL' ? 'bg-red-500/10 text-red-500' : 'bg-surface-hover text-muted'
                            }`}
                          >
                            {side || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-xs">
                          {formatUsd(t.trade_usd ?? t.size)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-xs">
                          {formatDecimal(t.price, 3)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Bottom CTA ── */}
        <div className="rounded-xl bg-accent/[0.04] card-shadow px-6 py-8 text-center">
          <p className="text-lg font-semibold font-display mb-2">Want real-time alerts on whales like this?</p>
          <p className="text-sm text-muted max-w-md mx-auto mb-6 leading-relaxed">
            SightWhale pushes Telegram alerts the moment a top whale makes a high-conviction trade.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/pricing" className="btn-primary inline-flex items-center gap-2 text-sm">
              Get real-time signals
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
            <Link href="/history" className="btn-secondary inline-flex items-center gap-2 text-sm">
              Browse verified history
            </Link>
          </div>
        </div>
      </main>

      {/* ── Structured data ── */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
    </div>
  );
}

function StatCard({
  label,
  value,
  valueClass = 'text-foreground',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl bg-surface card-shadow px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-subtle mb-2">{label}</p>
      <p className={`text-2xl font-bold tabular-nums stat-number ${valueClass}`}>{value}</p>
    </div>
  );
}
