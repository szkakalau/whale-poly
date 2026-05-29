import { Suspense } from 'react';
import { unstable_cache } from 'next/cache';
import { loadPublicHistorySignals, summarizeHistoryRows } from '@/lib/history-signals';
import { loadLiveSignals } from '@/lib/live-signals';
import { getCurrentUser } from '@/lib/auth';
import { filterLiveSignalsForUser } from '@/lib/live-signals-access';
import LiveSignalsFeedLazy from '@/components/LiveSignalsFeedLazy';
import TelegramAlertMockup from '@/components/TelegramAlertMockup';
import { HomeCtaLink } from '@/components/HomeCtaLink';
import HomeStickyCta from '@/components/HomeStickyCta';
import { PRICING_PRO_MONTHLY } from '@/lib/pricing-plans';
import { ArrowRight, Radio, ShieldCheck, TrendingUp, Zap } from 'lucide-react';
import Link from 'next/link';

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
  ['home-history-summary-v2'],
  { revalidate: 120 },
);

async function StatsBar() {
  const { total, winRate, avgRoi } = await loadCachedHistorySummary();
  const wr = winRate != null ? `${(winRate * 100).toFixed(1)}%` : '—';

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted">
      <span>
        <span className="font-black tabular-nums text-foreground">{total}</span>{' '}
        <span className="text-subtle">resolved signals</span>
      </span>
      <span className="text-border hidden sm:inline">·</span>
      <span>
        <span className="font-black tabular-nums text-foreground">{wr}</span>{' '}
        <span className="text-subtle">win rate</span>
      </span>
      <span className="text-border hidden sm:inline">·</span>
      <span>
        <span className="font-black tabular-nums text-emerald-400">{formatPct(avgRoi)}</span>{' '}
        <span className="text-subtle">avg ROI</span>
      </span>
    </div>
  );
}

function StatsFallback() {
  return <div className="h-6 w-80 rounded-lg bg-surface/50 animate-pulse" aria-hidden />;
}

