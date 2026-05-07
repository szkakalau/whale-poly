import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { HomeCtaLink } from '@/components/HomeCtaLink';
import HomeStickyCta from '@/components/HomeStickyCta';
import { Suspense } from 'react';
import { unstable_cache } from 'next/cache';
import { loadPublicHistorySignals, summarizeHistoryRows } from '@/lib/history-signals';
import { loadLiveSignals } from '@/lib/live-signals';
import { getCurrentUser } from '@/lib/auth';
import { filterLiveSignalsForUser } from '@/lib/live-signals-access';
import LiveSignalsFeedLazy from '@/components/LiveSignalsFeedLazy';
import { PRICING_PRO_MONTHLY } from '@/lib/pricing-plans';

function formatPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(1)}%`;
}

const loadCachedHistorySummary = unstable_cache(
  async () => {
    const rows = await loadPublicHistorySignals(500);
    return summarizeHistoryRows(rows);
  },
  ['home-history-summary-v1'],
  { revalidate: 120 },
);

async function HeroTrustStrip() {
  const { total, winRate, avgRoi } = await loadCachedHistorySummary();
  const wr = winRate != null ? `${(winRate * 100).toFixed(1)}%` : '—';
  return (
    <p className="mt-8 text-sm sm:text-base text-muted max-w-2xl mx-auto leading-relaxed">
      <span className="font-black tabular-nums text-foreground">{total}</span>{' '}
      <span className="text-subtle">resolved signals</span>
      <span className="text-border mx-2">·</span>
      <span className="font-black tabular-nums text-foreground">{wr}</span>{' '}
      <span className="text-subtle">win rate</span>
      <span className="text-border mx-2">·</span>
      <span className="font-black tabular-nums text-emerald-400">{formatPct(avgRoi)}</span>{' '}
      <span className="text-subtle">avg ROI</span>
      <span className="text-subtle block sm:inline sm:ml-1 mt-1 sm:mt-0">(through yesterday UTC, same as History)</span>
    </p>
  );
}

function TrustStripFallback() {
  return (
    <div className="mt-8 mx-auto max-w-xl h-14 rounded-xl border border-border bg-surface/50 animate-pulse" aria-hidden />
  );
}

async function OpenSignalsPreview() {
  const [liveSignals, user] = await Promise.all([loadLiveSignals(), getCurrentUser()]);
  const signals = filterLiveSignalsForUser(liveSignals, user).slice(0, 3);
  return <LiveSignalsFeedLazy signals={signals} homePreview />;
}

function TrustHistorySection() {
  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 mb-16 sm:mb-20">
      <div className="rounded-2xl border border-border-muted bg-surface/30 px-6 py-8 sm:px-8 sm:py-10">
        <p className="text-[11px] font-bold text-violet-400 tracking-[0.35em] uppercase mb-3">Audit trail</p>
        <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mb-3">
          Every resolved signal stays on the ledger
        </h2>
        <p className="text-sm text-muted leading-relaxed mb-6">
          We do not delete losing rows. Open the full table to line-by-line proof before you pay—no account required
          for historical data through end of yesterday UTC.
        </p>
        <HomeCtaLink
          href="/history"
          placement="trust_history"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-bold text-foreground hover:bg-surface-hover transition-colors"
        >
          Browse audited history
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7-7 7" />
          </svg>
        </HomeCtaLink>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen text-foreground selection:bg-[#5B8CFF]/25 overflow-hidden">
      <div className="fixed inset-0 z-[-1] bg-background" />

      <Header />

      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'SightWhale',
            applicationCategory: 'FinanceApplication',
            description:
              'Polymarket whale signals with a full historical audit trail and optional real-time delivery for subscribers.',
            offers: {
              '@type': 'AggregateOffer',
              lowPrice: String(PRICING_PRO_MONTHLY),
              highPrice: '59',
              priceCurrency: 'USD',
            },
          }),
        }}
      />

      <main className="relative pt-14 sm:pt-20 pb-28 sm:pb-12">
        <section className="px-4 sm:px-6 max-w-3xl mx-auto text-center pt-8 sm:pt-14 mb-16 sm:mb-20">
          <div className="inline-block rounded-full border border-emerald-500/35 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 mb-5">
            Money-back: not satisfied your first month? Email{' '}
            <a href="mailto:support@sightwhale.com" className="underline decoration-emerald-500/40 underline-offset-2">
              support@sightwhale.com
            </a>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.08] mb-4">
            Real-time Polymarket whale signals
          </h1>
          <p className="text-muted text-sm sm:text-lg max-w-xl mx-auto leading-relaxed">
            Verify the full track record, then unlock today&apos;s live stream and optional Telegram.
          </p>

          <p className="mt-6">
            <HomeCtaLink
              href="/pricing"
              placement="hero_price_anchor"
              className="text-sm font-black text-violet-300 hover:text-violet-200 underline decoration-violet-500/35 underline-offset-4"
            >
              From ${PRICING_PRO_MONTHLY}/mo · Pro
            </HomeCtaLink>
          </p>

          <Suspense fallback={<TrustStripFallback />}>
            <HeroTrustStrip />
          </Suspense>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
            <HomeCtaLink
              href="/pricing"
              placement="hero_primary"
              className="btn-primary px-6 sm:px-8 py-3.5 sm:py-4 min-h-[48px] rounded-2xl text-sm sm:text-base font-black inline-flex items-center justify-center gap-2 shadow-[0_0_18px_rgba(91,140,255,0.28)] hover:shadow-[0_0_28px_rgba(91,140,255,0.45)]"
            >
              Get real-time
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
            </HomeCtaLink>
            <HomeCtaLink
              href="/history"
              placement="hero_secondary"
              className="px-6 sm:px-8 py-3.5 sm:py-4 min-h-[48px] rounded-2xl border border-border bg-surface/60 text-foreground font-semibold hover:bg-surface-hover transition-colors inline-flex items-center justify-center gap-2 text-sm"
            >
              View full history
              <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7-7 7" />
              </svg>
            </HomeCtaLink>
          </div>
          <p className="mt-4 text-xs text-subtle">History is public through yesterday UTC—no signup to audit.</p>
        </section>

        <section id="live-signals" className="max-w-6xl mx-auto px-4 sm:px-6 mb-16 sm:mb-20">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold text-emerald-400 tracking-[0.35em] uppercase mb-2">Live preview</p>
              <h2 className="text-2xl font-black text-foreground tracking-tight">Up to three recent rows</h2>
              <p className="text-sm text-muted mt-2 max-w-2xl">
                Today&apos;s full feed is paid-only. This is a teaser; upgrade for the complete list and optional
                Telegram.
              </p>
            </div>
            <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
              <HomeCtaLink
                href="/pricing"
                placement="live_unlock"
                className="btn-primary inline-flex justify-center px-6 py-3 min-h-[44px] text-sm font-black rounded-xl whitespace-nowrap"
              >
                Unlock full live feed
              </HomeCtaLink>
              <span className="text-[11px] text-subtle text-center sm:text-right tabular-nums">
                From ${PRICING_PRO_MONTHLY}/mo
              </span>
            </div>
          </div>
          <Suspense
            fallback={<div className="h-48 rounded-2xl border border-border bg-surface/30 animate-pulse" aria-hidden />}
          >
            <OpenSignalsPreview />
          </Suspense>
        </section>

        <TrustHistorySection />

        <section className="max-w-3xl mx-auto px-4 text-center mb-8 sm:mb-10">
          <p className="text-sm font-semibold text-emerald-100/95 mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            First month not working for you? Email support@sightwhale.com for a full refund.
          </p>
          <h2 className="text-xl sm:text-2xl font-black text-foreground mb-6">Choose a plan and unlock today</h2>
          <HomeCtaLink
            href="/pricing"
            placement="closing"
            className="btn-primary inline-flex px-10 py-4 text-base font-black rounded-2xl"
          >
            View pricing
          </HomeCtaLink>
          <p className="mt-4 text-xs text-subtle">Secure Stripe checkout · Cancel anytime · Optional Telegram</p>
        </section>
      </main>

      <Footer />
      <HomeStickyCta />
    </div>
  );
}
