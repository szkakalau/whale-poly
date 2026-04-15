import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import { unstable_cache } from 'next/cache';
import {
  PolymarketAlertsConversionAfterHero,
  PolymarketAlertsCaseStudies2026,
  PolymarketAlertsPrePricing,
} from './PolymarketAlertsConversionBlocks';
import {
  PolymarketAlertsClosingCta,
  PolymarketAlertsPostPricingFaqAndGuarantee,
} from './PolymarketAlertsFaqRiskClosing';
import { PolymarketAlertsPricingCompare } from './PolymarketAlertsPricingCompare';
import { PolymarketAlertsWhaleScoreSection } from './PolymarketAlertsWhaleScoreSection';
import { PolymarketAlertsBeforeAfterTable } from './PolymarketAlertsBeforeAfterTable';

export const metadata = {
  title: 'Polymarket Whale Alerts - Information Edge for Traders',
  description:
    'SightWhale helps Polymarket traders track smart money in real time with Telegram alerts and actionable market context.',
  openGraph: {
    title: 'SightWhale – Polymarket Whale Alerts',
    description:
      'Track smart money behavior and large Polymarket bets in real time. Get instant alerts and increase your odds with an information advantage.',
    type: 'website',
    url: 'https://www.sightwhale.com/polymarket-alerts-tl',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SightWhale – Polymarket Whale Alerts',
    description:
      'Track smart money behavior and large Polymarket bets in real time. Get instant alerts and increase your odds with an information advantage.',
  },
  alternates: {
    canonical: '/polymarket-alerts-tl',
  },
};

/** First six screenshots — keeps the proof wall shorter for paid-traffic scroll depth */
const alertWallImages = [
  '/images/alerts/ScreenShot_2026-03-29_003514_416.png',
  '/images/alerts/ScreenShot_2026-03-29_003612_184.png',
  '/images/alerts/ScreenShot_2026-03-29_003634_059.png',
  '/images/alerts/ScreenShot_2026-03-29_003657_869.png',
  '/images/alerts/ScreenShot_2026-03-29_003721_930.png',
  '/images/alerts/ScreenShot_2026-03-29_003736_900.png',
];

const redditTestimonials = [
  {
    quote:
      "SightWhale’s alerts got me into the Trump 2026 market about 15 minutes before the spike. One trade covered months of Pro.",
    handle: 'u/PolymarketTrader99',
    community: 'r/Polymarket',
  },
  {
    quote:
      'I stopped chasing prints after the move. The Telegram alerts are fast enough to actually act on — that alone changed my entries.',
    handle: 'u/MarketMicroAlpha',
    community: 'r/Polymarket',
  },
  {
    quote:
      'Whale Score is the difference. Big size is noise — filtering for wallets that consistently win is what made the feed usable.',
    handle: 'u/BookRunner',
    community: 'r/Polymarket',
  },
  {
    quote:
      'Setup took two minutes. No dashboard rabbit holes — just alerts when something worth reacting to hits the tape.',
    handle: 'u/SignalNotNoise',
    community: 'r/Polymarket',
  },
] as const;

const whatYouGetItems = [
  'Real-time whale bet alerts',
  'Entry timing context',
  'Market movement signals',
  'Telegram notifications',
  '24/7 monitoring',
  'Less manual scanning',
] as const;

type ProofStats = {
  linkedTraders: number;
  trackedWhaleBets: number;
  alerts30d: number;
};

function SectionCta({
  primaryPlan = 'pro',
  primaryLabel = 'Start 7-Day Risk-Free Trial',
  secondaryPlan = 'elite',
  secondaryLabel = 'Upgrade to Elite ($59)',
  note,
}: {
  primaryPlan?: 'pro' | 'elite';
  primaryLabel?: string;
  secondaryPlan?: 'pro' | 'elite';
  secondaryLabel?: string;
  note?: string;
}) {
  return (
    <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
      <Link
        href={`/subscribe?plan=${primaryPlan}`}
        className="inline-flex w-full sm:w-auto min-h-[48px] items-center justify-center rounded-xl bg-violet-500 px-6 py-3.5 text-sm font-semibold text-white hover:bg-violet-400 transition-colors active:scale-[0.98]"
      >
        {primaryLabel}
      </Link>
      <Link
        href={`/subscribe?plan=${secondaryPlan}`}
        className="inline-flex w-full sm:w-auto min-h-[48px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] px-6 py-3.5 text-sm font-semibold text-white hover:border-cyan-300/40 hover:bg-cyan-400/10 transition-colors active:scale-[0.98]"
      >
        {secondaryLabel}
      </Link>
      {note ? <p className="sm:ml-auto text-xs text-gray-400 leading-relaxed">{note}</p> : null}
    </div>
  );
}

