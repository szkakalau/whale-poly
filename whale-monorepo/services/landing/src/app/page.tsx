import { Suspense } from 'react';
import { unstable_cache } from 'next/cache';
import { loadPublicHistorySignals, summarizeHistoryRows } from '@/lib/history-signals';
import { loadLiveSignals } from '@/lib/live-signals';
import { getCurrentUser } from '@/lib/auth';
import { filterLiveSignalsForUser } from '@/lib/live-signals-access';
import LiveSignalsFeedLazy from '@/components/LiveSignalsFeedLazy';
import { HomeCtaLink } from '@/components/HomeCtaLink';
import HomeStickyCta from '@/components/HomeStickyCta';
import { PRICING_PRO_MONTHLY } from '@/lib/pricing-plans';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Clock,
  FileText,
  Globe,
  Search,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react';
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
  ['home-history-summary-v3'],
  { revalidate: 120 },
);

/* ── Data-fetching sub-components ── */

async function StatsBar() {
  const { total, winRate, avgRoi } = await loadCachedHistorySummary();
  const wr = winRate != null ? `${(winRate * 100).toFixed(1)}%` : '—';

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted">
      <span>
        <span className="font-semibold tabular-nums text-foreground stat-number">{total}</span>{' '}
        resolved signals
      </span>
      <span className="text-border hidden sm:inline">·</span>
      <span>
        <span className="font-semibold tabular-nums text-foreground stat-number">{wr}</span>{' '}
        win rate
      </span>
      <span className="text-border hidden sm:inline">·</span>
      <span>
        <span className="font-semibold tabular-nums text-accent stat-number">{formatPct(avgRoi)}</span>{' '}
        avg ROI
      </span>
    </div>
  );
}

function StatsFallback() {
  return <div className="h-6 w-80 rounded-md bg-surface-hover animate-pulse" aria-hidden />;
}

function StatsSection() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 mb-24 sm:mb-32">
      <div className="rounded-lg border border-border bg-surface px-6 py-5 sm:px-8">
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

async function LivePreview() {
  const [liveSignals, user] = await Promise.all([loadLiveSignals(), getCurrentUser()]);
  const signals = filterLiveSignalsForUser(liveSignals, user).slice(0, 3);
  return <LiveSignalsFeedLazy signals={signals} homePreview />;
}

/* ── Static content blocks ── */

const PAIN_POINTS = [
  {
    icon: Globe,
    title: '500+ markets. You can\'t watch them all.',
    description:
      'Polymarket lists hundreds of active markets across politics, sports, crypto, and more. No single person can track every whale move across every market — but our engine does, 24/7.',
  },
  {
    icon: Clock,
    title: 'Whales move first. The crowd moves later.',
    description:
      'By the time you notice a big trade on Polymarket\'s UI, the odds have already shifted. Our real-time monitoring catches whale entries the moment they hit the chain.',
  },
  {
    icon: FileText,
    title: 'Most signal services hide their losers.',
    description:
      'Anyone can tweet winning screenshots. We publish every signal — wins, losses, and break-evens — on a public history page. If we can\'t prove it works, you shouldn\'t pay for it.',
  },
];

const HOW_IT_WORKS = [
  {
    icon: Search,
    title: 'Track',
    description:
      'We continuously monitor every trade from the top 1% most profitable Polymarket wallets. Real-time on-chain data, no delays, no sampling.',
  },
  {
    icon: BarChart3,
    title: 'Score',
    description:
      'Our engine assigns each signal a conviction score based on trade size, wallet history, category expertise, and market context. Noise is filtered; signal survives.',
  },
  {
    icon: Bell,
    title: 'Deliver',
    description:
      'High-conviction signals reach your Telegram in ~30 seconds. Or query any market live on /analyze to see exactly what the whales are doing right now.',
  },
];

const MOATS = [
  {
    icon: TrendingUp,
    title: 'Auditable forever',
    description:
      'Every signal — every win, every loss, every break-even — stays on the public record. Browse the complete history anytime. No cherry-picking, no deleted rows, no excuses.',
  },
  {
    icon: ShieldCheck,
    title: 'Money-back guarantee',
    description:
      'Not satisfied in your first month? Email us for a full refund. No forms, no arguing, no fine print. Our incentives are aligned with yours — we only win if you win.',
  },
  {
    icon: Zap,
    title: 'Push, don\'t pull',
    description:
      'Whale trades appear on your phone in ~30 seconds via Telegram. No dashboard to refresh, no app to install. Or use /analyze to actively query any market\'s whale activity live.',
  },
];

