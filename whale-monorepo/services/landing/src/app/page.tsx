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
import {
  ArrowRight,
  BarChart3,
  Bell,
  Clock,
  Eye,
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

/* ── Data-fetching sub-components (unchanged patterns) ── */

async function StatsBar() {
  const { total, winRate, avgRoi } = await loadCachedHistorySummary();
  const wr = winRate != null ? `${(winRate * 100).toFixed(1)}%` : '—';

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted">
      <span>
        <span className="font-black tabular-nums text-foreground font-mono">{total}</span>{' '}
        <span className="text-subtle">resolved signals</span>
      </span>
      <span className="text-border hidden sm:inline">·</span>
      <span>
        <span className="font-black tabular-nums text-foreground font-mono">{wr}</span>{' '}
        <span className="text-subtle">win rate</span>
      </span>
      <span className="text-border hidden sm:inline">·</span>
      <span>
        <span className="font-black tabular-nums text-emerald-400 font-mono">{formatPct(avgRoi)}</span>{' '}
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
    <div className="relative max-w-5xl mx-auto px-4 sm:px-6 -mt-8 mb-20 sm:mb-28 z-20">
      <div className="rounded-2xl border border-border-muted bg-surface/60 backdrop-blur px-6 py-5 sm:px-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold text-muted tracking-[0.3em] uppercase mb-1">
              Live Track Record
            </p>
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
    step: '01',
    icon: Search,
    title: 'Track',
    description:
      'We continuously monitor every trade from the top 1% most profitable Polymarket wallets. Real-time on-chain data, no delays, no sampling.',
  },
  {
    step: '02',
    icon: BarChart3,
    title: 'Score',
    description:
      'Our engine assigns each signal a conviction score based on trade size, wallet history, category expertise, and market context. Noise is filtered; signal survives.',
  },
  {
    step: '03',
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
    a: 'First month is covered by our money-back guarantee. Email support@sightwhale.com and we\'ll refund your subscription in full. We\'d rather earn your trust than keep $29.',
  },
  {
    q: 'Do I need Telegram?',
    a: 'No. Telegram is optional. Paid plans include the live signal feed in-app, and you can use /analyze to actively query any market. Telegram is just the fastest delivery channel.',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen selection:bg-accent-sharp/25">
      {/* ═══════════════════════════════════════════
          SECTION 1 — HERO
          ═══════════════════════════════════════════ */}
      <section className="relative px-4 sm:px-6 max-w-6xl mx-auto pt-16 sm:pt-24 pb-20 sm:pb-28">
        {/* Background glows */}
        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-accent-primary/5 rounded-full blur-[140px] translate-x-1/3 -translate-y-1/4" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent-sharp/3 rounded-full blur-[110px] -translate-x-1/4 translate-y-1/3" />
        </div>

        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:gap-16 items-start">
          {/* Left: copy + CTAs */}
          <div className="max-w-2xl">
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-4 py-1.5 text-xs font-semibold text-emerald-200 mb-6">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden />
              Money-back guarantee — not satisfied? Full refund, first month.
            </div>

            {/* Headline */}
            <h1 className="font-display text-[clamp(2.5rem,6vw,4rem)] font-extrabold leading-[0.94] mb-5 text-gradient-accent">
              We publish every
              <br />
              losing trade.
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg text-muted max-w-xl leading-relaxed mb-8">
              Most signal services cherry-pick winners and hide losses. We post every signal publicly
              — wins, losses, break-evens. Because if we can&apos;t prove it works, you
              shouldn&apos;t pay for it.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mb-8">
              <HomeCtaLink
                href="/pricing"
                placement="hero_primary"
                className="btn-primary px-8 py-4 min-h-[52px] rounded-xl text-base font-black inline-flex items-center justify-center gap-2 shadow-lg shadow-accent-primary/20"
              >
                Get real-time signals
                <Zap className="w-4 h-4 text-emerald-200" aria-hidden />
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

          {/* Right: Telegram mockup */}
          <div className="hidden lg:block w-[340px] shrink-0">
            <div className="relative">
              <div className="absolute -inset-8 rounded-[3rem] bg-accent-primary/5 blur-3xl -z-10" aria-hidden />
              <TelegramAlertMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 2 — TRACK RECORD
          ═══════════════════════════════════════════ */}
      <StatsSection />

      {/* ═══════════════════════════════════════════
          SECTION 3 — THE PROBLEM
          ═══════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-20 sm:mb-28">
        <p className="text-[11px] font-bold text-accent-sharp tracking-[0.35em] uppercase mb-3">
          Why you need this
        </p>
        <h2 className="font-display text-2xl sm:text-3xl font-black text-foreground tracking-tight mb-8">
          Polymarket moves fast. You&apos;re losing edge right now.
        </h2>

        <div className="grid gap-6 sm:grid-cols-3">
          {PAIN_POINTS.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-2xl border border-border-muted bg-surface/40 px-6 py-6 hover:border-border transition-colors"
            >
              <Icon className="w-5 h-5 text-accent-sharp mb-4" aria-hidden />
              <h3 className="font-display text-base font-bold text-foreground mb-2 leading-snug">
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
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-20 sm:mb-28">
        <p className="text-[11px] font-bold text-accent-primary tracking-[0.35em] uppercase mb-3">
          How it works
        </p>
        <h2 className="font-display text-2xl sm:text-3xl font-black text-foreground tracking-tight mb-10">
          From whale trade to your phone in three steps.
        </h2>

        <div className="grid gap-8 sm:grid-cols-3">
          {HOW_IT_WORKS.map(({ step, icon: Icon, title, description }) => (
            <div key={step} className="relative">
              {/* Step number */}
              <div className="flex items-center gap-4 mb-4">
                <span className="font-mono text-3xl font-black text-accent-primary/25 tabular-nums select-none">
                  {step}
                </span>
                <div className="h-px flex-1 bg-border-muted hidden sm:block" aria-hidden />
              </div>
              <div className="flex items-center gap-3 mb-3">
                <Icon className="w-5 h-5 text-accent-sharp shrink-0" aria-hidden />
                <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
              </div>
              <p className="text-sm text-muted leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        {/* Connector: the /analyze bridge */}
        <div className="mt-10 rounded-2xl border border-border-muted bg-surface/30 px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-accent-primary shrink-0" aria-hidden />
            <p className="text-sm text-muted leading-relaxed">
              <span className="font-bold text-foreground">Prefer to hunt yourself?</span>{' '}
              Paste any Polymarket link or keyword into{' '}
              <Link href="/analyze" className="text-accent-sharp font-semibold hover:underline underline-offset-4">
                /analyze
              </Link>{' '}
              and see what the whales are doing on any market, live.
            </p>
          </div>
          <Link
            href="/analyze"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-primary hover:underline underline-offset-4 shrink-0"
          >
            Open /analyze
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 5 — THE MOAT
          ═══════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-20 sm:mb-28">
        <p className="text-[11px] font-bold text-accent-sharp tracking-[0.35em] uppercase mb-3">
          Why SightWhale
        </p>
        <h2 className="font-display text-2xl sm:text-3xl font-black text-foreground tracking-tight mb-8">
          Three things no other signal service offers.
        </h2>

        <div className="grid gap-6 sm:grid-cols-3">
          {MOATS.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-surface/50 px-6 py-6"
            >
              <Icon className="w-5 h-5 text-accent-primary mb-4" aria-hidden />
              <h3 className="font-display text-base font-bold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 6 — LIVE PREVIEW
          ═══════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-20 sm:mb-28">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] font-bold text-accent-sharp tracking-[0.35em] uppercase mb-2">
              Live preview
            </p>
            <h2 className="font-display text-2xl font-black text-foreground tracking-tight">
              See it in action
            </h2>
            <p className="text-sm text-muted mt-1.5 max-w-md">
              Three recent signals from the live feed. Today&apos;s full stream and Telegram delivery
              are available to paid members.
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

      {/* ═══════════════════════════════════════════
          SECTION 7 — FAQ
          ═══════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-20 sm:mb-28">
        <p className="text-[11px] font-bold text-accent-sharp tracking-[0.35em] uppercase mb-3">
          Common questions
        </p>
        <h2 className="font-display text-2xl sm:text-3xl font-black text-foreground tracking-tight mb-8">
          Let&apos;s clear up the obvious ones.
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {FAQ_ITEMS.map(({ q, a }) => (
            <div
              key={q}
              className="rounded-2xl border border-border-muted bg-surface/30 px-6 py-5"
            >
              <h3 className="text-sm font-bold text-foreground mb-2">{q}</h3>
              <p className="text-sm text-muted leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 8 — FINAL CTA
          ═══════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24 sm:pb-32">
        <div className="rounded-2xl border border-accent-primary/20 bg-surface/40 px-6 py-12 sm:px-12 sm:py-16 text-center">
          <h2 className="font-display text-2xl sm:text-3xl font-black text-foreground mb-4">
            Try your first month risk-free.
          </h2>
          <p className="text-sm sm:text-base text-muted max-w-lg mx-auto mb-8 leading-relaxed">
            Start with Pro at ${PRICING_PRO_MONTHLY}/mo. If the signals don&apos;t add value in your
            first month, email us for a full refund. No questions asked.
          </p>
          <HomeCtaLink
            href="/pricing"
            placement="closing"
            className="btn-primary inline-flex px-10 py-4 text-base font-black rounded-xl shadow-lg shadow-accent-primary/20"
          >
            View plans & start
          </HomeCtaLink>
          <p className="mt-4 text-xs text-subtle">Secure Stripe checkout · Cancel anytime · Full refund first month</p>
        </div>
      </section>

      <HomeStickyCta />
    </div>
  );
}
