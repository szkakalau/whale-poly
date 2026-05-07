import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Suspense } from 'react';
import { unstable_cache } from 'next/cache';
import { loadPublicHistorySignals, summarizeHistoryRows } from '@/lib/history-signals';
import { loadLiveSignals } from '@/lib/live-signals';
import { getCurrentUser } from '@/lib/auth';
import { filterLiveSignalsForUser } from '@/lib/live-signals-access';
import LiveSignalsFeedLazy from '@/components/LiveSignalsFeedLazy';

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

async function HeroMetrics() {
  const { total, winRate, avgRoi } = await loadCachedHistorySummary();
  return (
    <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-4 max-w-xl mx-auto">
      <div className="rounded-2xl border border-border bg-surface/80 px-3 py-4 text-center">
        <div className="text-[10px] font-black uppercase tracking-widest text-subtle">Signals</div>
        <div className="mt-2 text-lg sm:text-2xl font-black tabular-nums text-foreground">{total}</div>
      </div>
      <div className="rounded-2xl border border-border bg-surface/80 px-3 py-4 text-center">
        <div className="text-[10px] font-black uppercase tracking-widest text-subtle">Win rate</div>
        <div className="mt-2 text-lg sm:text-2xl font-black tabular-nums text-foreground">
          {winRate != null ? `${(winRate * 100).toFixed(1)}%` : '—'}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-surface/80 px-3 py-4 text-center">
        <div className="text-[10px] font-black uppercase tracking-widest text-subtle">Avg ROI</div>
        <div className="mt-2 text-lg sm:text-2xl font-black tabular-nums text-emerald-400">{formatPct(avgRoi)}</div>
      </div>
    </div>
  );
}

async function HistoricalPerformanceSection() {
  const { total, winRate, avgRoi } = await loadCachedHistorySummary();
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-16 sm:mb-20">
      <div className="rounded-[2rem] border border-border bg-surface/40 p-8 sm:p-10">
        <p className="text-[11px] font-bold text-violet-400 tracking-[0.35em] uppercase mb-3">Historical performance</p>
        <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mb-4">
          Numbers you can audit yourself
        </h2>
        <p className="text-sm text-muted max-w-2xl leading-relaxed mb-8">
          Resolved signals through end of yesterday (UTC). Same methodology as the History page—no signup required to
          verify.
        </p>
        <dl className="grid gap-6 sm:grid-cols-3 mb-8">
          <div>
            <dt className="text-[11px] text-muted uppercase tracking-wider font-semibold">Total signals</dt>
            <dd className="text-3xl font-black tabular-nums mt-1">{total}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted uppercase tracking-wider font-semibold">Win rate</dt>
            <dd className="text-3xl font-black tabular-nums mt-1">
              {winRate != null ? `${(winRate * 100).toFixed(1)}%` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted uppercase tracking-wider font-semibold">Average ROI</dt>
            <dd className="text-3xl font-black tabular-nums mt-1 text-emerald-400">{formatPct(avgRoi)}</dd>
          </div>
        </dl>
        <Link
          href="/history"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-bold text-foreground hover:bg-surface-hover transition-colors"
        >
          Open full history table
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </section>
  );
}

async function OpenSignalsPreview() {
  const [liveSignals, user] = await Promise.all([loadLiveSignals(), getCurrentUser()]);
  const signals = filterLiveSignalsForUser(liveSignals, user).slice(0, 3);
  return <LiveSignalsFeedLazy signals={signals} homePreview />;
}

function MetricsFallback() {
  return (
    <div className="mt-10 grid grid-cols-3 gap-3 max-w-xl mx-auto">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-border bg-surface/50 h-24 animate-pulse" />
      ))}
    </div>
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
              lowPrice: '29',
              highPrice: '59',
              priceCurrency: 'USD',
            },
          }),
        }}
      />

      <main className="relative pt-14 sm:pt-20 pb-12">
        <section className="px-4 sm:px-6 max-w-3xl mx-auto text-center pt-8 sm:pt-14 mb-16 sm:mb-20">
          <div className="inline-block rounded-full border border-emerald-500/35 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 mb-6">
            Full refund if you are not profitable — email support@sightwhale.com
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.08] mb-4">
            Whale signals you can verify first
          </h1>
          <p className="text-muted text-sm sm:text-lg max-w-xl mx-auto leading-relaxed">
            Review historical win rate and ROI on our public ledger. Upgrade only when you want today&apos;s live stream.
          </p>

          <Suspense fallback={<MetricsFallback />}>
            <HeroMetrics />
          </Suspense>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
            <Link
              href="/history"
              className="relative px-6 sm:px-8 py-3.5 sm:py-4 min-h-[48px] bg-white text-black font-black rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-2"
            >
              View history
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/pricing"
              className="px-6 sm:px-8 py-3.5 sm:py-4 min-h-[48px] glass border border-border text-foreground font-bold rounded-2xl hover:bg-surface transition-all inline-flex items-center justify-center gap-2"
            >
              Get real-time
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </Link>
          </div>
          <p className="mt-4 text-xs text-subtle">No account needed to audit past performance.</p>
        </section>

        <section id="live-signals" className="max-w-6xl mx-auto px-4 sm:px-6 mb-16 sm:mb-20">
          <div className="mb-6">
            <p className="text-[11px] font-bold text-emerald-400 tracking-[0.35em] uppercase mb-2">In progress</p>
            <h2 className="text-2xl font-black text-foreground tracking-tight">Up to three recent signals</h2>
            <p className="text-sm text-muted mt-2 max-w-2xl">
              Teaser of the live feed. Paid plans unlock the full real-time list and optional Telegram delivery.
            </p>
          </div>
          <Suspense
            fallback={<div className="h-48 rounded-2xl border border-border bg-surface/30 animate-pulse" aria-hidden />}
          >
            <OpenSignalsPreview />
          </Suspense>
        </section>

        <Suspense
          fallback={
            <div className="max-w-6xl mx-auto px-4 mb-16">
              <div className="h-64 rounded-[2rem] border border-border bg-surface/30 animate-pulse" />
            </div>
          }
        >
          <HistoricalPerformanceSection />
        </Suspense>

        <section className="max-w-3xl mx-auto px-4 text-center mb-8">
          <p className="text-lg sm:text-xl font-black text-foreground mb-6">Start when the data earns your trust</p>
          <Link href="/pricing" className="btn-primary inline-flex px-10 py-4 text-base font-black rounded-2xl">
            Get started
          </Link>
          <p className="mt-4 text-xs text-subtle">Pricing · Secure Stripe checkout · Optional Telegram</p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