function StatsSection() {
  return (
    <div className="relative max-w-5xl mx-auto px-4 sm:px-6 -mt-8 mb-20 sm:mb-24 z-20">
      <div className="rounded-2xl border border-border-muted bg-surface/60 backdrop-blur px-6 py-5 sm:px-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold text-muted tracking-[0.3em] uppercase mb-1">Live Track Record</p>
            <Suspense fallback={<StatsFallback />}>
              <StatsBar />
            </Suspense>
          </div>
          <Link
            href="/history"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-sharp hover:underline underline-offset-4 shrink-0"
          >
            Browse full history
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

async function LivePreview() {
  const [liveSignals, user] = await Promise.all([loadLiveSignals(), getCurrentUser()]);
  const signals = filterLiveSignalsForUser(liveSignals, user).slice(0, 3);
  return <LiveSignalsFeedLazy signals={signals} homePreview />;
}

export default function Home() {
  return (
    <div className="min-h-screen selection:bg-accent-sharp/25">
      {/* Hero — asymmetric, bold, no cards */}
      <section className="relative px-4 sm:px-6 max-w-6xl mx-auto pt-12 sm:pt-20 pb-16 sm:pb-24">
        {/* Background glow */}
        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent-primary/6 rounded-full blur-[120px] translate-x-1/4 -translate-y-1/4" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent-sharp/4 rounded-full blur-[100px] -translate-x-1/4 translate-y-1/4" />
        </div>

        <div className="max-w-3xl">
          {/* Trust badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-4 py-1.5 text-xs font-semibold text-emerald-200 mb-6">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden />
            Money-back guarantee — not satisfied? Full refund first month.
          </div>

          {/* Main headline */}
          <h1 className="font-display text-[clamp(2.25rem,5.5vw,3.75rem)] font-extrabold leading-[0.95] mb-5 text-gradient-accent">
            Follow the smart money
            <br />
            on Polymarket
          </h1>

          <p className="text-base sm:text-lg text-muted max-w-lg leading-relaxed mb-8">
            Real-time whale trade signals delivered to Telegram. Full historical audit trail.
            Pay only if you trust the record.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mb-10">
            <HomeCtaLink
              href="/pricing"
              placement="hero_primary"
              className="btn-primary px-8 py-4 min-h-[52px] rounded-xl text-base font-black inline-flex items-center justify-center gap-2 shadow-lg shadow-accent-primary/20"
            >
              Get real-time signals
              <Radio className="w-4 h-4 text-emerald-200 animate-pulse" aria-hidden />
            </HomeCtaLink>
            <HomeCtaLink
              href="/history"
              placement="hero_secondary"
              className="px-8 py-4 min-h-[52px] rounded-xl border border-border bg-surface/60 text-foreground font-semibold hover:bg-surface-hover transition-colors inline-flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              View audited history
              <ArrowRight className="w-4 h-4 opacity-70" aria-hidden />
            </HomeCtaLink>
          </div>

          <p className="text-xs text-subtle">
            From ${PRICING_PRO_MONTHLY}/mo · Pro plan · Cancel anytime · Optional Telegram
          </p>
        </div>
      </section>

      {/* Stats panel */}
      <StatsSection />

      {/* Value props — 2-col asymmetric grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-20 sm:mb-24">
        <div className="grid gap-6 sm:gap-8 md:grid-cols-[1fr_1.2fr] lg:grid-cols-[1fr_1.4fr] items-start">
          {/* Left: Telegram preview */}
          <div className="order-2 md:order-1">
            <div className="relative">
              <div className="absolute -inset-6 rounded-[2.5rem] bg-accent-primary/6 blur-2xl -z-10" aria-hidden />
              <TelegramAlertMockup />
            </div>
          </div>

          {/* Right: value text */}
          <div className="order-1 md:order-2 md:pl-4">
            <p className="text-[11px] font-bold text-accent-primary tracking-[0.35em] uppercase mb-3">
              Real-time Delivery
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-black text-foreground tracking-tight mb-4">
              Whale signals, delivered to your phone
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-6 max-w-md">
              When a top trader makes a high-conviction move, you know within seconds. Push alerts via Telegram
              — no app to install, no dashboard to refresh.
            </p>

            <div className="space-y-3">
              {[
                { icon: Zap, text: 'Real-time push — no polling, no delays' },
                { icon: TrendingUp, text: 'Top 1% whales only — quality over quantity' },
                { icon: ShieldCheck, text: 'Full history auditable — we never delete losing rows' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm text-muted">
                  <Icon className="w-4 h-4 text-accent-sharp shrink-0" aria-hidden />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Live preview */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-20 sm:mb-24">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] font-bold text-accent-sharp tracking-[0.35em] uppercase mb-2">Live Preview</p>
            <h2 className="font-display text-2xl font-black text-foreground tracking-tight">
              Recent whale signals
            </h2>
            <p className="text-sm text-muted mt-1.5 max-w-md">
              Today&apos;s full feed is paid-only. Upgrade for the complete list and Telegram delivery.
            </p>
          </div>
          <HomeCtaLink
            href="/pricing"
            placement="live_unlock"
            className="btn-primary inline-flex justify-center px-6 py-3 min-h-[44px] text-sm font-black rounded-xl shrink-0"
          >
            Unlock full feed
          </HomeCtaLink>
        </div>
        <Suspense
          fallback={
            <div className="h-48 rounded-2xl border border-border bg-surface/30 animate-pulse" aria-hidden />
          }
        >
          <LivePreview />
        </Suspense>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24 sm:pb-28">
        <div className="rounded-2xl border border-border-muted bg-surface/40 px-6 py-10 sm:px-10 sm:py-14 text-center">
          <h2 className="font-display text-2xl sm:text-3xl font-black text-foreground mb-3">
            Ready to trade with the whales?
          </h2>
          <p className="text-sm text-muted max-w-md mx-auto mb-8 leading-relaxed">
            Start with Pro at ${PRICING_PRO_MONTHLY}/mo. First month money-back if it doesn&apos;t work for you.
          </p>
          <HomeCtaLink
            href="/pricing"
            placement="closing"
            className="btn-primary inline-flex px-10 py-4 text-base font-black rounded-xl shadow-lg shadow-accent-primary/20"
          >
            View pricing
          </HomeCtaLink>
          <p className="mt-4 text-xs text-subtle">Secure Stripe checkout · Cancel anytime</p>
        </div>
      </section>

      <HomeStickyCta />
    </div>
  );
}