const FAQ_ITEMS = [
  {
    q: 'How is this different from Polymarket\'s own analytics?',
    a: 'Polymarket shows you what happened. SightWhale tells you who made it happen, how much they bet, and whether they\'ve been right before — then pushes it to your phone. Plus, every past signal is auditable on our History page.',
  },
  {
    q: 'How do I know the signals are real?',
    a: 'Every signal we\'ve ever published is on the History page — wins and losses. Compare any signal against the Polymarket blockchain. If you find a deleted or altered row, we\'ll give you a year free.',
  },
  {
    q: 'What if the signals don\'t make me money?',
    a: 'First month is covered by our money-back guarantee. Email castro.liu@me.com and we\'ll refund your subscription in full. We\'d rather earn your trust than keep $29.',
  },
  {
    q: 'Do I need Telegram?',
    a: 'No. Telegram is optional. Paid plans include the live signal feed in-app, and you can use /analyze to actively query any market. Telegram is just the fastest delivery channel.',
  },
];

/* ── Hero stat fetcher ── */

async function HeroStat() {
  const { winRate } = await loadCachedHistorySummary();
  const wr = winRate != null ? `${(winRate * 100).toFixed(1)}%` : null;

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
}

function HeroStatFallback() {
  return (
    <span className="text-accent font-semibold italic">
      a provable track record
    </span>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen selection:bg-accent selection:text-white">
      {/* ═══════════════════════════════════════════
          SECTION 1 — HERO (typography-first)
          ═══════════════════════════════════════════ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-28 sm:pt-36 pb-16 sm:pb-20">
        {/* Eyebrow */}
        <p className="eyebrow mb-6">
          Polymarket whale intelligence
        </p>

        {/* Headline */}
        <h1 className="text-balance mb-6">
          We track the top 1% of Polymarket whales.
          <br />
          They&apos;re right{' '}
          <Suspense fallback={<HeroStatFallback />}>
            <HeroStat />
          </Suspense>.
        </h1>

        {/* Subheadline */}
        <p className="text-base sm:text-lg text-muted max-w-xl leading-relaxed mb-8">
          Every signal — wins, losses, break-evens — published on a permanent public record.
          Because if we can&apos;t prove it works, you shouldn&apos;t pay for it.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <HomeCtaLink
            href="/pricing"
            placement="hero_primary"
            className="btn-primary px-8 min-h-[52px] text-base inline-flex items-center justify-center gap-2"
          >
            Get real-time signals
            <Zap className="w-4 h-4" aria-hidden />
          </HomeCtaLink>
          <HomeCtaLink
            href="/history"
            placement="hero_secondary"
            className="btn-secondary min-h-[52px]"
          >
            View audited history
            <ArrowRight className="w-4 h-4 ml-1.5 opacity-60" aria-hidden />
          </HomeCtaLink>
        </div>

        <p className="mt-4 text-xs text-subtle">
          From ${PRICING_PRO_MONTHLY}/mo · Pro plan · Cancel anytime
        </p>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 2 — TRACK RECORD
          ═══════════════════════════════════════════ */}
      <StatsSection />

      {/* ═══════════════════════════════════════════
          SECTION 3 — THE PROBLEM
          ═══════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-24 sm:mb-32">
        <p className="eyebrow mb-3">Why you need this</p>
        <h2 className="text-balance mb-8">
          Polymarket moves fast. You&apos;re losing edge right now.
        </h2>

        <div className="grid gap-6 sm:grid-cols-3">
          {PAIN_POINTS.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-lg border border-border bg-surface px-6 py-6 hover:border-accent/30 transition-colors"
            >
              <Icon className="w-5 h-5 text-accent mb-4" aria-hidden />
              <h3 className="font-display text-base font-semibold text-foreground mb-2 leading-snug">
                {title}
              </h3>
              <p className="text-sm text-muted leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 4 — HOW IT WORKS
          ═══════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-24 sm:mb-32">
        <p className="eyebrow mb-3">How it works</p>
        <h2 className="text-balance mb-10">
          From whale trade to your phone in three steps.
        </h2>

        <div className="grid gap-8 sm:grid-cols-3">
          {HOW_IT_WORKS.map(({ icon: Icon, title, description }, i) => (
            <div key={title} className="relative">
              <div className="flex items-center gap-4 mb-4">
                <span className="stat-number text-3xl font-semibold text-accent/20 tabular-nums select-none">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="h-px flex-1 bg-border hidden sm:block" aria-hidden />
              </div>
              <div className="flex items-center gap-3 mb-3">
                <Icon className="w-5 h-5 text-accent shrink-0" aria-hidden />
                <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
              </div>
              <p className="text-sm text-muted leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        {/* Connector: the /analyze bridge */}
        <div className="mt-10 rounded-lg border border-border bg-surface px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-accent shrink-0" aria-hidden />
            <p className="text-sm text-muted leading-relaxed">
              <span className="font-semibold text-foreground">Prefer to hunt yourself?</span>{' '}
              Paste any Polymarket link or keyword into{' '}
              <Link href="/analyze" className="text-accent font-semibold hover:text-accent-hover transition-colors">
                /analyze
              </Link>{' '}
              and see what the whales are doing on any market, live.
            </p>
          </div>
          <Link
            href="/analyze"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-hover transition-colors shrink-0"
          >
            Open /analyze
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 5 — THE MOAT
          ═══════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-24 sm:mb-32">
        <p className="eyebrow mb-3">Why SightWhale</p>
        <h2 className="text-balance mb-8">
          Three things no other signal service offers.
        </h2>

        <div className="grid gap-6 sm:grid-cols-3">
          {MOATS.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-lg border border-border bg-surface px-6 py-6"
            >
              <Icon className="w-5 h-5 text-accent mb-4" aria-hidden />
              <h3 className="font-display text-base font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 6 — LIVE PREVIEW
          ═══════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-24 sm:mb-32">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <p className="eyebrow mb-2">Live preview</p>
            <h2 className="text-balance">See it in action</h2>
            <p className="text-sm text-muted mt-1.5 max-w-md">
              Three recent signals from the live feed, delayed by ~1 hour. Subscribers get
              real-time delivery to Telegram in ~30 seconds.
            </p>
          </div>
          <HomeCtaLink
            href="/pricing"
            placement="live_unlock"
            className="btn-primary inline-flex justify-center px-6 py-3 text-sm font-semibold shrink-0"
          >
            Unlock full feed
          </HomeCtaLink>
        </div>
        <Suspense
          fallback={
            <div className="h-48 rounded-lg border border-border bg-surface animate-pulse" aria-hidden />
          }
        >
          <LivePreview />
        </Suspense>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 7 — FAQ
          ═══════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-24 sm:mb-32">
        <p className="eyebrow mb-3">Common questions</p>
        <h2 className="text-balance mb-8">
          Let&apos;s clear up the obvious ones.
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {FAQ_ITEMS.map(({ q, a }) => (
            <div
              key={q}
              className="rounded-lg border border-border bg-surface px-6 py-5"
            >
              <h3 className="text-sm font-semibold text-foreground mb-2">{q}</h3>
              <p className="text-sm text-muted leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 8 — FINAL CTA
          ═══════════════════════════════════════════ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-24 sm:pb-32 text-center">
        <h2 className="text-balance mb-4">
          Try your first month risk-free.
        </h2>
        <p className="text-sm sm:text-base text-muted max-w-lg mx-auto mb-8 leading-relaxed">
          Start with Pro at ${PRICING_PRO_MONTHLY}/mo. If the signals don&apos;t add value in your
          first month, email us for a full refund. No questions asked.
        </p>
        <HomeCtaLink
          href="/pricing"
          placement="closing"
          className="btn-primary inline-flex px-10 py-4 text-base font-semibold"
        >
          View plans & start
        </HomeCtaLink>
        <p className="mt-4 text-xs text-subtle">Secure Stripe checkout · Cancel anytime · Full refund first month</p>
      </section>

      <HomeStickyCta />
    </div>
  );
}
