import { Suspense } from 'react';
import { unstable_cache } from 'next/cache';
import { loadLiveSignals } from '@/lib/live-signals';
import { getCurrentUser } from '@/lib/auth';
import { filterLiveSignalsForUser } from '@/lib/live-signals-access';
import LiveSignalsFeedLazy from '@/components/LiveSignalsFeedLazy';
import { HomeCtaLink } from '@/components/HomeCtaLink';
import HomeStickyCta from '@/components/HomeStickyCta';
import HeroAnalyzeInput from '@/components/HeroAnalyzeInput';
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

function formatPnlUsd(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  const abs = Math.abs(v);
  let body: string;
  if (abs >= 1_000_000) body = `$${(abs / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) body = `$${(abs / 1_000).toFixed(1)}K`;
  else body = `$${abs.toFixed(0)}`;
  return `${sign}${body}`;
}

const API_BASE = process.env.TRADE_INGEST_API_URL || 'https://trade-ingest-api.onrender.com';

const loadHomeStats = unstable_cache(
  async () => {
    const res = await fetch(`${API_BASE}/stats/home`);
    if (!res.ok) throw new Error(`Stats API ${res.status}`);
    return res.json() as Promise<{
      historyTotal: number;
      scoreTiers: { tier: string; labelName: string; count: number; winRate: number | null; avgRoi: number | null }[];
      starWhale: { walletMasked: string; totalPnl: number; roi: number; winRate: number; whaleScore: number; totalTrades: number } | null;
    }>;
  },
  ['home-stats-v1'],
  { revalidate: 120 },
);

function formatPnlCompact(v: number): string {
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/* ── Data-fetching sub-components ── */

async function ScorePerformanceSection() {
  try {
    const stats = await loadHomeStats();
    const visible = stats.scoreTiers.filter((t) => t.count > 0);
    if (visible.length === 0) return null;

    return (
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-24 sm:mb-32">
        <p className="eyebrow mb-3">Proof in the numbers</p>
        <h2 className="text-balance mb-3">Higher score = better results.</h2>
        <p className="text-sm text-muted max-w-xl mb-8 leading-relaxed">
          We grouped every audited signal by its Whale Score. The pattern is clear.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((t, i) => {
            const isTop = i === 0;
            return (
              <div key={t.tier} className={`rounded-lg border px-5 py-5 ${isTop ? 'border-accent/30 bg-accent/[0.04]' : 'border-border bg-surface'}`}>
                <p className={`text-xs font-semibold tracking-wide uppercase mb-3 ${isTop ? 'text-accent' : 'text-muted'}`}>{t.labelName}</p>
                <p className="text-2xl font-bold tabular-nums stat-number text-foreground mb-1">Score {t.tier}</p>
                <div className="space-y-1 mt-3">
                  <p className="text-sm text-muted"><span className="font-semibold text-accent stat-number">{t.avgRoi != null ? formatPct(t.avgRoi) : '—'}</span> avg ROI</p>
                  <p className="text-sm text-muted"><span className="font-semibold text-foreground stat-number">{t.winRate != null ? `${(t.winRate * 100).toFixed(1)}%` : '—'}</span> win rate</p>
                  <p className="text-xs text-subtle">{t.count} signal{t.count !== 1 ? 's' : ''}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  } catch { return null; }
}

async function StarWhaleSection() {
  try {
    const stats = await loadHomeStats();
    const whale = stats.starWhale;
    if (!whale) return null;

    return (
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-24 sm:mb-32">
        <p className="eyebrow mb-3">Top whale</p>
        <h2 className="text-balance mb-8">Meet the #1 performer.</h2>
        <div className="rounded-lg border border-accent/20 bg-accent/[0.03] px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="min-w-0">
              <p className="text-xs text-subtle mb-1">Wallet</p>
              <p className="text-base font-mono font-semibold text-foreground tabular-nums">{whale.walletMasked}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">Score {whale.whaleScore}</span>
                <span className="text-xs text-muted">{whale.totalTrades} lifetime trades</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-6 sm:gap-8 shrink-0">
              <div className="text-center sm:text-right"><p className="text-xs text-subtle mb-0.5">Historical ROI</p><p className="text-xl font-bold tabular-nums stat-number text-accent">{formatPct(whale.roi)}</p></div>
              <div className="text-center sm:text-right"><p className="text-xs text-subtle mb-0.5">Win Rate</p><p className="text-xl font-bold tabular-nums stat-number text-foreground">{(whale.winRate * 100).toFixed(1)}%</p></div>
              <div className="text-center sm:text-right"><p className="text-xs text-subtle mb-0.5">Total Profit</p><p className="text-xl font-bold tabular-nums stat-number text-accent">{formatPnlCompact(whale.totalPnl)}</p></div>
            </div>
          </div>
        </div>
      </section>
    );
  } catch { return null; }
}

/* ── Data-fetching sub-components ── */

async function StatsBar() {
  try {
    const stats = await loadHomeStats();
    const total = stats.historyTotal;
    // Compute avg ROI and win rate from score tiers
    const allTiers = stats.scoreTiers;
    const totalSignals = allTiers.reduce((s, t) => s + t.count, 0);
    const avgRoi = totalSignals > 0
      ? allTiers.reduce((s, t) => s + (t.avgRoi ?? 0) * t.count, 0) / totalSignals
      : null;
    const totalWins = allTiers.reduce((s, t) => s + (t.winRate ?? 0) * t.count, 0);
    const winRate = totalSignals > 0 ? totalWins / totalSignals : null;
    const wr = winRate != null ? `${(winRate * 100).toFixed(1)}%` : '—';

    return (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted">
        <span>
          <span className="font-semibold tabular-nums text-foreground stat-number">{total}</span>{' '}
          audited signals
        </span>
        <span className="text-border hidden sm:inline">·</span>
        <span>
          <span className="font-semibold tabular-nums text-accent stat-number">{formatPct(avgRoi)}</span>{' '}
          cumulative ROI
        </span>
        <span className="text-border hidden sm:inline">·</span>
        <span>
          <span className="font-semibold text-accent">Publicly verified</span>
        </span>
        <span className="text-border hidden sm:inline">·</span>
        <span>
          <span className="font-semibold tabular-nums text-foreground stat-number">{wr}</span>{' '}
          win rate
        </span>
      </div>
    );
  } catch {
    return <StatsFallback />;
  }
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
  try {
    const stats = await loadHomeStats();
    const tiers = stats.scoreTiers;
    const totalSignals = tiers.reduce((s, t) => s + t.count, 0);
    const totalWins = tiers.reduce((s, t) => s + (t.winRate ?? 0) * t.count, 0);
    const winRate = totalSignals > 0 ? totalWins / totalSignals : null;
    const wr = winRate != null && winRate > 0 ? `${(winRate * 100).toFixed(1)}%` : null;

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
  } catch {
    return (
      <span className="text-accent font-semibold italic">
        a provable track record
      </span>
    );
  }
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

        <div className="max-w-xl mt-6">
          <HeroAnalyzeInput />
        </div>

        <p className="mt-4 text-xs text-subtle">
          From ${PRICING_PRO_MONTHLY}/mo · Pro plan · Cancel anytime
        </p>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 2 — TRACK RECORD
          ═══════════════════════════════════════════ */}
      <StatsSection />

      <Suspense fallback={null}>
        <ScorePerformanceSection />
      </Suspense>

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

      <Suspense fallback={null}>
        <StarWhaleSection />
      </Suspense>

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