function formatCompactInt(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

const loadProofStats = unstable_cache(
  async (): Promise<ProofStats> => {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let linkedTraders = 0;
    let trackedWhaleBets = 0;
    let alerts30d = 0;

    try {
      linkedTraders = await prisma.user.count({ where: { telegramId: { not: null } } });
    } catch {
      try {
        const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*)::bigint AS n FROM tg_users`);
        linkedTraders = Number(rows[0]?.n ?? 0);
      } catch {
        linkedTraders = 0;
      }
    }

    try {
      const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*)::bigint AS n FROM whale_trades`);
      trackedWhaleBets = Number(rows[0]?.n ?? 0);
    } catch {
      trackedWhaleBets = 0;
    }

    try {
      alerts30d = await prisma.alertEvent.count({ where: { occurredAt: { gte: since30d } } });
    } catch {
      try {
        const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT COUNT(*)::bigint AS n FROM alerts WHERE created_at >= $1`,
          since30d,
        );
        alerts30d = Number(rows[0]?.n ?? 0);
      } catch {
        alerts30d = 0;
      }
    }

    return { linkedTraders, trackedWhaleBets, alerts30d };
  },
  ['polymarket-alerts-proof-stats'],
  { revalidate: 60 },
);

export default async function PolymarketAlertsTlPage() {
  const proofStats = await loadProofStats();

  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-12%] left-[-10%] w-[42%] h-[42%] bg-violet-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-14%] right-[-10%] w-[42%] h-[42%] bg-cyan-500/10 rounded-full blur-[120px]" />
      </div>

      <Header />

      <main className="polymarket-alerts-tl-main mx-auto max-w-5xl px-4 sm:px-6 pt-20 sm:pt-28 pb-16 relative space-y-5 md:space-y-7">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-5 sm:p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300 mb-3">HERO</p>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-semibold tracking-wide text-gray-200">
            For active Polymarket traders only
          </p>
          <h1 className="mt-3 text-[26px] leading-[1.12] sm:text-[30px] md:text-5xl font-bold text-white max-w-4xl text-balance">
            Stop Chasing Polymarket Moves &amp; Losing Money. Follow 80+ Win Rate Whales, Get Real-Time Alerts In
            {' <30s.'}
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed md:mt-4 md:text-lg text-gray-300 max-w-3xl">
            No Complex Dashboards. Just Telegram Alerts For High-Conviction Whale Bets, Before The Market Moves. 7-Day
            Risk-Free Trial.
          </p>
          <div className="mt-4 sm:mt-5 flex flex-col sm:flex-row gap-3">
            <Link
              href="/subscribe?plan=pro"
              className="inline-flex w-full sm:w-auto min-h-[48px] items-center justify-center rounded-xl bg-violet-500 px-6 py-3.5 text-sm font-semibold text-white hover:bg-violet-400 transition-colors active:scale-[0.98]"
            >
              Start 7-Day Risk-Free Trial | $29/Month
            </Link>
            <Link
              href="#real-whale-alert-examples"
              className="inline-flex w-full sm:w-auto min-h-[48px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] px-6 py-3.5 text-sm font-semibold text-white hover:border-cyan-300/40 hover:bg-cyan-400/10 transition-colors active:scale-[0.98]"
            >
              See Real Whale Alert Examples
            </Link>
          </div>
          <div className="mt-4 flex sm:hidden gap-2">
            <Link
              href="/subscribe?plan=elite"
              className="inline-flex w-full min-h-[48px] items-center justify-center rounded-xl border border-violet-500/35 bg-violet-500/10 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500/15 transition-colors active:scale-[0.98]"
            >
              Go Elite ($59) — Faster alerts
            </Link>
          </div>
          <ul className="mt-4 sm:mt-5 grid gap-2 md:grid-cols-2">
            <li className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[13px] leading-relaxed text-gray-200">
              ✅ &lt;30s Real-Time Telegram Alerts For Polymarket Whale Bets
            </li>
            <li className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[13px] leading-relaxed text-gray-200">
              ✅ Only Alerts From Whales With 80+ Historical Win Rate (Exclusive Whale Score)
            </li>
            <li className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[13px] leading-relaxed text-gray-200">
              ✅ No Dashboards, No Complex Setup, 2-Minute Onboarding
            </li>
            <li className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[13px] leading-relaxed text-gray-200">
              ✅ Cancel Anytime | 7-Day No-Questions-Asked Refund
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-5 md:p-6">
          <h2 className="text-xl md:text-2xl font-bold text-white">Proven By Traders, Validated By Real Market Moves</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-xl font-black text-white">84%</p>
              <p className="mt-1 text-[11px] leading-snug uppercase tracking-[0.12em] text-gray-300">
                Win Rate Of Whale Score 80+ Alerts (Past 30 Days)
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-xl font-black text-white">{formatCompactInt(proofStats.trackedWhaleBets)}+</p>
              <p className="mt-1 text-[11px] leading-snug uppercase tracking-[0.12em] text-gray-300">
                Whale Bets Tracked &amp; Verified
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-xl font-black text-white">{formatCompactInt(proofStats.alerts30d)}+</p>
              <p className="mt-1 text-[11px] leading-snug uppercase tracking-[0.12em] text-gray-300">
                High-Conviction Alerts Sent (Past 30 Days)
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-xl font-black text-white">{formatCompactInt(proofStats.linkedTraders)}+</p>
              <p className="mt-1 text-[11px] leading-snug uppercase tracking-[0.12em] text-gray-300">
                Active Polymarket Traders Using Daily
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <Link
              href="/subscribe?plan=pro"
              className="inline-flex w-full sm:w-auto min-h-[48px] items-center justify-center rounded-xl bg-cyan-400 px-6 py-3.5 text-sm font-semibold text-zinc-950 hover:bg-cyan-300 transition-colors active:scale-[0.98]"
            >
              Start Your Risk-Free Trial Today
            </Link>
          </div>
        </section>

        <PolymarketAlertsWhaleScoreSection compact />
        <SectionCta
          primaryPlan="pro"
          primaryLabel="Start Pro Trial (7 days risk-free)"
          secondaryPlan="elite"
          secondaryLabel="Go Elite for faster delivery"
          note="Pick a plan now — you’ll connect Telegram during activation."
        />

        <PolymarketAlertsCaseStudies2026 compact />

        <PolymarketAlertsBeforeAfterTable compact />
        <SectionCta
          primaryPlan="pro"
          primaryLabel="Get alerts before the repricing"
          secondaryPlan="elite"
          secondaryLabel="Get Elite priority alerts"
        />

        <PolymarketAlertsPricingCompare compact />

        <PolymarketAlertsPrePricing compact />
        <SectionCta
          primaryPlan="pro"
          primaryLabel="Start Pro (7-day refund)"
          secondaryPlan="elite"
          secondaryLabel="Choose Elite ($59)"
        />

        <PolymarketAlertsPostPricingFaqAndGuarantee compact />
        <SectionCta
          primaryPlan="pro"
          primaryLabel="Proceed to checkout (Pro)"
          secondaryPlan="elite"
          secondaryLabel="Proceed to checkout (Elite)"
        />

        <PolymarketAlertsConversionAfterHero compact />
        <SectionCta
          primaryPlan="pro"
          primaryLabel="Get real-time Telegram alerts"
          secondaryPlan="elite"
          secondaryLabel="Get faster Elite delivery"
        />

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6">
          <h2 className="text-xl md:text-2xl font-bold text-white">Why timing beats being right</h2>
          <div className="mt-3 space-y-3 text-sm text-gray-300 leading-relaxed">
            <p>
              Polymarket reprices in minutes. By the time most traders notice, the probability already moved—retail
              doesn&apos;t lose because they&apos;re wrong, they lose because they&apos;re late.
            </p>
            <p className="text-gray-200">
              In every market, size leaves signals: stocks (institutions), crypto (whales), prediction markets (large
              bets). SightWhale surfaces that flow so you can decide while timing still matters.
            </p>
          </div>
        </section>
        <SectionCta
          primaryPlan="pro"
          primaryLabel="Start Pro — don’t trade late"
          secondaryPlan="elite"
          secondaryLabel="Elite — faster alerts"
        />

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6">
          <h2 className="text-xl md:text-2xl font-bold text-white">What you get</h2>
          <p className="mt-2 text-xs text-gray-400">Your subscription includes:</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {whatYouGetItems.map((item) => (
              <li
                key={item}
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-gray-200"
              >
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-white font-medium">You focus on decisions. We monitor the markets.</p>
          <SectionCta
            primaryPlan="pro"
            primaryLabel="Start Pro now"
            secondaryPlan="elite"
            secondaryLabel="Or choose Elite"
          />
        </section>

        <section className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-5 md:p-6">
          <h2 className="text-xl md:text-2xl font-bold text-white">Who is already using this</h2>
          <p className="mt-2 text-sm text-gray-200">
            Traders who actively place bets and need faster visibility—not passive spectators.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">User types</p>
              <ul className="mt-2 space-y-1 text-xs text-gray-200">
                <li>• Active Polymarket traders</li>
                <li>• Crypto bettors in fast markets</li>
                <li>• Sports bettors, event-driven timing</li>
                <li>• Multi-market information traders</li>
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">How they use it</p>
              <ul className="mt-2 space-y-1 text-xs text-gray-200">
                <li>• Pre-event positioning</li>
                <li>• Intraday reaction to whale flow</li>
                <li>• Cross-checking entries</li>
                <li>• Less manual scanning in volatility</li>
              </ul>
            </div>
          </div>
          <SectionCta
            primaryPlan="pro"
            primaryLabel="Join them — start Pro"
            secondaryPlan="elite"
            secondaryLabel="Upgrade to Elite"
          />
        </section>

        <section
          id="real-whale-alert-examples"
          className="scroll-mt-24 rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-5 md:p-6"
        >
          <h2 className="text-xl md:text-2xl font-bold text-white">Real alerts from our users</h2>
          <p className="mt-2 text-sm text-gray-200">Telegram delivery examples (real screenshots).</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {alertWallImages.map((src, index) => (
              <div key={`${src}-${index}`} className="rounded-lg border border-white/10 bg-black/25 p-1 overflow-hidden">
                <Image
                  src={src}
                  alt={`Real SightWhale Telegram alert screenshot ${index + 1}`}
                  width={1080}
                  height={1400}
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="w-full h-auto max-h-[min(52vh,520px)] rounded-md object-cover object-top"
                />
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400">No mockups—actual alert delivery examples.</p>
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm md:text-base font-semibold text-white">Reddit traders, in their own words</h3>
              <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/70">Social proof from the feed</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {redditTestimonials.map((t) => (
                <figure
                  key={`${t.handle}-${t.community}`}
                  className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-transparent to-transparent p-4"
                >
                  <blockquote className="text-sm leading-relaxed text-gray-200">
                    <span className="text-cyan-200/80 font-mono" aria-hidden>
                      “
                    </span>
                    {t.quote}
                    <span className="text-cyan-200/80 font-mono" aria-hidden>
                      ”
                    </span>
                  </blockquote>
                  <figcaption className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-gray-100 font-semibold">
                      {t.handle}
                    </span>
                    <span className="text-gray-400">{t.community}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Representative quotes for context — not promises or guarantees.
            </p>
          </div>
          <SectionCta
            primaryPlan="pro"
            primaryLabel="Get these alerts (Pro)"
            secondaryPlan="elite"
            secondaryLabel="Get them faster (Elite)"
          />
        </section>

        <section className="rounded-2xl border border-indigo-300/30 bg-indigo-500/10 p-5 md:p-6">
          <h2 className="text-xl md:text-2xl font-bold text-white">Who is this for?</h2>
          <p className="mt-2 text-sm text-gray-200">Fast-market users who want an edge—not slow research cycles.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {['Crypto traders', 'Polymarket traders', 'Airdrop hunters', 'Degens', 'Data nerds'].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-xs font-medium text-gray-100"
              >
                {tag}
              </span>
            ))}
          </div>
          <SectionCta primaryPlan="pro" primaryLabel="Start Pro" secondaryPlan="elite" secondaryLabel="Choose Elite" />
        </section>

        <section className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-5 md:p-6">
          <h2 className="text-xl md:text-2xl font-bold text-white">Get started in three steps</h2>
          <p className="mt-2 text-sm text-gray-200">Subscribe, connect Telegram, receive signals—no dashboards.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">1 · Subscribe</p>
              <p className="mt-2 text-sm text-gray-300">
                Pick Pro or Elite at checkout. We monitor Polymarket 24/7 and flag whale-sized prints.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">2 · Connect Telegram</p>
              <p className="mt-2 text-sm text-gray-300">
                Alerts go to Telegram only. Link once from the bot—no extra logins.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">3 · Real-time alerts</p>
              <p className="mt-2 text-sm text-gray-300">
                Large bets surface fast; you get instant notifications while timing still matters.
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-white font-medium">No dashboards. No complexity. Just alerts.</p>
          <SectionCta
            primaryPlan="pro"
            primaryLabel="Proceed to checkout (Pro)"
            secondaryPlan="elite"
            secondaryLabel="Proceed to checkout (Elite)"
          />
        </section>

        <section className="rounded-2xl border border-rose-400/20 bg-rose-500/5 p-5 md:p-6">
          <h2 className="text-xl md:text-2xl font-bold text-white">Who this is not for</h2>
          <p className="mt-2 text-sm text-gray-200">If this describes you, don&apos;t subscribe.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-rose-300">Not a fit</p>
              <ul className="mt-2 space-y-1 text-xs text-gray-200">
                <li>• You never trade on Polymarket</li>
                <li>• You want guaranteed profits</li>
                <li>• You don&apos;t make your own decisions</li>
                <li>• You won&apos;t act on time-sensitive information</li>
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Good fit</p>
              <ul className="mt-2 space-y-1 text-xs text-gray-200">
                <li>• You already risk capital on prediction markets</li>
                <li>• You care about entry timing and visibility</li>
                <li>• You want signal speed, not hype</li>
                <li>• You prefer data alerts over emotional decisions</li>
              </ul>
            </div>
          </div>
          <p className="mt-3 text-sm text-white font-medium">Better information—not promises.</p>
          <SectionCta
            primaryPlan="pro"
            primaryLabel="Start Pro (risk-free)"
            secondaryPlan="elite"
            secondaryLabel="Go Elite (faster)"
          />
        </section>

        <section className="rounded-2xl border border-violet-300/30 bg-violet-400/10 p-5 md:p-6">
          <h2 className="text-xl md:text-2xl font-bold text-white">Why start at $29 Pro?</h2>
          <p className="mt-3 text-sm text-gray-200">
            Pro is a lean entry so you can validate whale alerts in live markets without a big upfront bet. When timing
            starts to matter every day, most traders step up to <span className="text-white font-medium">Elite ($59)</span>{' '}
            for faster delivery, filters, and priority routing.
          </p>
          <div className="mt-3 space-y-2 text-sm text-gray-200">
            <p>We keep the entry tier accessible on purpose—upgrade when signal speed pays for itself.</p>
            <p>New tiers (like Whale) open to waitlist first as infrastructure expands.</p>
          </div>
          <p className="mt-3 text-xs text-gray-400">Early-access public pricing; grandfathering may apply.</p>
          <SectionCta
            primaryPlan="pro"
            primaryLabel="Start Pro ($29)"
            secondaryPlan="elite"
            secondaryLabel="Choose Elite ($59)"
          />
        </section>

        <section className="rounded-2xl border border-amber-300/40 bg-amber-500/15 p-5 md:p-6 text-center">
          <h2 className="text-xl md:text-2xl font-bold text-white">Timing matters</h2>
          <div className="mt-3 space-y-1 text-sm text-gray-200">
            <p>Markets move 24/7.</p>
            <p>Whales don&apos;t wait.</p>
            <p>Opportunities don&apos;t repeat.</p>
          </div>
          <div className="mt-4 rounded-xl border border-amber-200/20 bg-black/30 p-4 text-left max-w-2xl mx-auto">
            <p className="text-xs text-amber-100">Every day you trade without early whale visibility:</p>
            <ul className="mt-2 space-y-1 text-xs text-gray-200">
              <li>• You enter after the first probability shift</li>
              <li>• You accept tighter entries and fewer options</li>
              <li>• You compete with traders who saw the move earlier</li>
            </ul>
          </div>
          <p className="mt-3 text-sm text-white font-semibold">Delay compounds. Early visibility does not.</p>
          <div className="mt-5">
            <Link
              href="/subscribe?plan=pro"
              className="inline-flex w-full sm:w-auto min-h-[48px] items-center justify-center rounded-xl bg-amber-300 px-7 py-3.5 text-sm font-extrabold text-zinc-950 hover:bg-amber-200 transition-colors active:scale-[0.98]"
            >
              Start Pro now
            </Link>
          </div>
        </section>

        <PolymarketAlertsClosingCta compact />
      </main>

      <Footer />
    </div>
  );
}
