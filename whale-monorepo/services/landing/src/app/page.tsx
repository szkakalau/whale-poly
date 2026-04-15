import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { loadLiveSignals } from '@/lib/live-signals';
import LiveSignalsFeed from '@/components/LiveSignalsFeedLazy';
import { unstable_cache } from 'next/cache';
import { Suspense } from 'react';

const TELEGRAM_BOT_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || "https://t.me/sightwhale_bot";
const TELEGRAM_DEEP_LINK_SUBSCRIBE = `${TELEGRAM_BOT_URL}?start=subscribe_pro`;

/** Raw SQL may return bigint as string, or Numeric as Decimal-like objects. */
function coerceBigIntish(value: unknown): number {
  try {
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
    const s = String(value ?? '0').trim();
    if (!s) return 0;
    return Number(BigInt(s));
  } catch {
    return 0;
  }
}

function coerceFloatMetric(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  const v = value as { toNumber?: () => number } | null;
  if (v != null && typeof v === 'object' && typeof v.toNumber === 'function') {
    const n = v.toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function formatCompactInt(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatUsdCompact(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${value < 0 ? '-' : ''}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${value < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${value < 0 ? '-' : ''}$${(abs / 1_000).toFixed(1)}K`;
  return `${value < 0 ? '-' : ''}$${abs.toFixed(0)}`;
}

type HomeStats = {
  trackedWhales: number;
  trackedVolumeUsd: number;
  totalUsers: number;
  telegramLinkedUsers: number;
  totalFollows: number;
  totalSmartSubscriptions: number;
  alertEvents30d: number;
};

const loadHomeStats = unstable_cache(
  async (): Promise<HomeStats> => {
    const now = Date.now();
    const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

    let totalUsers = 0;
    let telegramLinkedUsers = 0;
    try {
      const [allUsers, withTelegram] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { telegramId: { not: null } } }),
      ]);
      totalUsers = allUsers;
      telegramLinkedUsers = withTelegram;
    } catch {
      // users table missing or schema mismatch
    }

    let whale_count = 0;
    let total_volume = 0;
    try {
      const whaleAgg = await prisma.$queryRawUnsafe<
        { whale_count: unknown; total_volume: unknown }[]
      >(
        `
        SELECT
          COUNT(*)::bigint AS whale_count,
          COALESCE(SUM(total_volume)::double precision, 0) AS total_volume
        FROM whale_profiles
        `,
      );
      const whaleRow = whaleAgg[0] || { whale_count: 0, total_volume: 0 };
      whale_count = coerceBigIntish(whaleRow.whale_count);
      total_volume = coerceFloatMetric(whaleRow.total_volume);
    } catch {
      // whale_profiles missing or not in this DB
    }

    // Same pipeline DB often has whale_trades + trades_raw before whale_profiles is backfilled.
    if (whale_count === 0 && total_volume === 0) {
      try {
        const tradeAgg = await prisma.$queryRawUnsafe<
          { whale_count: unknown; total_volume: unknown }[]
        >(
          `
          SELECT
            COUNT(DISTINCT wt.wallet_address)::bigint AS whale_count,
            COALESCE(
              SUM((tr.amount::numeric * tr.price::numeric))::double precision,
              0
            ) AS total_volume
          FROM whale_trades wt
          INNER JOIN trades_raw tr ON tr.trade_id = wt.trade_id
          `,
        );
        const row = tradeAgg[0];
        if (row) {
          whale_count = coerceBigIntish(row.whale_count);
          total_volume = coerceFloatMetric(row.total_volume);
        }
      } catch {
        // whale_trades / trades_raw missing
      }
    }

    let follows = 0;
    let smartSubs = 0;
    let alertEvents = 0;
    try {
      [follows, smartSubs, alertEvents] = await Promise.all([
        prisma.whaleFollow.count(),
        prisma.smartCollectionSubscription.count(),
        prisma.alertEvent.count({ where: { occurredAt: { gte: since30d } } }),
      ]);
    } catch {
      // whale_follows / smart_collection_subscriptions / alert_events missing or schema mismatch
    }

    // Fallback: if alert_events is empty, use backend "alerts" table count (same DB)
    if (alertEvents === 0) {
      try {
        const alertsFallback = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT COUNT(*)::bigint AS n FROM alerts WHERE created_at >= $1`,
          since30d,
        );
        const n = alertsFallback[0]?.n;
        if (n != null) alertEvents = Number(n);
      } catch {
        // alerts table missing or different DB
      }
    }

    // Fallback: if no users with telegram_id, use backend "tg_users" count (same DB)
    if (telegramLinkedUsers === 0) {
      try {
        const tgFallback = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT COUNT(*)::bigint AS n FROM tg_users`,
        );
        const n = tgFallback[0]?.n;
        if (n != null) telegramLinkedUsers = Number(n);
      } catch {
        // tg_users table missing or different DB
      }
    }

    return {
      trackedWhales: whale_count,
      trackedVolumeUsd: total_volume,
      totalUsers,
      telegramLinkedUsers,
      totalFollows: follows,
      totalSmartSubscriptions: smartSubs,
      alertEvents30d: alertEvents,
    };
  },
  ['home-stats-v2'],
  { revalidate: 60 },
);

function HomeStatsHeroTrackingSkeleton() {
  return <>Tracking verifiable whale signals in real time</>;
}

async function HomeStatsHeroTracking() {
  const homeStats = await loadHomeStats();
  return Number.isFinite(homeStats.trackedVolumeUsd) && Number.isFinite(homeStats.trackedWhales) ? (
    <>
      Tracking <span className="font-black text-foreground px-0.5">{formatUsdCompact(homeStats.trackedVolumeUsd)}</span>{' '}
      across <span className="font-black text-foreground px-0.5">{formatCompactInt(homeStats.trackedWhales)}</span> whales
    </>
  ) : (
    <HomeStatsHeroTrackingSkeleton />
  );
}

function HomeStatsLiveCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
      <div className="rounded-xl sm:rounded-2xl border border-border bg-surface px-3 sm:px-4 py-3 min-h-[72px] sm:min-h-0 flex flex-col justify-center">
        <div className="text-[10px] sm:text-[11px] uppercase tracking-widest text-subtle font-black">Tracked Whales</div>
        <div className="text-base sm:text-lg font-black text-foreground mt-1 sm:mt-2">—</div>
      </div>
      <div className="rounded-xl sm:rounded-2xl border border-border bg-surface px-3 sm:px-4 py-3 min-h-[72px] sm:min-h-0 flex flex-col justify-center">
        <div className="text-[10px] sm:text-[11px] uppercase tracking-widest text-subtle font-black">Tracked Volume</div>
        <div className="text-base sm:text-lg font-black text-foreground mt-1 sm:mt-2">—</div>
      </div>
      <div className="rounded-xl sm:rounded-2xl border border-border bg-surface px-3 sm:px-4 py-3 min-h-[72px] sm:min-h-0 flex flex-col justify-center">
        <div className="text-[10px] sm:text-[11px] uppercase tracking-widest text-subtle font-black">Alerts (30D)</div>
        <div className="text-base sm:text-lg font-black text-foreground mt-1 sm:mt-2">New</div>
      </div>
    </div>
  );
}

async function HomeStatsLiveCards() {
  const homeStats = await loadHomeStats();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
      <div className="rounded-xl sm:rounded-2xl border border-border bg-surface px-3 sm:px-4 py-3 min-h-[72px] sm:min-h-0 flex flex-col justify-center">
        <div className="text-[10px] sm:text-[11px] uppercase tracking-widest text-subtle font-black">Tracked Whales</div>
        <div className="text-base sm:text-lg font-black text-foreground mt-1 sm:mt-2 min-w-0 truncate">
          {formatCompactInt(homeStats.trackedWhales)}
        </div>
      </div>
      <div className="rounded-xl sm:rounded-2xl border border-border bg-surface px-3 sm:px-4 py-3 min-h-[72px] sm:min-h-0 flex flex-col justify-center">
        <div className="text-[10px] sm:text-[11px] uppercase tracking-widest text-subtle font-black">Tracked Volume</div>
        <div className="text-base sm:text-lg font-black text-foreground mt-1 sm:mt-2 min-w-0 truncate">
          {formatUsdCompact(homeStats.trackedVolumeUsd)}
        </div>
      </div>
      <div className="rounded-xl sm:rounded-2xl border border-border bg-surface px-3 sm:px-4 py-3 min-h-[72px] sm:min-h-0 flex flex-col justify-center">
        <div className="text-[10px] sm:text-[11px] uppercase tracking-widest text-subtle font-black">Alerts (30D)</div>
        <div className="text-base sm:text-lg font-black text-foreground mt-1 sm:mt-2 min-w-0 truncate">
          {homeStats.alertEvents30d === 0 ? 'New' : formatCompactInt(homeStats.alertEvents30d)}
        </div>
      </div>
    </div>
  );
}

function HomeStatsResultsListSkeleton() {
  return (
    <div className="space-y-5 relative z-10">
      {[
        { label: 'Tracked Whales', value: '—', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'Tracked Volume', value: '—', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
        { label: 'Alerts (30D)', value: '—', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
      ].map((stat, i) => (
        <div key={i} className="flex justify-between items-center">
          <span className={`text-subtle text-[10px] font-black uppercase tracking-widest`}>{stat.label}</span>
          <div className="flex items-center gap-3">
            <span className={`${stat.color} font-black text-lg font-mono tracking-tighter`}>{stat.value}</span>
            <div className={`w-2 h-2 rounded-full ${stat.bg}`}></div>
          </div>
        </div>
      ))}
    </div>
  );
}

async function HomeStatsResultsList() {
  const homeStats = await loadHomeStats();
  return (
    <div className="space-y-5 relative z-10">
      {[
        { label: 'Tracked Whales', value: formatCompactInt(homeStats.trackedWhales), color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'Tracked Volume', value: formatUsdCompact(homeStats.trackedVolumeUsd), color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
        { label: 'Alerts (30D)', value: formatCompactInt(homeStats.alertEvents30d), color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
      ].map((stat, i) => (
        <div key={i} className="flex justify-between items-center">
          <span className="text-subtle text-[10px] font-black uppercase tracking-widest">{stat.label}</span>
          <div className="flex items-center gap-3">
            <span className={`${stat.color} font-black text-lg font-mono tracking-tighter`}>{stat.value}</span>
            <div className={`w-2 h-2 rounded-full ${stat.bg}`}></div>
          </div>
        </div>
      ))}
    </div>
  );
}

type HomeQuickStartStep = {
  title: string;
  description: string;
  valuePoints: string[];
  href: string;
  cta: string;
  done: boolean;
};

function HomeQuickStartSectionSkeleton() {
  const steps: HomeQuickStartStep[] = [
    {
      title: 'Follow a whale to unlock alerts',
      description: 'Get conviction-backed wallet tracking and unlock each signal in full context.',
      valuePoints: ['Track the wallets that move markets', 'Get conviction-backed trade signals', 'Filter by size and Whale Score'],
      done: false,
      href: '/smart-money',
      cta: 'Follow',
    },
    {
      title: 'Upgrade to Pro for Faster Alerts',
      description: 'Pro unlocks faster, more frequent alert delivery to your Telegram bot right after activation.',
      valuePoints: ['Receive alerts more frequently with Pro', 'Near-zero alert delay', 'Delivery starts automatically after activation'],
      done: false,
      href: '/subscribe?plan=pro',
      cta: 'Upgrade to Pro',
    },
    {
      title: 'Connect Telegram to receive delivery',
      description: 'Get real-time alerts delivered through the bot so you never miss key moves.',
      valuePoints: ['Instant Telegram delivery', 'Faster than headlines', 'One-tap access to wallet context'],
      done: false,
      href: TELEGRAM_DEEP_LINK_SUBSCRIBE,
      cta: 'Connect',
    },
  ];

  const completedCount = 0;
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-16 sm:mb-24">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-6 sm:mb-8">
        <div>
          <p className="text-[11px] font-bold text-cyan-400 tracking-[0.35em] uppercase mb-4">Quick Start</p>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground tracking-tight mb-3 leading-[1.15]">
            Complete 3 steps to receive your first smart-money alert
          </h2>
          <p className="text-sm text-muted max-w-2xl">
            Follow whales, subscribe to collections, and connect Telegram for the shortest loop from discovery to delivery.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface px-4 sm:px-5 py-4 w-full md:w-auto">
          <div className="flex items-center justify-between gap-4 sm:gap-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-subtle">Progress</p>
              <div className="text-xl sm:text-2xl font-semibold text-foreground mt-2">
                {completedCount} / {steps.length}
              </div>
            </div>
            <div className="min-w-0 flex-1 max-w-[10rem] sm:max-w-none sm:w-40">
              <div className="h-2 w-full bg-surface rounded-full overflow-hidden ring-1 ring-border">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-violet-500"
                  style={{ width: `${(completedCount / steps.length) * 100}%` }}
                />
              </div>
              <div className="text-[10px] text-subtle mt-2">Not signed in.</div>
            </div>
          </div>
          <div className="text-xs text-subtle mt-3">
            Explore the steps below. Connect Telegram to start receiving alerts.
          </div>
          <div className="text-[11px] text-violet-200/70 mt-2">Pro & Elite: faster, more frequent Telegram delivery right after activation.</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((step) => (
          <div
            key={step.title}
            className="rounded-2xl border border-border bg-surface p-4 sm:p-5 flex flex-col justify-between gap-4 relative group hover:bg-surface-hover transition-colors"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                    step.done
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                      : 'border-border bg-surface text-muted'
                  }`}
                >
                  {step.done ? 'Completed' : 'Pending'}
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">{step.description}</p>
              <div className="absolute left-5 right-5 top-[4.25rem] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="rounded-xl border border-border bg-surface backdrop-blur px-3 py-2 text-[11px] text-muted">
                  <div className="text-[10px] uppercase tracking-widest text-subtle font-black mb-1">Why it matters</div>
                  <ul className="space-y-1">
                    {step.valuePoints.map((p) => (
                      <li key={p} className="flex items-start gap-2">
                        <span className="mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-violet-400" />
                        <span className="leading-snug">{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            {step.href.startsWith('http') ? (
              <a
                href={step.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 min-h-[44px] text-xs font-semibold text-foreground hover:bg-surface-hover"
              >
                {step.cta}
                <span className="text-[10px] text-muted">External</span>
              </a>
            ) : (
              <Link
                href={step.href}
                className="inline-flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 min-h-[44px] text-xs font-semibold text-foreground hover:bg-surface-hover"
              >
                {step.cta}
                <span className="text-[10px] text-muted">Go</span>
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

async function HomeQuickStartSection() {
  const user = await getCurrentUser();

  let followCount = 0;
  let telegramConnected = false;
  let proActivated = false;

  if (user) {
    followCount = await prisma.whaleFollow.count({ where: { userId: user.id } });
    telegramConnected = Boolean(user.telegramId);
    proActivated =
      user.plan === 'PRO' &&
      (!user.planExpireAt || !(new Date() > user.planExpireAt));
  }

  const steps: HomeQuickStartStep[] = [
    {
      title: 'Follow a whale to unlock alerts',
      description: 'Get conviction-backed wallet tracking and unlock each signal in full context.',
      valuePoints: ['Track the wallets that move markets', 'Get conviction-backed trade signals', 'Filter by size and Whale Score'],
      done: followCount > 0,
      href: '/smart-money',
      cta: 'Follow',
    },
    {
      title: 'Upgrade to Pro for Faster Alerts',
      description: 'Pro unlocks faster, more frequent alert delivery to your Telegram bot right after activation.',
      valuePoints: ['Receive alerts more frequently with Pro', 'Near-zero alert delay', 'Delivery starts automatically after activation'],
      done: proActivated,
      href: '/subscribe?plan=pro',
      cta: 'Upgrade to Pro',
    },
    {
      title: 'Connect Telegram to receive delivery',
      description: 'Get real-time alerts delivered through the bot so you never miss key moves.',
      valuePoints: ['Instant Telegram delivery', 'Faster than headlines', 'One-tap access to wallet context'],
      done: telegramConnected,
      href: TELEGRAM_DEEP_LINK_SUBSCRIBE,
      cta: 'Connect',
    },
  ];

  const completedCount = steps.filter((step) => step.done).length;

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-16 sm:mb-24">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-6 sm:mb-8">
        <div>
          <p className="text-[11px] font-bold text-cyan-400 tracking-[0.35em] uppercase mb-4">Quick Start</p>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground tracking-tight mb-3 leading-[1.15]">
            Complete 3 steps to receive your first smart-money alert
          </h2>
          <p className="text-sm text-muted max-w-2xl">
            Follow whales, subscribe to collections, and connect Telegram for the shortest loop from discovery to delivery.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface px-4 sm:px-5 py-4 w-full md:w-auto">
          <div className="flex items-center justify-between gap-4 sm:gap-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-subtle">Progress</p>
              <div className="text-xl sm:text-2xl font-semibold text-foreground mt-2">
                {completedCount} / {steps.length}
              </div>
            </div>
            <div className="min-w-0 flex-1 max-w-[10rem] sm:max-w-none sm:w-40">
              <div className="h-2 w-full bg-surface rounded-full overflow-hidden ring-1 ring-border">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-violet-500"
                  style={{ width: `${(completedCount / steps.length) * 100}%` }}
                />
              </div>
              <div className="text-[10px] text-subtle mt-2">{user ? 'Saved to your account.' : 'Not signed in.'}</div>
            </div>
          </div>
          <div className="text-xs text-subtle mt-3">
            {user ? 'Your progress is tracked automatically.' : 'Explore the steps below. Connect Telegram to start receiving alerts.'}
          </div>
          <div className="text-[11px] text-violet-200/70 mt-2">Pro & Elite: faster, more frequent Telegram delivery right after activation.</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((step) => (
          <div
            key={step.title}
            className="rounded-2xl border border-border bg-surface p-4 sm:p-5 flex flex-col justify-between gap-4 relative group hover:bg-surface-hover transition-colors"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                    step.done
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                      : 'border-border bg-surface text-muted'
                  }`}
                >
                  {step.done ? 'Completed' : 'Pending'}
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">{step.description}</p>
              <div className="absolute left-5 right-5 top-[4.25rem] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="rounded-xl border border-border bg-surface backdrop-blur px-3 py-2 text-[11px] text-muted">
                  <div className="text-[10px] uppercase tracking-widest text-subtle font-black mb-1">Why it matters</div>
                  <ul className="space-y-1">
                    {step.valuePoints.map((p) => (
                      <li key={p} className="flex items-start gap-2">
                        <span className="mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-violet-400" />
                        <span className="leading-snug">{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            {step.href.startsWith('http') ? (
              <a
                href={step.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 min-h-[44px] text-xs font-semibold text-foreground hover:bg-surface-hover"
              >
                {step.cta}
                <span className="text-[10px] text-muted">External</span>
              </a>
            ) : (
              <Link
                href={step.href}
                className="inline-flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 min-h-[44px] text-xs font-semibold text-foreground hover:bg-surface-hover"
              >
                {step.cta}
                <span className="text-[10px] text-muted">Go</span>
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  // Keep first HTML fast: personalization (Quick Start progress) streams later.
  return (
    <div className="min-h-screen text-foreground selection:bg-[#5B8CFF]/25 overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 z-[-1] bg-background" />

      {/* Navigation */}
      <Header />

      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "SightWhale.com",
            "operatingSystem": "Web, Telegram",
            "applicationCategory": "FinanceApplication",
            "description": "Stop guessing. Follow the top 1% of profitable whales on Polymarket. Real-time Telegram alerts for high-conviction bets on Elections, Sports, and Crypto.",
            "offers": {
              "@type": "AggregateOffer",
              "lowPrice": "0",
              "highPrice": "590",
              "priceCurrency": "USD"
            }
          })
        }}
      />

      <main className="relative pt-14 sm:pt-20 pb-8 sm:pb-12">

        {/* HERO SECTION */}
        <section className="relative px-4 sm:px-6 max-w-7xl mx-auto text-center mb-20 sm:mb-24 md:mb-32 pt-6 sm:pt-12">
              <div>
                <div className="inline-flex max-w-full items-center justify-center gap-2.5 px-3 sm:px-4 py-2 rounded-full glass mb-8 sm:mb-12 border border-border text-muted text-[11px] md:text-sm hover:border-accent/45 transition-all cursor-default group relative overflow-hidden bg-surface/85 flex-wrap">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <span className="tracking-[0.05em] min-w-0 text-balance">
                <Suspense fallback={<HomeStatsHeroTrackingSkeleton />}>
                  <HomeStatsHeroTracking />
                </Suspense>
              </span>
              <svg className="w-3 h-3 text-subtle group-hover:text-accent-hover transition-colors ml-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter mb-6 sm:mb-8 leading-[1.1] sm:leading-[1.05]">
            Follow the <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400 relative inline-block">
              Whale Score™
              <span className="absolute -inset-x-4 -inset-y-2 blur-[16px] bg-sky-500/10 -z-10"></span>
            </span>. <br />
            Frontrun the <span className="text-foreground">Market</span>.
          </h1>
          
          <p className="mt-6 sm:mt-8 max-w-2xl mx-auto text-sm sm:text-base md:text-xl text-muted leading-relaxed font-light tracking-wide px-1">
            The first AI-driven intelligence layer for Polymarket. We filter millions in noise into <span className="text-foreground font-medium relative group cursor-help">
              high-conviction signals
              <span className="absolute -bottom-1 left-0 w-full h-[1px] bg-accent/45 group-hover:bg-accent group-hover:h-[1px] transition-all"></span>
            </span> using the proprietary Whale Score™.
          </p>

          <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 sm:gap-6 w-full max-w-sm sm:max-w-none mx-auto">
            <a href={TELEGRAM_DEEP_LINK_SUBSCRIBE} target="_blank" rel="noopener noreferrer" className="relative group px-6 sm:px-8 py-3.5 sm:py-4 min-h-[48px] bg-white text-black font-black rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-r from-[#E8EFFF] to-white opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative z-10 flex items-center gap-2">
                Launch Telegram Bot
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7-7 7" /></svg>
              </span>
            </a>
            <Link href="#live-signals" className="group px-6 sm:px-8 py-3.5 sm:py-4 min-h-[48px] glass border border-border text-foreground font-bold rounded-2xl hover:bg-surface transition-all flex items-center justify-center gap-3">
              View Live Signals
              <div className="w-1.5 h-1.5 rounded-full bg-accent group-hover:scale-[1.5] transition-all"></div>
            </Link>
          </div>

          <div className="mt-6 sm:mt-10 flex flex-wrap justify-center gap-2 sm:gap-3">
            <Link href="/backtesting" className="group flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl bg-surface border border-border hover:bg-surface-hover hover:border-violet-500/30 transition-all duration-300">
              <div className="p-1.5 rounded-lg bg-violet-500/20 text-violet-300 group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <div className="text-left">
                <div className="text-[11px] text-muted font-medium uppercase tracking-wider">Performance</div>
                <div className="text-xs text-foreground font-semibold group-hover:text-foreground">Backtesting Results</div>
              </div>
            </Link>

            <Link href="/conviction" className="group flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl bg-surface border border-border hover:bg-surface-hover hover:border-cyan-500/30 transition-all duration-300">
              <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div className="text-left">
                <div className="text-[11px] text-muted font-medium uppercase tracking-wider">Deep Dive</div>
                <div className="text-xs text-foreground font-semibold group-hover:text-foreground">Conviction Cases</div>
              </div>
            </Link>

            <Link href="/polymarket-alerts-tl" className="group flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl bg-surface border border-border hover:bg-surface-hover hover:border-emerald-500/30 transition-all duration-300">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h18M3 12h18M3 19h18" /></svg>
              </div>
              <div className="text-left">
                <div className="text-[11px] text-muted font-medium uppercase tracking-wider">Offer</div>
                <div className="text-xs text-foreground font-semibold group-hover:text-foreground">$29 Alerts Page</div>
              </div>
            </Link>
          </div>
        </section>

        <section id="live-signals" className="max-w-6xl mx-auto px-4 sm:px-6 mb-16 sm:mb-24">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 sm:gap-8 mb-8 sm:mb-10">
            <div>
              <p className="text-[11px] font-bold text-emerald-400 tracking-[0.35em] uppercase mb-4">
                Real-Time
              </p>
              <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight mb-3">
                Recent whale signals, anonymized
              </h2>
              <p className="text-sm text-muted max-w-2xl">
                This feed is generated from tracked wallets and updates continuously. Click any item to see the full wallet context.
              </p>
            </div>
            <div className="w-full lg:w-auto lg:max-w-[28rem] shrink-0">
              <Suspense fallback={<HomeStatsLiveCardsSkeleton />}>
                <HomeStatsLiveCards />
              </Suspense>
            </div>
          </div>

          <Suspense
            fallback={
              // Keep the section structure stable; client component will show skeleton UI.
              <div />
            }
          >
            <HomeLiveSignals />
          </Suspense>
          <div className="mt-3 text-[11px] text-subtle">
            Data refreshes automatically. Sizes shown in USD. Wallets are masked for privacy.
          </div>
        </section>

        <Suspense fallback={<HomeQuickStartSectionSkeleton />}>
          <HomeQuickStartSection />
        </Suspense>

        {/* ONBOARDING - 3 STEPS */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-20 sm:mb-32">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-[11px] font-bold text-violet-400 tracking-[0.4em] uppercase mb-6 opacity-80">
              The Protocol
            </h2>
            <p className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-black text-foreground tracking-tight leading-tight">
              Institutional grade data. <br />
              <span className="text-subtle/80">Consumer simple access.</span>
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
            {[
              { step: 1, title: "Activate", color: "violet", desc: <>Link Telegram so delivery starts after activation via <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline decoration-violet-500/30 underline-offset-4 font-bold">@sightwhale_bot</a>. Pro/Elite users get priority delivery rules.</> },
              { step: 2, title: "Quantify Conviction", color: "cyan", desc: <>Whale Score ranks high-conviction bets and filters noise—so only the trades worth acting on are eligible for delivery.</> },
              { step: 3, title: "Shadow", color: "emerald", desc: <>Mirror every move with precision. Use <span className="font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">/follow</span> alerts, with Pro/Elite delivering faster and more frequently after activation.</> }
            ].map((item, i) => (
              <div key={i} className={`glass rounded-2xl sm:rounded-[2rem] border border-border-muted p-5 sm:p-8 flex flex-col gap-6 sm:gap-8 hover:border-${item.color}-500/40 hover:bg-${item.color}-500/[0.03] transition-all duration-700 group relative overflow-hidden`}>
                <div className={`absolute top-0 right-0 w-32 h-32 bg-${item.color}-500/10 rounded-full blur-[60px] -mr-16 -mt-16 group-hover:bg-${item.color}-500/20 transition-all duration-1000`}></div>
                <div className="flex items-center justify-between relative z-10">
                  <div className={`w-12 h-12 rounded-2xl bg-${item.color}-500/20 text-${item.color}-300 flex items-center justify-center font-black text-xl group-hover:scale-110 group-hover:bg-${item.color}-500 group-hover:text-foreground transition-all duration-700`}>
                    {item.step}
                  </div>
                  <div className={`text-[11px] font-black text-${item.color}-400/40 uppercase tracking-[0.3em]`}>Step {item.step === 1 ? 'One' : item.step === 2 ? 'Two' : 'Three'}</div>
                </div>
                <div className="space-y-4 relative z-10">
                  <h3 className="text-xl font-black text-foreground tracking-tight">{item.title}</h3>
                  <p className="text-muted leading-relaxed text-sm font-light">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SOCIAL PROOF */}
        <section className="border-y border-border-muted bg-surface/45 py-10 sm:py-16 mb-16 sm:mb-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/[0.02] via-transparent to-cyan-500/[0.02]"></div>
          <div className="max-w-6xl mx-auto px-6 relative z-10">
            <blockquote className="text-xl sm:text-2xl md:text-3xl font-black text-center text-foreground tracking-tight mb-8 sm:mb-12 leading-[1.2] px-2">
              “We don’t predict outcomes. <br className="hidden md:block" />We <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">track capital flow</span>.”
            </blockquote>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { icon: "⚡️", title: "Real-Time Data", desc: "Direct feeds from on-chain clusters & exchange orderbooks." },
                { icon: "🛡", title: "Zero Noise", desc: "No anonymous tips, no hype calls, no black-box indicators." },
                { icon: "✅", title: "100% Verifiable", desc: "Every signal includes direct links to transaction evidence." }
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center text-center gap-3 group">
                  <div className="text-4xl mb-1 group-hover:scale-110 transition-transform duration-500">{item.icon}</div>
                  <h3 className="text-lg font-bold text-foreground tracking-tight">{item.title}</h3>
                  <p className="text-muted font-light leading-relaxed text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-16 sm:mb-24">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8 sm:mb-10">
            <div>
              <p className="text-[10px] font-bold text-violet-400 tracking-[0.35em] uppercase mb-4">
                Analysis & Research
              </p>
              <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight mb-3">
                Proof you can click into
              </h2>
              <p className="text-sm text-muted max-w-2xl">
                We publish the framework behind the product so you can verify signals, not just consume them.
              </p>
            </div>
            <Link
              href="/blog/research"
              className="inline-flex items-center rounded-2xl border border-border bg-surface px-5 py-3 text-xs font-bold text-foreground hover:bg-surface-hover"
            >
              Browse Research
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: 'Signal Half-Life',
                desc: 'How quickly whale information decays, and when you become exit liquidity.',
                href: '/blog/signal-half-life-whale-trading-validity',
                tag: 'Timing',
              },
              {
                title: 'CLOB Microstructure',
                desc: 'Spot real buying pressure vs fake liquidity walls in the order book.',
                href: '/blog/clob-microstructure-real-buying-vs-fake-walls',
                tag: 'Execution',
              },
              {
                title: 'Portfolio Lens',
                desc: 'Build cross-market hedge baskets instead of single-market bets.',
                href: '/blog/polymarket-portfolio-hedging-arbitrage-baskets',
                tag: 'Risk',
              },
            ].map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="rounded-2xl border border-border bg-surface p-6 hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-black tracking-[0.25em] uppercase text-subtle">{card.tag}</div>
                  <div className="text-[10px] text-violet-200/80 border border-violet-500/20 bg-violet-500/10 rounded-full px-2 py-0.5">
                    Read
                  </div>
                </div>
                <div className="mt-4 text-lg font-black text-foreground tracking-tight">{card.title}</div>
                <div className="mt-2 text-sm text-muted leading-relaxed">{card.desc}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* THE PROBLEM & SOLUTION GRID */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-16 sm:mb-24">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
            <div className="space-y-8">
              <div>
                <h2 className="text-[11px] font-bold text-red-400 tracking-[0.4em] uppercase mb-5">The Market Problem</h2>
                <h3 className="text-lg sm:text-xl md:text-3xl font-black tracking-tight text-foreground leading-[1.1]">
                  Prediction markets are <br />
                  <span className="text-subtle italic">distorted by noise.</span>
                </h3>
              </div>
              
              <div className="space-y-5">
                {[
                  "Headlines move faster than verified facts",
                  "Retail sentiment is loud, emotional, and lagging",
                  "The house always wins because they have better data"
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 group">
                    <div className="mt-2 w-1.5 h-1.5 rounded-full bg-red-500/40 border border-red-500/60 group-hover:bg-red-500 transition-all"></div>
                    <span className="text-base text-muted group-hover:text-foreground transition-colors font-light">{item}</span>
                  </div>
                ))}
              </div>
              
              <div className="glass p-7 rounded-[1.5rem] border-l-4 border-l-violet-500 bg-violet-500/[0.02]">
                <p className="text-base text-muted font-light leading-relaxed">
                  While the crowd follows the news, <strong className="text-foreground font-bold tracking-tight">smart money</strong> acts quietly — early, with size, and with verifiable conviction.
                </p>
              </div>
            </div>

            <div className="glass rounded-2xl sm:rounded-[2.5rem] p-6 sm:p-8 md:p-10 relative overflow-hidden group border-border-muted hover:border-cyan-500/30 transition-all duration-700 bg-surface/45">
              <div className="absolute -top-20 -right-20 w-[250px] h-[250px] bg-cyan-500/10 rounded-full blur-[70px] group-hover:bg-cyan-500/20 transition-all duration-1000"></div>
              
              <div className="relative z-10">
                <h2 className="text-[11px] font-bold text-cyan-400 tracking-[0.4em] uppercase mb-5">The Solution</h2>
                <h3 className="text-lg sm:text-xl md:text-3xl font-black text-foreground mb-6 tracking-tight leading-tight">We surface the <br /><span className="text-gradient-accent">Unfair Advantage</span>.</h3>
                
                <ul className="grid gap-3 mb-8">
                  {[
                    "Large trades that shift liquidity",
                    "Wallets with proven Whale Score 70+",
                    "Repeated accumulation clusters",
                    "Capital flows before market breakouts"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-foreground bg-surface-hover/75 p-3.5 rounded-xl border border-border-muted group/item hover:bg-surface-hover transition-all">
                      <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover/item:scale-110 group-hover/item:bg-cyan-500 group-hover/item:text-foreground transition-all duration-500">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                      </div>
                      <span className="text-sm font-medium tracking-tight">{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-subtle border-t border-border-muted pt-6 leading-relaxed font-light">
                  Transparency on <span className="text-foreground font-bold">who</span> is betting, <span className="text-foreground font-bold text-glow">how much</span>, and with what level of conviction.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES BENTO GRID */}
        <section id="sample-signals" className="max-w-7xl mx-auto px-4 sm:px-6 mb-20 sm:mb-32">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="section-title tracking-[0.2em] opacity-80 mb-4">Intelligence Platform</h2>
            <p className="text-base sm:text-xl text-muted max-w-3xl mx-auto leading-relaxed font-light px-1">
              We monitor millions of data points to surface the only ones that matter.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4 sm:gap-8 auto-rows-[minmax(280px,auto)]">
            
            {/* Feature 1: Alerts (Large Card) */}
            <div className="card md:col-span-2 md:row-span-2 relative overflow-hidden p-5 sm:p-8 md:p-10 flex flex-col justify-between border-border-muted bg-surface/45">
              <div className="relative z-10">
                <div className="flex items-center gap-5 mb-6">
                  <div className="w-14 h-14 bg-violet-500/15 rounded-2xl flex items-center justify-center text-3xl border border-violet-500/20">🐋</div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tight text-foreground mb-1">Whale Score Filter</h3>
                    <div className="text-violet-400 font-bold text-[10px] uppercase tracking-[0.3em]">Kill the Noise. Only Follow the 70+.</div>
                  </div>
                </div>
                <p className="text-muted text-base mb-8 max-w-xl leading-relaxed font-light">
                  Stop chasing every $10k bet. Our scoring system (0-100) separates &quot;Dumb Large Money&quot; from the elite 1% who actually move the needle.
                </p>
                
                <div className="bg-background border border-border rounded-2xl p-6 font-mono text-sm leading-relaxed relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-violet-500 via-indigo-500 to-cyan-500"></div>
                  
                  <div className="flex justify-between text-[8px] text-subtle mb-3.5 border-b border-border-muted pb-2.5">
                    <span className="flex items-center gap-2 font-black tracking-[0.2em] text-violet-400"><span className="w-1 h-1 rounded-full bg-red-500"></span> LIVE SIGNAL</span>
                    <span className="font-bold tracking-widest opacity-50 font-sans uppercase">Processing...</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2.5 relative z-10">
                    <span className="text-subtle font-bold uppercase text-[8px] tracking-widest">Market</span>
                    <span className="text-foreground font-black truncate text-xs">US Election – Trump Wins</span>
                    
                    <span className="text-subtle font-bold uppercase text-[8px] tracking-widest">Outcome</span>
                    <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md w-fit font-black text-[9px] ring-1 ring-emerald-400/20">YES</span>
                    
                    <span className="text-subtle font-bold uppercase text-[8px] tracking-widest">Action</span>
                    <span className="text-emerald-400 font-black tracking-tighter text-sm">AGGRESSIVE BUY</span>
                    
                    <span className="text-subtle font-bold uppercase text-[8px] tracking-widest">Size</span>
                    <span className="text-foreground font-black text-sm">$182,400.00</span>
                    
                    <span className="text-subtle font-bold uppercase text-[8px] tracking-widest">Whale Score</span>
                    <div className="flex items-center gap-3">
                      <span className="text-violet-400 font-black text-xs">84</span>
                      <div className="h-1 w-16 bg-gray-900 rounded-full overflow-hidden ring-1 ring-border-muted">
                      <div className="h-full w-[84%] bg-gradient-to-r from-violet-600 to-violet-400"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 2: Smart Collections */}
            <div className="card relative overflow-hidden p-8 flex flex-col justify-between border-border-muted bg-surface/45">
              <div className="relative z-10">
                <div className="w-14 h-14 bg-cyan-500/15 rounded-2xl flex items-center justify-center text-3xl mb-6 border border-cyan-500/20">💎</div>
                <h3 className="text-xl font-black text-foreground mb-3 tracking-tight">Smart Collections</h3>
                <p className="text-muted text-sm leading-relaxed font-light">
                  Automated grouping of whales by strategy, win rate, and market bias.
                </p>
              </div>
              <div className="mt-8 space-y-3 relative z-10">
                <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                  <div className="h-full w-[65%] bg-gradient-to-r from-cyan-600 to-cyan-400"></div>
                </div>
                <div className="flex justify-between text-[10px] font-black text-subtle uppercase tracking-widest">
                  <span>Clustering Data</span>
                  <span className="text-cyan-400">Active</span>
                </div>
              </div>
            </div>

            {/* Feature 3: Alpha Tracking */}
            <div className="card relative overflow-hidden p-8 flex flex-col justify-between border-border-muted bg-surface/45">
              <div className="relative z-10">
                <div className="w-14 h-14 bg-emerald-500/15 rounded-2xl flex items-center justify-center text-3xl mb-6 border border-emerald-500/20">🚀</div>
                <h3 className="text-xl font-black text-foreground mb-3 tracking-tight">Alpha Tracking</h3>
                <p className="text-muted text-sm leading-relaxed font-light">
                  Discover hidden wallets before they hit the leaderboard rankings.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-2 relative z-10">
                <div className="flex -space-x-3">
                  {[1,2,3].map(i => <div key={i} className="w-9 h-9 rounded-full border-2 border-background bg-gray-800 flex items-center justify-center text-[10px] font-bold text-muted">W{i}</div>)}
                </div>
                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter ml-2">+42 New Whales</div>
              </div>
            </div>

            {/* Feature 4: Conviction */}
            <div className="card border-violet-500/20 p-8 flex flex-col md:col-span-2 relative overflow-hidden bg-surface/45">
              <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔥</span>
                  <h3 className="text-xl font-black text-foreground tracking-tight">Conviction</h3>
                </div>
                <div className="px-3 py-1 rounded-full text-[10px] bg-violet-500 text-foreground font-black tracking-[0.2em]">ELITE</div>
              </div>
              
              <ul className="grid md:grid-cols-2 gap-x-10 gap-y-5 text-sm text-muted mb-10 relative z-10">
                {[
                  "Multiple smart money addresses align",
                  "Capital size is significant",
                  "Positions are held over time",
                  "Historically accurate whale entry"
                ].map((item, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="text-violet-400 font-black font-mono">0{i+1}</span>
                    <span className="text-muted font-light">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex items-center justify-between border-t border-border-muted pt-6 relative z-10">
                <p className="text-[11px] text-violet-200/50 font-medium">Reflecting <strong className="text-violet-400 font-black tracking-wide">strong belief</strong>, not just speculation.</p>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(i => <div key={i} className="w-1 h-3 rounded-full bg-violet-500/20"></div>)}
                </div>
              </div>
            </div>

            {/* Feature 5: Results */}
            <div className="card border-indigo-500/20 p-8 flex flex-col relative overflow-hidden bg-surface/45">
              <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📈</span>
                  <h3 className="text-xl font-black text-foreground tracking-tight">Results</h3>
                </div>
                <div className="px-3 py-1 rounded-full text-[10px] bg-indigo-500 text-foreground font-black tracking-[0.2em]">STATS</div>
              </div>
              
              <Suspense fallback={<HomeStatsResultsListSkeleton />}>
                <HomeStatsResultsList />
              </Suspense>
              <div className="mt-6 relative z-10">
                <Link
                  href="/backtesting"
                  className="inline-flex items-center justify-center w-full rounded-xl border border-border bg-surface px-4 py-2 text-xs font-bold text-foreground hover:bg-surface-hover transition-colors"
                >
                  Verify in Backtesting
                </Link>
              </div>
              <p className="mt-auto text-[10px] text-subtle font-medium italic pt-6 border-t border-border-muted relative z-10">
                Derived from internal tracked data, refreshed automatically.
              </p>
            </div>

            {/* Feature 6: Heatmap (Wide) */}
            <div className="card md:col-span-3 p-10 md:p-12 bg-surface/45 relative overflow-hidden border-border-muted">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12 relative z-10">
                <div>
                  <h3 className="text-3xl font-black flex items-center gap-4 text-foreground tracking-tight">
                    <span className="text-4xl">📊</span> Market Heatmap
                  </h3>
                  <p className="text-muted text-lg mt-2 font-light">Perfect for research and market discovery.</p>
                </div>
                <div className="flex gap-3">
                  {['Volume', 'Flow', 'Trend'].map((tag) => (
                    <span key={tag} className="px-5 py-2 rounded-xl bg-surface text-[11px] font-black text-subtle border border-border-muted cursor-default uppercase tracking-widest">{tag}</span>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative z-10">
                {[
                  { label: "Volume Ratio", value: "Whale vs Total", color: "text-cyan-400" },
                  { label: "Flow", value: "Net Inflow", color: "text-emerald-400" },
                  { label: "Trend", value: "Momentum", color: "text-violet-400" }
                ].map((stat, i) => (
                  <div key={i} className="p-8 bg-surface/85 rounded-[2rem] border border-border-muted">
                    <div className="text-[10px] text-subtle mb-4 uppercase tracking-[0.3em] font-black">{stat.label}</div>
                    <div className={`${stat.color} font-mono text-xl font-black`}>{stat.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-10 relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-sm text-muted font-light">
                  Research the flows, then act with the Whale Score filter.
                </div>
                <Link
                  href="/smart-money"
                  className="inline-flex items-center justify-center rounded-2xl bg-surface border border-border px-6 py-3 text-xs font-bold text-foreground hover:bg-surface-hover transition-colors"
                >
                  Explore Smart Money
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-20 sm:mb-32 relative">
          <div className="text-center mb-12 sm:mb-20">
            <h2 className="text-[11px] font-black text-violet-400 tracking-[0.5em] uppercase mb-6 opacity-80">
              The Engine
            </h2>
            <p className="text-2xl sm:text-3xl md:text-5xl font-black text-foreground tracking-tight mb-6">How It Works</p>
            <p className="text-sm sm:text-base text-muted max-w-2xl mx-auto font-light px-1">
              After activation, Pro and Elite users receive faster, more frequent Telegram delivery—with cooldowns that prevent spam.
            </p>
            <div className="w-24 h-1 bg-gradient-to-r from-violet-500 to-cyan-500 mx-auto rounded-full"></div>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8 relative">
            {/* Connecting Line - Pro Max: Dynamic gradient line */}
            <div className="hidden lg:block absolute top-[40%] left-0 w-full h-[1px] bg-[linear-gradient(to_right,transparent,rgba(139,92,246,0.2),rgba(34,211,238,0.2),transparent)]"></div>
            
            {[
              { title: "Ingest", desc: "Real-time trade & orderbook data", icon: "📡" },
              { title: "Analyze", desc: "Identify abnormal capital movements", icon: "🧠" },
              { title: "Score", desc: "Whale Score: conviction, timing & impact", icon: "🎯" },
              { title: "Deliver", desc: "Telegram delivery. Pro/Elite faster after activation.", icon: "📬" }
            ].map((step, i) => (
              <div key={i} className="relative group">
                <div className="glass rounded-2xl sm:rounded-[2.5rem] p-6 sm:p-10 h-full border-border-muted hover:border-violet-500/40 hover:bg-violet-500/[0.02] transition-all duration-700 flex flex-col items-center text-center group-hover:translate-y-[-8px] shadow-2xl">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-violet-500/15 text-violet-400 flex items-center justify-center text-2xl font-black mb-8 group-hover:bg-violet-500 group-hover:text-foreground transition-all duration-700 shadow-[0_0_30px_rgba(139,92,246,0.2)] group-hover:shadow-[0_0_40px_rgba(139,92,246,0.4)] group-hover:rotate-6">
                    {i + 1}
                  </div>
                  <div className="text-3xl mb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-700">{step.icon}</div>
                  <h4 className="font-black text-2xl mb-4 text-foreground tracking-tight">{step.title}</h4>
                  <p className="text-muted leading-relaxed text-sm font-light">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* COMPARISON */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-20 sm:mb-32">
          <div className="glass rounded-2xl sm:rounded-[3rem] overflow-hidden p-6 sm:p-12 md:p-20 relative bg-surface/45 border-border-muted shadow-[0_0_100px_rgba(0,0,0,0.5)]">
            {/* Pro Max: Animated top border */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"></div>
            
            <div className="text-center mb-16">
              <h2 className="text-2xl md:text-4xl font-black tracking-tight text-foreground mb-4">Why We’re Different</h2>
              <p className="text-subtle text-lg font-light">The transparency advantage in a black-box market.</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 sm:gap-12 lg:gap-20 items-stretch">
              <div className="space-y-8 sm:space-y-10 p-6 sm:p-10 rounded-2xl sm:rounded-[2.5rem] bg-surface/45 border border-border-muted hover:border-border transition-colors">
                <p className="text-subtle font-black uppercase tracking-[0.4em] text-[11px]">What you don’t get</p>
                <ul className="space-y-8">
                  {[
                    "Delayed delivery after activation",
                    "Noise-driven alerts with weak conviction",
                    "Opaque scoring and no Whale Score filter",
                    "Limited on-chain evidence & unverifiable claims",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-5 text-subtle line-through text-lg font-medium opacity-50 group">
                      <div className="w-6 h-6 rounded-full bg-gray-900 border border-border-muted flex items-center justify-center text-[10px] group-hover:border-red-500/30 transition-colors">✕</div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="relative p-6 sm:p-10 rounded-2xl sm:rounded-[2.5rem] bg-violet-600/[0.02] border border-violet-500/20 shadow-[0_0_50px_rgba(139,92,246,0.05)] overflow-hidden group">
                <div className="absolute inset-0 bg-violet-500/[0.02] blur-3xl group-hover:bg-violet-500/[0.05] transition-colors duration-1000"></div>
                <p className="text-violet-400 font-black uppercase tracking-[0.4em] text-[11px] mb-10 relative">Polymarket Whale Intelligence</p>
                <ul className="space-y-8 relative">
                  {[
                    "Priority Telegram delivery with plan-based rules",
                    "Whale Score filter (0-100) with verifiable evidence",
                    "Explainable engine: timing, risk & impact signals",
                    "Auditable performance from tracked wallet history",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-5 text-foreground text-xl font-black tracking-tight group/li">
                      <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center text-foreground text-[10px] group-hover/li:scale-110 transition-transform">✓</div>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-12 pt-8 border-t border-border-muted relative">
                  <p className="text-muted text-sm italic font-light leading-relaxed">&quot;The most transparent data in DeFi.&quot;</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Delivery Promise */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-16 sm:mb-24">
          <div className="glass rounded-[2rem] p-6 sm:p-8 relative overflow-hidden border-border-muted">
            <div className="absolute -top-16 -right-16 w-56 h-56 bg-violet-500/10 rounded-full blur-[70px]"></div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <p className="text-[10px] font-black text-violet-400 tracking-[0.4em] uppercase mb-4">
                  Delivery Promise
                </p>
                <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mb-3">
                  Faster, more frequent alerts after activation
                </h2>
                <p className="text-sm sm:text-base text-muted max-w-2xl font-light">
                  Pro and Elite users are prioritized for conviction-backed Telegram delivery—so you spend less time watching noise and more time acting on the moments that matter.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 w-full md:w-auto">
                {[
                  { title: "Pro", desc: "Faster alerts with reduced delivery delay." },
                  { title: "Elite", desc: "Priority delivery with more frequent updates." },
                ].map((x) => (
                  <div key={x.title} className="rounded-xl border border-border bg-surface/85 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.25em] text-subtle mb-2">{x.title}</div>
                    <div className="text-sm text-foreground font-semibold leading-relaxed">{x.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 mb-16 sm:mb-24">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-[10px] font-black text-violet-400 tracking-[0.4em] uppercase mb-4">
              Pricing
            </h2>
            <p className="text-xl sm:text-2xl md:text-4xl font-black text-foreground tracking-tight mb-4 leading-tight">
              Institutional data. <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-400 via-gray-200 to-gray-500">Retail simplicity.</span>
            </p>
            <p className="text-base text-muted font-light max-w-2xl mx-auto">Choose the intelligence level that matches your market participation.</p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto items-stretch">
            
            {/* Free */}
            <div className="glass rounded-[2rem] h-full flex flex-col border-border-muted p-7 bg-surface/45">
              <h3 className="text-xs font-bold text-subtle tracking-tight uppercase mb-5">Free</h3>
              <div className="text-4xl font-black mb-5 text-foreground tracking-tighter">$0<span className="text-base font-normal text-subtle tracking-normal ml-1.5">/mo</span></div>
              <p className="text-subtle mb-8 text-sm font-light leading-relaxed">Basic intelligence for casual observers.</p>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  "3 alerts per day",
                  "10-min delayed signals",
                  "Whale Score visibility",
                  "No custom /follow alerts",
                  "No custom collections",
                  "No smart collections access"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-muted font-medium text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-700"></div>
                    {item}
                  </li>
                ))}
              </ul>
              <a href="/subscribe?plan=free" className="w-full py-3.5 rounded-xl bg-surface border border-border text-foreground font-bold text-center text-xs">Get started free</a>
            </div>

            {/* Pro - Most Popular (Center Reinforcement) */}
            <div className="glass rounded-[2.5rem] h-full flex flex-col border-violet-500/40 p-8 relative overflow-hidden bg-surface/45">
              <div className="absolute top-0 right-0 px-6 py-2 bg-violet-600 text-foreground text-[9px] font-black uppercase tracking-[0.2em] rounded-bl-2xl z-20">Most Popular</div>
              
              <h3 className="text-xs font-bold text-violet-400 tracking-tight uppercase mb-6">Pro</h3>
              <div className="mb-6">
                <div className="text-6xl font-black text-foreground tracking-tighter">$29<span className="text-lg font-normal text-violet-300/40 tracking-normal ml-2">/mo</span></div>
                <div className="text-sm font-medium text-violet-300/60 mt-1">or $290/yr</div>
              </div>
              <p className="text-foreground mb-8 text-sm font-light leading-relaxed">For professional traders who need immediate edges.</p>
              
              <ul className="space-y-4 mb-10 flex-1">
                {[
                  "Unlimited real-time alerts",
                  "Follow up to 20 whales",
                  "Create up to 3 collections",
                  "Subscribe to 5 Smart Collections",
                  "Full Whale Score visibility",
                  "Full Telegram Bot features"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-4 text-foreground font-bold text-xs">
                    <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center">
                      <svg className="w-3 h-3 text-violet-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              
              <a 
                href="/subscribe?plan=pro"
                className="w-full py-4 rounded-2xl bg-violet-600 text-foreground font-black text-base text-center"
              >
                Upgrade to Pro
              </a>
            </div>

            {/* Elite */}
            <div className="glass rounded-[2rem] h-full flex flex-col border-border-muted p-7 bg-surface/45">
              <h3 className="text-xs font-bold text-subtle tracking-tight uppercase mb-5">Elite</h3>
              <div className="mb-5">
                <div className="text-4xl font-black text-foreground tracking-tighter">$59<span className="text-base font-normal text-subtle tracking-normal ml-1.5">/mo</span></div>
                <div className="text-xs font-medium text-subtle mt-1">or $590/yr</div>
              </div>
              <p className="text-subtle mb-8 text-sm font-light leading-relaxed">The ultimate toolkit for high-net-worth operators.</p>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  "Unlimited real-time alerts",
                  "Follow up to 100 whales",
                  "Unlimited collections",
                  "Subscribe to 20 Smart Collections",
                  "Priority Whale Score updates",
                  "Exclusive alpha channel access"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-muted font-medium text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/30"></div>
                    {item}
                  </li>
                ))}
              </ul>
              <a 
                href="/subscribe?plan=elite"
                className="w-full py-3.5 rounded-xl bg-surface border border-border text-foreground font-bold text-center text-xs"
              >
                Go Elite
              </a>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}

async function HomeLiveSignals() {
  const liveSignals = await loadLiveSignals();
  return <LiveSignalsFeed signals={liveSignals} />;
}
