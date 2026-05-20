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
import TelegramAlertMockup from '@/components/TelegramAlertMockup';
import { WhaleScoreMoatSection } from '@/components/WhaleScoreMoatSection';
import { PRICING_PRO_MONTHLY } from '@/lib/pricing-plans';
import { ArrowRight, Radio, ShieldCheck } from 'lucide-react';

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
    <p className="mt-8 text-sm sm:text-base text-muted max-w-xl leading-relaxed">
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
    <div className="mt-8 max-w-xl h-14 rounded-xl border border-border bg-surface/50 animate-pulse" aria-hidden />
  );
}

async function OpenSignalsPreview() {
  const [liveSignals, user] = await Promise.all([loadLiveSignals(), getCurrentUser()]);
  const signals = filterLiveSignalsForUser(liveSignals, user).slice(0, 3);
  return <LiveSignalsFeedLazy signals={signals} homePreview />;
}

function TrustHistorySection() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-16 sm:mb-20 layout-stack-overlap">
      <div className="relative z-10 max-w-2xl rounded-2xl border border-border-muted bg-surface/40 px-6 py-8 sm:px-8 sm:py-10 layout-diagonal-band -rotate-1 sm:rotate-0 sm:translate-x-0 translate-x-2">
        <p className="text-[11px] font-bold text-accent-sharp tracking-[0.35em] uppercase mb-3">Audit trail</p>
        <h2 className="font-display text-xl sm:text-2xl font-black text-foreground tracking-tight mb-3">
          Every resolved signal stays on the ledger
        </h2>
        <p className="text-sm text-muted leading-relaxed mb-6 max-w-lg">
          We do not delete losing rows. Open the full table to line-by-line proof before you pay—no account required
          for historical data through end of yesterday UTC.
        </p>
        <HomeCtaLink
          href="/history"
          placement="trust_history"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-bold text-foreground hover:bg-surface-hover transition-colors"
        >
          Browse audited history
          <ArrowRight className="w-4 h-4 opacity-80" aria-hidden />
        </HomeCtaLink>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen text-foreground selection:bg-accent-primary/25 overflow-hidden">
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
        <section className="relative px-4 sm:px-6 max-w-7xl mx-auto pt-8 sm:pt-14 mb-16 sm:mb-24 layout-diagonal-band">
          <div className="max-w-3xl text-left animate-reveal-up">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 mb-5">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden />
                Money-back: not satisfied your first month? Email{' '}
                <a href="mailto:support@sightwhale.com" className="underline decoration-emerald-500/40 underline-offset-2">
                  support@sightwhale.com
                </a>
              </div>
              <h1 className="font-display text-[clamp(2rem,6vw,3.25rem)] font-extrabold tracking-tight leading-[1.05] mb-4 text-gradient-accent">
                Real-time Polymarket whale signals
              </h1>
              <p className="text-muted text-sm sm:text-lg max-w-lg leading-relaxed">
                Verify the full track record, then unlock today&apos;s live stream and optional Telegram.
              </p>

              <p className="mt-6">
                <HomeCtaLink
                  href="/pricing"
                  placement="hero_price_anchor"
                  className="text-sm font-black text-accent-sharp hover:text-accent-sharp-hover underline decoration-accent-sharp/35 underline-offset-4"
                >
                  From ${PRICING_PRO_MONTHLY}/mo · Pro
                </HomeCtaLink>
              </p>

              <Suspense fallback={<TrustStripFallback />}>
                <HeroTrustStrip />
              </Suspense>

              <div className="mt-10 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <HomeCtaLink
                  href="/pricing"
                  placement="hero_primary"
                  className="btn-primary px-6 sm:px-8 py-3.5 sm:py-4 min-h-[48px] rounded-2xl text-sm sm:text-base font-black inline-flex items-center justify-center gap-2"
                >
                  Get real-time
                  <Radio className="w-4 h-4 text-emerald-200 animate-pulse" aria-hidden />
                </HomeCtaLink>
                <HomeCtaLink
                  href="/history"
                  placement="hero_secondary"
                  className="px-6 sm:px-8 py-3.5 sm:py-4 min-h-[48px] rounded-2xl border border-border bg-surface/60 text-foreground font-semibold hover:bg-surface-hover transition-colors inline-flex items-center justify-center gap-2 text-sm"
                >
                  View full history
                  <ArrowRight className="w-4 h-4 opacity-70" aria-hidden />
                </HomeCtaLink>
              </div>
              <p className="mt-4 text-xs text-subtle">History is public through yesterday UTC—no signup to audit.</p>
            </div>
          </div>
        </section>

        <WhaleScoreMoatSection variant="dark" className="max-w-6xl mx-auto px-4 sm:px-6 mb-16 sm:mb-20" />

        <section
          aria-labelledby="telegram-preview-heading"
          className="max-w-6xl mx-auto px-4 sm:px-6 mb-16 sm:mb-20"
        >
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="max-w-md lg:pr-4">
              <p className="text-[11px] font-bold text-accent-primary tracking-[0.35em] uppercase mb-3">Telegram</p>
              <h2
                id="telegram-preview-heading"
                className="font-display text-2xl sm:text-3xl font-black text-foreground tracking-tight mb-3"
              >
                What an alert looks like on your phone
              </h2>
              <p className="text-sm text-muted leading-relaxed">
                Optional Telegram delivery—paid subscribers can get pushes fast. Below is a real example framed like the
                bot chat.
              </p>
            </div>
            <div className="relative lg:-mr-6 lg:translate-y-4">
              <div className="absolute -inset-4 rounded-[2rem] bg-accent-primary/8 blur-2xl -z-10" aria-hidden />
              <TelegramAlertMockup />
            </div>
          </div>
        </section>

        <section id="live-signals" className="max-w-6xl mx-auto px-4 sm:px-6 mb-16 sm:mb-20">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="md:max-w-[58%]">
              <p className="text-[11px] font-bold text-emerald-400 tracking-[0.35em] uppercase mb-2">Live preview</p>
              <h2 className="font-display text-2xl font-black text-foreground tracking-tight">Up to three recent rows</h2>
              <p className="text-sm text-muted mt-2">
                Today&apos;s full feed is paid-only. This is a teaser; upgrade for the complete list and optional
                Telegram.
              </p>
            </div>
            <div className="flex flex-col items-stretch md:items-end gap-2 shrink-0 md:-translate-y-2">
              <HomeCtaLink
                href="/pricing"
                placement="live_unlock"
                className="btn-primary inline-flex justify-center px-6 py-3 min-h-[44px] text-sm font-black rounded-xl whitespace-nowrap"
              >
                Unlock full live feed
              </HomeCtaLink>
              <span className="text-[11px] text-subtle text-center md:text-right tabular-nums">
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

        <section className="max-w-3xl mx-auto px-4 text-center mb-8 sm:mb-10 md:text-left md:ml-[12%]">
          <p className="text-sm font-semibold text-emerald-100/95 mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 inline-block">
            First month not working for you? Email support@sightwhale.com for a full refund.
          </p>
          <h2 className="font-display text-xl sm:text-2xl font-black text-foreground mb-6">Choose a plan and unlock today</h2>
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
