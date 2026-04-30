import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TestAlertButton from '@/components/TestAlertButton';
import TrackPageEvent from '@/components/TrackPageEvent';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const metadata = {
  title: 'My Dashboard - SightWhale.com',
  description: 'Track followed whales, smart collections, and the latest smart money updates.',
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: '/follow',
  },
};

type FollowRow = {
  id: string;
  wallet: string;
  alertEntry: boolean;
  alertExit: boolean;
  alertAdd: boolean;
  minSize: number;
  minScore: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type WhaleSummary = {
  wallet: string;
  whaleScore: number | null;
  lastTradeTime: string | null;
  lastTradeMarket: string | null;
  lastTradeAction: string | null;
  lastTradeSide: string | null;
  lastTradeSize: number | null;
};

type SubscriptionRow = {
  id: string;
  smartCollectionId: string;
  name: string;
  description: string;
  createdAt: Date;
};

type SmartCollectionUpdate = {
  id: string;
  name: string;
  description: string | null;
  snapshot_date: string | null;
  whale_count: number | null;
};

type AlertEventRow = {
  id: string;
  source_type: string;
  source_id: string | null;
  title: string;
  detail: string | null;
  outcome: string | null;
  occurred_at: string;
};

const WHALE_ENGINE_BASE =
  process.env.NEXT_PUBLIC_WHALE_ENGINE_API_BASE_URL || 'https://whale-engine-api.onrender.com';
const TELEGRAM_BOT_URL =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || 'https://t.me/sightwhale_bot';

async function getFollowRows(userId: string | null): Promise<FollowRow[]> {
  if (!userId) {
    return [];
  }
  const rows = await prisma.whaleFollow.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  return rows;
}

async function getSubscriptions(userId: string): Promise<SubscriptionRow[]> {
  const rows = await prisma.smartCollectionSubscription.findMany({
    where: { userId },
    include: {
      smartCollection: {
        select: { id: true, name: true, description: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => ({
    id: row.id,
    smartCollectionId: row.smartCollection.id,
    name: row.smartCollection.name,
    description: row.smartCollection.description ?? '',
    createdAt: row.createdAt,
  }));
}

async function getSmartCollectionUpdates(userId: string): Promise<SmartCollectionUpdate[]> {
  const rows = await prisma.$queryRawUnsafe<
    {
      id: string;
      name: string;
      description: string | null;
      snapshot_date: Date | null;
      whale_count: number | null;
    }[]
  >(
    `
    SELECT
      sc.id,
      sc.name,
      sc.description,
      latest.snapshot_date,
      latest.whale_count
    FROM smart_collection_subscriptions scs
    JOIN smart_collections sc ON sc.id = scs.smart_collection_id
    LEFT JOIN LATERAL (
      SELECT snapshot_date, COUNT(*)::int AS whale_count
      FROM smart_collection_whales scw
      WHERE scw.smart_collection_id = sc.id
      GROUP BY snapshot_date
      ORDER BY snapshot_date DESC
      LIMIT 1
    ) latest ON true
    WHERE scs.user_id = $1
    ORDER BY scs.created_at DESC
    `,
    userId,
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    snapshot_date: row.snapshot_date ? row.snapshot_date.toISOString() : null,
    whale_count: row.whale_count,
  }));
}

async function getAlertEvents(userId: string): Promise<AlertEventRow[]> {
  const rows = await prisma.$queryRawUnsafe<
    {
      id: string;
      source_type: string;
      source_id: string | null;
      title: string;
      detail: string | null;
      outcome: string | null;
      occurred_at: Date;
    }[]
  >(
    `
    SELECT id, source_type, source_id, title, detail, outcome, occurred_at
    FROM alert_events
    WHERE user_id = $1
    ORDER BY occurred_at DESC
    LIMIT 20
    `,
    userId,
  );
  return rows.map((row) => ({
    id: row.id,
    source_type: row.source_type,
    source_id: row.source_id,
    title: row.title,
    detail: row.detail,
    outcome: row.outcome,
    occurred_at: row.occurred_at.toISOString(),
  }));
}

async function fetchWhaleSummary(wallet: string): Promise<WhaleSummary> {
  const base = WHALE_ENGINE_BASE.replace(/\/$/, '');
  const res = await fetch(`${base}/whales/${encodeURIComponent(wallet)}`, {
    cache: 'no-store',
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    return {
      wallet,
      whaleScore: null,
      lastTradeTime: null,
      lastTradeMarket: null,
      lastTradeAction: null,
      lastTradeSide: null,
      lastTradeSize: null,
    };
  }
  const data = (await res.json()) as {
    whale_score?: number;
    recent_trades?: { time?: string; market?: string; action?: string; side?: string; size?: number }[];
  };
  const whaleScore =
    typeof data.whale_score === 'number' && Number.isFinite(data.whale_score)
      ? data.whale_score
      : null;
  const last = Array.isArray(data.recent_trades) && data.recent_trades.length > 0
    ? data.recent_trades[0]
    : null;
  const lastTradeTime = last && typeof last.time === 'string' ? last.time : null;
  const lastTradeMarket = last && typeof last.market === 'string' ? last.market : null;
  const lastTradeAction = last && typeof last.action === 'string' ? last.action : null;
  const lastTradeSide = last && typeof last.side === 'string' ? last.side : null;
  const lastTradeSize = last && typeof last.size === 'number' ? last.size : null;
  return {
    wallet,
    whaleScore,
    lastTradeTime,
    lastTradeMarket,
    lastTradeAction,
    lastTradeSide,
    lastTradeSize,
  };
}

function shortenWallet(addr: string): string {
  const v = (addr || '').trim();
  if (v.length <= 10) return v;
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}

function formatScore(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '–';
  }
  return value.toFixed(1);
}

function formatTime(value: string | null): string {
  if (!value) {
    return '–';
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return '–';
  }
  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '–';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${value >= 0 ? '' : '-'}$${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${value >= 0 ? '' : '-'}$${(abs / 1_000).toFixed(1)}K`;
  }
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return '–';
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return '–';
  }
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
  });
}

function hoursSince(now: Date, value: string | null): number | null {
  if (!value) {
    return null;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return (now.getTime() - d.getTime()) / (1000 * 60 * 60);
}

function estimateNextAlertWindow(params: {
  hasSignalSources: boolean;
  telegramConnected: boolean;
  lastAlertAt: string | null;
  lastActivityAt: string | null;
  now: Date;
}): { label: string; detail: string } {
  const { hasSignalSources, telegramConnected, lastAlertAt, lastActivityAt, now } = params;
  if (!telegramConnected) {
    return {
      label: 'Connect Telegram first',
      detail: 'Alerts will start once the bot is linked.',
    };
  }
  if (!hasSignalSources) {
    return {
      label: 'Choose signal sources',
      detail: 'Subscribe to a Smart Collection or follow a whale wallet.',
    };
  }
  const lastAlertHours = hoursSince(now, lastAlertAt);
  if (lastAlertHours !== null) {
    if (lastAlertHours <= 1) {
      return { label: 'Next alert likely in 1–6 hours', detail: 'Recent delivery just occurred.' };
    }
    if (lastAlertHours <= 6) {
      return { label: 'Next alert likely in 6–24 hours', detail: 'Signals are flowing regularly.' };
    }
    if (lastAlertHours <= 24) {
      return { label: 'Next alert likely in 24–48 hours', detail: 'Markets are active but not spiky.' };
    }
    return { label: 'Next alert likely in 24–72 hours', detail: 'Waiting for a higher conviction move.' };
  }
  const lastActivityHours = hoursSince(now, lastActivityAt);
  if (lastActivityHours !== null && lastActivityHours <= 24) {
    return { label: 'First alert likely in 1–24 hours', detail: 'Recent whale activity detected.' };
  }
  return { label: 'First alert likely in 24–72 hours', detail: 'Awaiting fresh whale activity.' };
}

export default async function FollowPage() {
  const isProduction = process.env.NODE_ENV === 'production';
  const user = await getCurrentUser();
  const rows = await getFollowRows(user?.id ?? null);
  const subscriptions = user ? await getSubscriptions(user.id) : [];
  const updates = user ? await getSmartCollectionUpdates(user.id) : [];
  const alertEvents = user ? await getAlertEvents(user.id) : [];
  const summaries = await Promise.all(rows.map((row) => fetchWhaleSummary(row.wallet)));
  const byWallet = new Map(summaries.map((s) => [s.wallet.toLowerCase(), s]));
  const telegramConnected = Boolean(user?.telegramId);
  const paidPlan = user?.plan && user.plan !== 'FREE';
  const recentMoves = summaries
    .filter((summary) => summary.lastTradeTime)
    .sort((a, b) => new Date(b.lastTradeTime || 0).getTime() - new Date(a.lastTradeTime || 0).getTime())
    .slice(0, 5);
  const hasSignalSources = rows.length > 0 || subscriptions.length > 0;
  const steps = [
    {
      title: 'Subscribe to a collection',
      description: 'Fastest way to get diversified smart-money alerts.',
      done: subscriptions.length > 0,
      href: '/smart-collections',
      cta: 'Subscribe',
      badge: 'Recommended',
    },
    {
      title: 'Follow a whale',
      description: 'Track a specific wallet and customize alert settings.',
      done: rows.length > 0,
      href: '/smart-money',
      cta: 'Follow',
    },
    {
      title: 'Connect Telegram',
      description: 'Receive real-time alerts via the bot.',
      done: telegramConnected,
      href: TELEGRAM_BOT_URL,
      cta: 'Connect',
    },
  ];
  const completedSteps = steps.filter((step) => step.done).length;
  const fallbackActivity = [
    ...recentMoves.map((move) => ({
      type: 'whale',
      title: `Whale ${shortenWallet(move.wallet)}`,
      detail: move.lastTradeMarket || 'Unknown market',
      time: move.lastTradeTime,
      href: `/whales/${encodeURIComponent(move.wallet)}`,
    })),
    ...updates.map((item) => ({
      type: 'collection',
      title: `Collection ${item.name}`,
      detail: `Snapshot ${formatDate(item.snapshot_date)}`,
      time: item.snapshot_date,
      href: `/smart-collections/${encodeURIComponent(item.id)}`,
    })),
  ];
  const activityItems = (alertEvents.length > 0
    ? alertEvents.map((item) => ({
        type: item.source_type,
        title: item.title,
        detail: item.outcome
          ? `${item.detail || 'Alert update'} · Outcome ${item.outcome}`
          : item.detail || 'Alert update',
        time: item.occurred_at,
        href:
          item.source_type === 'whale' && item.source_id
            ? `/whales/${encodeURIComponent(item.source_id)}`
            : item.source_type === 'collection' && item.source_id
            ? `/smart-collections/${encodeURIComponent(item.source_id)}`
            : '/follow',
      }))
    : fallbackActivity
  )
    .filter((item) => item.time)
    .sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime())
    .slice(0, 6);
  const now = new Date();
  const lastAlert = alertEvents.length > 0 ? alertEvents[0] : null;
  const lastOutcomeAlert = alertEvents.find((item) => item.outcome);
  const lastActivityAt = activityItems.length > 0 ? activityItems[0].time : null;
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentAlerts7d = alertEvents.filter((item) => new Date(item.occurred_at) >= since7d).length;
  const recentAlerts30d = alertEvents.filter((item) => new Date(item.occurred_at) >= since30d).length;
  const resolvedAlerts30d = alertEvents.filter((item) => item.outcome && new Date(item.occurred_at) >= since30d).length;
  const resolvedRate30d = recentAlerts30d > 0 ? Math.round((resolvedAlerts30d / recentAlerts30d) * 100) : null;
  const eta = estimateNextAlertWindow({
    hasSignalSources,
    telegramConnected,
    lastAlertAt: lastAlert?.occurred_at ?? null,
    lastActivityAt,
    now,
  });

  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <TrackPageEvent
        name="dashboard_view"
        payload={{
          page: 'follow',
          plan: user?.plan ?? 'anonymous',
          telegram_connected: telegramConnected,
          paid_plan: Boolean(paidPlan),
        }}
      />
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-15%] w-[45%] h-[45%] bg-violet-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[45%] h-[45%] bg-cyan-500/10 rounded-full blur-[140px]" />
      </div>

      <Header />

      <main className="mx-auto max-w-5xl px-6 pt-32 pb-24 relative space-y-8">
        <section className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">My Dashboard</h1>
          <p className="text-gray-400 text-sm max-w-2xl">
            Track followed whales, smart collections, and the latest smart money updates.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500">Smart Money Addresses</p>
            <div className="text-2xl font-semibold text-white mt-2">{rows.length}</div>
            <div className="text-xs text-gray-500 mt-2">Addresses you are currently following</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500">Smart Collections</p>
            <div className="text-2xl font-semibold text-white mt-2">{subscriptions.length}</div>
            <div className="text-xs text-gray-500 mt-2">Subscribed smart money groups</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500">Telegram Status</p>
            <div className="text-2xl font-semibold text-white mt-2">
              {telegramConnected
                ? 'Connected'
                : paidPlan
                  ? 'Not linked (web profile)'
                  : 'Not connected'}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {telegramConnected
                ? 'Alerts will reach your bot'
                : paidPlan
                  ? `${user?.plan} is active for delivery, but this web login has no Telegram chat ID saved. Open the bot / Mini App while logged in here, or re-checkout signed in so we can attach your chat ID.`
                  : 'Connect to receive alerts'}
            </div>
            {!telegramConnected && (
              <div className="mt-4">
                <a
                  href={TELEGRAM_BOT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full border border-violet-500/60 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-500/20"
                >
                  Connect Telegram Bot
                </a>
              </div>
            )}
            {telegramConnected && !isProduction && <TestAlertButton />}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white mb-2">First Alert Readiness</h2>
              <p className="text-xs text-gray-400">
                Confirm delivery setup and see when the next alert is likely to arrive.
              </p>
            </div>
            <div className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-gray-300">
              {eta.label}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">Signal Sources</p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                    hasSignalSources
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                      : 'border-white/15 bg-white/5 text-gray-400'
                  }`}
                >
                  {hasSignalSources ? 'Ready' : 'Missing'}
                </span>
              </div>
              <div className="text-2xl font-semibold text-white">{subscriptions.length + rows.length}</div>
              <div className="text-xs text-gray-500 mt-2">
                {subscriptions.length} collections · {rows.length} whales
              </div>
              {!subscriptions.length && (
                <div className="mt-3">
                  <Link
                    href="/smart-collections"
                    className="inline-flex items-center rounded-full border border-violet-500/60 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-500/20"
                  >
                    Start with Smart Collections
                  </Link>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">Delivery Status</p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                    telegramConnected
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                      : 'border-white/15 bg-white/5 text-gray-400'
                  }`}
                >
                  {telegramConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="text-2xl font-semibold text-white">
                {telegramConnected ? 'Bot linked' : 'Needs connection'}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {telegramConnected ? 'Alerts will reach your Telegram bot.' : 'Connect the bot to receive alerts.'}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">Estimated Next Alert</p>
                <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gray-300">
                  Forecast
                </span>
              </div>
              <div className="text-base font-semibold text-white">{eta.label}</div>
              <div className="text-xs text-gray-500 mt-2">{eta.detail}</div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white mb-2">Action Checklist</h2>
              <p className="text-xs text-gray-400">
                Complete the key steps to finish your alerts setup.
              </p>
            </div>
            <div className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-gray-300">
              Progress {completedSteps} / {steps.length}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {steps.map((step) => (
              <div
                key={step.title}
                className="rounded-xl border border-white/10 bg-black/30 p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                      {step.badge && (
                        <span className="rounded-full border border-violet-500/60 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-100">
                          {step.badge}
                        </span>
                      )}
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                        step.done
                          ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                          : 'border-white/15 bg-white/5 text-gray-400'
                      }`}
                    >
                      {step.done ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{step.description}</p>
                </div>
                {step.href.startsWith('http') ? (
                  <a
                    href={step.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-between rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-gray-200 hover:bg-white/10"
                  >
                    {step.cta}
                    <span className="text-[10px] text-gray-500">External</span>
                  </a>
                ) : (
                  <Link
                    href={step.href}
                    className="inline-flex items-center justify-between rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-gray-200 hover:bg-white/10"
                  >
                    {step.cta}
                    <span className="text-[10px] text-gray-500">Go</span>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Latest Smart Collection Updates</h2>
            <Link
              href="/smart-collections"
              className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-medium text-gray-200 hover:bg-white/10"
            >
              Explore collections
            </Link>
          </div>
          {updates.length === 0 ? (
            <div className="text-sm text-gray-400">
              Subscribe to Smart Collections to see the latest snapshot updates here.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {updates.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{item.name}</h3>
                      <p className="text-xs text-gray-400 line-clamp-2">
                        {item.description || 'Smart money collection update'}
                      </p>
                    </div>
                    <Link
                      href={`/smart-collections/${encodeURIComponent(item.id)}`}
                      className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium text-gray-200 hover:bg-white/10"
                    >
                      View
                    </Link>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>Latest snapshot: {formatDate(item.snapshot_date)}</span>
                    <span>{item.whale_count ?? 0} whales</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Recent Whale Moves</h2>
            <Link
              href="/smart-money"
              className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-medium text-gray-200 hover:bg-white/10"
            >
              Explore smart money
            </Link>
          </div>
          {recentMoves.length === 0 ? (
            <div className="text-sm text-gray-400">
              Follow whales to see their most recent trades and conviction moves here.
            </div>
          ) : (
            <div className="space-y-3">
              {recentMoves.map((move) => (
                <div
                  key={move.wallet}
                  className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                >
                  <div>
                    <Link
                      href={`/whales/${encodeURIComponent(move.wallet)}`}
                      className="text-sm font-medium text-white hover:text-violet-200"
                    >
                      {shortenWallet(move.wallet)}
                    </Link>
                    <div className="text-xs text-gray-400 line-clamp-1">
                      {move.lastTradeMarket || 'Unknown market'}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
                    <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 uppercase tracking-wide">
                      {move.lastTradeAction || 'Trade'}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 uppercase tracking-wide ${
                        move.lastTradeSide?.toLowerCase() === 'buy'
                          ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                          : 'border-rose-500/60 bg-rose-500/10 text-rose-200'
                      }`}
                    >
                      {move.lastTradeSide || 'Side'}
                    </span>
                    <span className="text-gray-400">{formatUsd(move.lastTradeSize)}</span>
                    <span className="text-gray-500">{formatTime(move.lastTradeTime)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Verification Snapshot</h2>
            <span className="text-xs text-gray-500">Based on delivered alerts</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Last Alert Delivered</p>
              <div className="text-base font-semibold text-white mt-2">
                {lastAlert ? formatTime(lastAlert.occurred_at) : 'No alerts yet'}
              </div>
              <div className="text-xs text-gray-500 mt-2 line-clamp-2">
                {lastAlert?.title || 'Follow whales or collections to start receiving alerts.'}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Last Resolved Alert</p>
              <div className="text-base font-semibold text-white mt-2">
                {lastOutcomeAlert ? formatTime(lastOutcomeAlert.occurred_at) : 'No resolved alerts'}
              </div>
              <div className="text-xs text-gray-500 mt-2 line-clamp-2">
                {lastOutcomeAlert?.outcome ? `Outcome ${lastOutcomeAlert.outcome}` : 'Resolved outcomes will appear here.'}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Recent Performance</p>
              <div className="text-base font-semibold text-white mt-2">
                {recentAlerts7d} alerts · 7 days
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {resolvedRate30d === null ? 'Resolution rate available after more alerts.' : `${resolvedRate30d}% resolved in 30 days`}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Alert Review</h2>
            <span className="text-xs text-gray-500">
              {alertEvents.length > 0 ? 'From delivered alerts' : 'From latest whale and collection activity'}
            </span>
          </div>
          {activityItems.length === 0 ? (
            <div className="text-sm text-gray-400">
              No alert history yet. Follow a whale or subscribe to a collection to see activity here.
            </div>
          ) : (
            <div className="space-y-3">
              {activityItems.map((item) => (
                <div
                  key={`${item.type}-${item.title}-${item.time}`}
                  className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                >
                  <div>
                    <Link
                      href={item.href}
                      className="text-sm font-medium text-white hover:text-violet-200"
                    >
                      {item.title}
                    </Link>
                    <div className="text-xs text-gray-400">{item.detail}</div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 uppercase tracking-wide">
                      {item.type === 'whale' ? 'Whale Move' : 'Collection Update'}
                    </span>
                    <span>{formatTime(item.time)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Subscribed Smart Collections</h2>
            <Link
              href="/smart-collections"
              className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-medium text-gray-200 hover:bg-white/10"
            >
              Manage
            </Link>
          </div>
          {subscriptions.length === 0 ? (
            <div className="text-sm text-gray-400 space-y-3">
              <p>
                You are not subscribed to any Smart Collections yet. Subscriptions keep you aligned
                with curated strategies.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/smart-collections"
                  className="inline-flex items-center rounded-full border border-violet-500/60 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-500/20"
                >
                  Browse smart collections
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subscriptions.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4 flex flex-col justify-between gap-3"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-white">{item.name}</h3>
                    <p className="text-xs text-gray-400 line-clamp-2">
                      {item.description || 'Curated smart money behaviors'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>Subscribed {item.createdAt.toLocaleDateString()}</span>
                    <Link
                      href={`/smart-collections/${encodeURIComponent(item.smartCollectionId)}`}
                      className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 font-medium text-gray-200 hover:bg-white/10"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          {rows.length === 0 ? (
            <div className="text-sm text-gray-400 space-y-3">
              <p>
                You are not following any whales yet. Once you follow a wallet, its high-conviction
                trades will show up here with live scores and recent activity.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center rounded-full border border-violet-500/60 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-500/20"
                >
                  Browse whales on the landing page
                </Link>
                <Link
                  href="/blog"
                  className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-100 hover:bg-white/10"
                >
                  Learn how to pick smart money wallets
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-300">
                <thead className="text-xs uppercase tracking-wide text-gray-500 border-b border-white/10">
                  <tr>
                    <th className="py-2 pr-4 text-left">Whale</th>
                    <th className="py-2 px-4 text-right">Whale Score</th>
                    <th className="py-2 px-4 text-right">Last Trade</th>
                    <th className="py-2 px-4 text-right">Enabled</th>
                    <th className="py-2 pl-4 text-right">Settings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map((row) => {
                    const summary = byWallet.get(row.wallet.toLowerCase());
                    return (
                      <tr key={row.id} className="hover:bg-white/[0.03]">
                        <td className="py-3 pr-4 align-top">
                          <div className="flex flex-col gap-1">
                            <Link
                              href={`/whales/${encodeURIComponent(row.wallet)}`}
                              className="text-sm text-white hover:text-violet-200"
                            >
                              {shortenWallet(row.wallet)}
                            </Link>
                            <div className="text-[11px] text-gray-500 font-mono">
                              min size ≥ ${row.minSize.toLocaleString(undefined, {
                                maximumFractionDigits: 0,
                              })}
                              , min score ≥ {row.minScore.toFixed(1)}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 align-top text-right font-mono text-xs text-gray-200">
                          {formatScore(summary?.whaleScore ?? null)}
                        </td>
                        <td className="py-3 px-4 align-top text-right font-mono text-xs text-gray-400 whitespace-nowrap">
                          {formatTime(summary?.lastTradeTime ?? null)}
                        </td>
                        <td className="py-3 px-4 align-top text-right text-xs">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                              row.enabled
                                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                                : 'border-gray-500/60 bg-gray-800 text-gray-300'
                            }`}
                          >
                            {row.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-3 pl-4 align-top text-right text-xs">
                          <Link
                            href={`/whales/${encodeURIComponent(row.wallet)}`}
                            className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-medium text-gray-200 hover:bg-white/10"
                          >
                            Open Profile
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
