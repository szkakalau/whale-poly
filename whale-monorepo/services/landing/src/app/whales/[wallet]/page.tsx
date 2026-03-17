import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WhaleFollowButton from '@/components/WhaleFollowButton';
import FullAccessGating from '@/components/FullAccessGating';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { canAccessFeature } from '@/lib/plans';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';

type WhaleStats = {
  total_volume: number;
  total_trades: number;
  win_rate: number;
  realized_pnl: number;
};

type WhalePerformance30d = {
  pnl: number;
  win_rate: number;
  volume: number;
};

type WhaleTopMarket = {
  market: string;
  trades: number;
  volume: number;
  pnl: number;
};

type WhaleRecentTrade = {
  time: string;
  market: string;
  action: string;
  side: string;
  size: number;
  price: number;
  whale_score: number;
};

type WhaleBehavior = {
  common_action: string;
  avg_trade_size: number;
  side_bias: string;
};

type WhaleScoreBreakdown = {
  performance: number;
  consistency: number;
  timing: number;
  risk: number;
  impact: number;
} | null;

type WhaleProfileResponse = {
  wallet: string;
  display_name: string;
  whale_score: number;
  whale_score_breakdown: WhaleScoreBreakdown;
  rank: number;
  stats: WhaleStats;
  performance_30d: WhalePerformance30d;
  top_markets: WhaleTopMarket[];
  recent_trades: WhaleRecentTrade[];
  behavior: WhaleBehavior;
};

type WhaleEngineProfile = {
  wallet?: string;
  display_name?: string;
  whale_score?: number;
  whale_score_breakdown?: {
    performance?: number;
    consistency?: number;
    timing?: number;
    risk?: number;
    impact?: number;
  } | null;
  total_volume?: number;
  total_trades?: number;
  win_rate?: number;
  realized_pnl?: number;
  top_markets?: { market_id?: string; market_title?: string | null; volume?: number }[];
  recent_trades?: {
    created_at?: string;
    market_id?: string;
    market_title?: string | null;
    side?: string;
    trade_usd?: number;
    price?: number;
    whale_score?: number;
  }[];
};

type PageProps = {
  params: Promise<{ wallet: string }>;
};

const WHALE_ENGINE_BASE =
  process.env.NEXT_PUBLIC_WHALE_ENGINE_API_BASE_URL || 'https://whale-engine-api.onrender.com';
const SITE_BASE = (() => {
  const fallback = 'https://www.sightwhale.com';
  const raw = process.env.NEXT_PUBLIC_SITE_URL || fallback;
  try {
    const url = new URL(raw);
    url.protocol = 'https:';
    if (url.hostname === 'sightwhale.com') {
      url.hostname = 'www.sightwhale.com';
    }
    return url.origin;
  } catch {
    return fallback;
  }
})();

export const revalidate = 0;

function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeWhaleProfile(payload: unknown, walletHint: string): WhaleProfileResponse | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as Record<string, unknown>;

  if (data.stats && typeof data.stats === 'object') {
    const wallet = safeString(data.wallet, walletHint);
    const display_name = safeString(data.display_name, wallet);
    const whale_score = safeNumber(data.whale_score, 0);
    const breakdownRaw =
      data.whale_score_breakdown && typeof data.whale_score_breakdown === 'object'
        ? (data.whale_score_breakdown as Record<string, unknown>)
        : null;
    const whale_score_breakdown: WhaleScoreBreakdown = breakdownRaw
      ? {
          performance: safeNumber(breakdownRaw.performance, 0),
          consistency: safeNumber(breakdownRaw.consistency, 0),
          timing: safeNumber(breakdownRaw.timing, 0),
          risk: safeNumber(breakdownRaw.risk, 0),
          impact: safeNumber(breakdownRaw.impact, 0),
        }
      : null;
    const rank = safeNumber(data.rank, 0);

    const statsRaw = data.stats as Record<string, unknown>;
    const stats: WhaleStats = {
      total_volume: safeNumber(statsRaw.total_volume, 0),
      total_trades: safeNumber(statsRaw.total_trades, 0),
      win_rate: safeNumber(statsRaw.win_rate, 0),
      realized_pnl: safeNumber(statsRaw.realized_pnl, 0),
    };

    const perfRaw =
      data.performance_30d && typeof data.performance_30d === 'object'
        ? (data.performance_30d as Record<string, unknown>)
        : {};
    const performance_30d: WhalePerformance30d = {
      pnl: safeNumber(perfRaw.pnl, 0),
      win_rate: safeNumber(perfRaw.win_rate, 0),
      volume: safeNumber(perfRaw.volume, 0),
    };

    const top_markets = Array.isArray(data.top_markets)
      ? (data.top_markets as unknown[]).map((m) => {
          const row = m && typeof m === 'object' ? (m as Record<string, unknown>) : {};
          return {
            market: safeString(row.market, ''),
            trades: safeNumber(row.trades, 0),
            volume: safeNumber(row.volume, 0),
            pnl: safeNumber(row.pnl, 0),
          };
        })
      : [];

    const recent_trades = Array.isArray(data.recent_trades)
      ? (data.recent_trades as unknown[]).map((t) => {
          const row = t && typeof t === 'object' ? (t as Record<string, unknown>) : {};
          return {
            time: safeString(row.time, ''),
            market: safeString(row.market, ''),
            action: safeString(row.action, ''),
            side: safeString(row.side, ''),
            size: safeNumber(row.size, 0),
            price: safeNumber(row.price, 0),
            whale_score: safeNumber(row.whale_score, 0),
          };
        })
      : [];

    const behaviorRaw =
      data.behavior && typeof data.behavior === 'object' ? (data.behavior as Record<string, unknown>) : {};
    const behavior: WhaleBehavior = {
      common_action: safeString(behaviorRaw.common_action, 'Trade'),
      avg_trade_size: safeNumber(behaviorRaw.avg_trade_size, 0),
      side_bias: safeString(behaviorRaw.side_bias, 'Neutral'),
    };

    return {
      wallet,
      display_name,
      whale_score,
      whale_score_breakdown,
      rank,
      stats,
      performance_30d,
      top_markets,
      recent_trades,
      behavior,
    };
  }

  const raw = data as WhaleEngineProfile;
  const wallet = safeString(raw.wallet, walletHint);
  const display_name = safeString(raw.display_name, shortenWallet(wallet));
  const total_volume = safeNumber(raw.total_volume, 0);
  const total_trades = safeNumber(raw.total_trades, 0);
  const win_rate = safeNumber(raw.win_rate, 0);
  const realized_pnl = safeNumber(raw.realized_pnl, 0);

  const rawRecent = Array.isArray(raw.recent_trades) ? raw.recent_trades : [];
  const sideCounts = rawRecent.reduce(
    (acc, t) => {
      const side = safeString(t?.side, '').toLowerCase();
      if (side === 'buy') acc.buy += 1;
      if (side === 'sell') acc.sell += 1;
      return acc;
    },
    { buy: 0, sell: 0 },
  );
  const side_bias = sideCounts.buy === sideCounts.sell ? 'Neutral' : sideCounts.buy > sideCounts.sell ? 'Buy' : 'Sell';
  const avg_trade_size =
    rawRecent.length > 0 ? rawRecent.reduce((sum, t) => sum + safeNumber(t?.trade_usd, 0), 0) / rawRecent.length : 0;

  const whale_score = safeNumber(raw.whale_score, 0) || (rawRecent.length > 0 ? rawRecent.reduce((max, t) => Math.max(max, safeNumber(t?.whale_score, 0)), 0) : 0);
  const whale_score_breakdown: WhaleScoreBreakdown = raw.whale_score_breakdown
    ? {
        performance: safeNumber(raw.whale_score_breakdown.performance, 0),
        consistency: safeNumber(raw.whale_score_breakdown.consistency, 0),
        timing: safeNumber(raw.whale_score_breakdown.timing, 0),
        risk: safeNumber(raw.whale_score_breakdown.risk, 0),
        impact: safeNumber(raw.whale_score_breakdown.impact, 0),
      }
    : null;

  const stats: WhaleStats = {
    total_volume,
    total_trades,
    win_rate,
    realized_pnl,
  };

  const performance_30d: WhalePerformance30d = {
    pnl: 0,
    win_rate: 0,
    volume: 0,
  };

  const top_markets: WhaleTopMarket[] = Array.isArray(raw.top_markets)
    ? raw.top_markets.map((m) => {
        const market = safeString(m?.market_title, '') || safeString(m?.market_id, '');
        return {
          market,
          trades: 0,
          volume: safeNumber(m?.volume, 0),
          pnl: 0,
        };
      })
    : [];

  const recent_trades: WhaleRecentTrade[] = rawRecent.map((t) => ({
    time: safeString(t?.created_at, ''),
    market: safeString(t?.market_title, '') || safeString(t?.market_id, ''),
    action: 'Trade',
    side: safeString(t?.side, 'unknown').toUpperCase(),
    size: safeNumber(t?.trade_usd, 0),
    price: safeNumber(t?.price, 0),
    whale_score: safeNumber(t?.whale_score, 0),
  }));

  const behavior: WhaleBehavior = {
    common_action: 'Trade',
    avg_trade_size: safeNumber(avg_trade_size, 0),
    side_bias,
  };

  return {
    wallet,
    display_name,
    whale_score,
    whale_score_breakdown,
    rank: 0,
    stats,
    performance_30d,
    top_markets,
    recent_trades,
    behavior,
  };
}

async function fetchWhaleProfileUncached(wallet: string): Promise<WhaleProfileResponse | null> {
  const base = WHALE_ENGINE_BASE.replace(/\/$/, '');
  const res = await fetch(`${base}/whales/${encodeURIComponent(wallet)}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    return null;
  }

  const payload = await res.json().catch(() => null);
  return normalizeWhaleProfile(payload, wallet);
}

const fetchWhaleProfileCached = unstable_cache(fetchWhaleProfileUncached, ['whale-profile'], {
  revalidate: 30,
});

const fetchWhaleProfile = cache((wallet: string) => fetchWhaleProfileCached(wallet));

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${value >= 0 ? '' : '-'}$${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${value >= 0 ? '' : '-'}$${(abs / 1_000).toFixed(1)}K`;
  }
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${(value * 100).toFixed(1)}%`;
}

function formatWinRate(value: number, opts?: { trades?: number; pnl?: number; volume?: number }): string {
  if (!Number.isFinite(value)) return '—';
  const trades = opts?.trades;
  const pnl = opts?.pnl;
  const volume = opts?.volume;
  if (value === 0) {
    if (typeof trades === 'number' && trades === 0) return '—';
    if (typeof volume === 'number' && volume === 0) return '—';
    if (typeof pnl === 'number' && pnl > 0) return '—';
  }
  return formatPercent(value);
}

function shortenWallet(addr: string): string {
  const v = (addr || '').trim();
  if (v.length <= 10) return v;
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}

function formatDateTime(value: string | null): string {
  if (!value) return '–';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function aggregateTrades(trades: WhaleRecentTrade[], days: number) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const filtered = trades.filter((t) => {
    const time = new Date(t.time).getTime();
    return Number.isFinite(time) && time >= since;
  });
  const volume = filtered.reduce((sum, t) => sum + (Number.isFinite(t.size) ? t.size : 0), 0);
  const avgScore =
    filtered.length > 0
      ? filtered.reduce((sum, t) => sum + (Number.isFinite(t.whale_score) ? t.whale_score : 0), 0) /
        filtered.length
      : 0;
  return {
    trades: filtered.length,
    volume,
    avgScore,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { wallet } = await params;
  const data = await fetchWhaleProfile(wallet);

  const name = data?.display_name || shortenWallet(wallet);
  const title = `${name} Whale Profile`;
  const description = `Trading performance and whale behavior for ${name} on Polymarket.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${SITE_BASE}/whales/${wallet}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `/whales/${wallet}`,
    },
  };
}

export default async function WhaleProfilePage({ params }: PageProps) {
  const { wallet } = await params;
  const data = await fetchWhaleProfile(wallet);
  const user = await getCurrentUser();
  const canFollow = user ? canAccessFeature(user, 'whale_follow') : false;
  const hasFullAccess = user ? canAccessFeature(user, 'whale_score_full') : false;

  let initialFollowed = false;
  if (user && data) {
    const existing = await prisma.whaleFollow.findFirst({
      where: {
        userId: user.id,
        wallet: data.wallet.toLowerCase(),
      },
      select: {
        id: true,
      },
    });
    initialFollowed = Boolean(existing);
  }

  if (!data) {
    const fallbackName = shortenWallet(wallet);
    return (
      <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
        <Header />
        <main className="mx-auto max-w-4xl px-6 py-32 relative">
          <div className="mb-8">
            <p className="text-sm text-gray-500 mb-4">Whale Profile</p>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              {fallbackName}
            </h1>
            <p className="text-gray-400 max-w-xl">
              We could not load the whale profile for this address. Please check the wallet
              or try again later.
            </p>
          </div>
          <div className="rounded-2xl border border-red-500/40 bg-red-500/5 px-6 py-4 text-sm text-red-200">
            <div className="font-semibold mb-1">Data unavailable</div>
            <div>
              The whale-engine API returned an error or no data for this wallet.
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const shortWallet = shortenWallet(data.wallet);
  const lastTradeTime = data.recent_trades.length > 0 ? data.recent_trades[0].time : null;
  const perf7d = aggregateTrades(data.recent_trades, 7);
  const perf30d = aggregateTrades(data.recent_trades, 30);
  const perf90d = aggregateTrades(data.recent_trades, 90);
  const shareUrl = `${SITE_BASE.replace(/\/$/, '')}/whales/${encodeURIComponent(data.wallet)}/share`;
  const shareText = `Whale ${data.display_name} · Score ${safeNumber(data.whale_score, 0).toFixed(1)} · 30D PnL ${formatUsd(safeNumber(data.performance_30d.pnl, 0))}`;
  const shareX = `https://x.com/intent/tweet?text=${encodeURIComponent(
    shareText,
  )}&url=${encodeURIComponent(shareUrl)}`;
  const shareTelegram = `https://t.me/share/url?url=${encodeURIComponent(
    shareUrl,
  )}&text=${encodeURIComponent(shareText)}`;

  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-15%] w-[45%] h-[45%] bg-violet-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[45%] h-[45%] bg-cyan-500/10 rounded-full blur-[140px]" />
      </div>

      <Header />

      <main className="mx-auto max-w-6xl px-6 pt-32 pb-24 relative">
        <section className="mb-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="text-sm text-gray-400 mb-2">Whale Profile</p>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                {data.display_name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                <span className="font-mono text-gray-500 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                  {shortWallet}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/50 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
                  <span className="w-2 h-2 rounded-full bg-violet-400" />
                  Whale Score
                  <span className="text-lg font-semibold text-white">
                    {safeNumber(data.whale_score, 0).toFixed(1)}
                  </span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/50 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
                  Rank
                <span className="text-sm font-semibold text-white">#{safeNumber(data.rank, 0)}</span>
                </span>
              </div>
            </div>

            <WhaleFollowButton 
              wallet={data.wallet} 
              initialFollowed={initialFollowed} 
              canFollow={canFollow}
            />
          </div>
        </section>

        <section className="mb-10">
          <WhaleScoreBreakdownCard
            score={safeNumber(data.whale_score, 0)}
            breakdown={data.whale_score_breakdown}
            hasFullAccess={hasFullAccess}
          />
        </section>

        <section className="mb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Volume"
            value={formatUsd(data.stats.total_volume)}
            hint="All-time tracked"
          />
          <StatCard
            label="Total Trades"
            value={data.stats.total_trades.toLocaleString()}
            hint="Qualifying whale trades"
          />
          <StatCard
            label="Win Rate"
            value={formatWinRate(data.stats.win_rate, {
              trades: data.stats.total_trades,
              pnl: data.stats.realized_pnl,
            })}
            hint="Closed positions"
          />
          <StatCard
            label="Realized PnL"
            value={formatUsd(data.stats.realized_pnl)}
            hint="Across settled markets"
            tone={data.stats.realized_pnl >= 0 ? 'positive' : 'negative'}
          />
        </section>
        <div className="text-[11px] text-gray-500 mb-10">
          Win Rate uses closed (settled) trades only. New wallets may show limited history until positions settle.
        </div>

        <section className="mb-10 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Latest Trade</div>
            <div className="text-lg font-semibold text-white">
              {formatDateTime(lastTradeTime)}
            </div>
            <div className="text-xs text-gray-500 mt-2">Used to gauge activity and recency</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Sample Coverage</div>
            <div className="text-lg font-semibold text-white">
              {data.stats.total_trades.toLocaleString()} trades
            </div>
            <div className="text-xs text-gray-500 mt-2">Count of qualifying whale trades</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Behavior Signal</div>
            <div className="text-lg font-semibold text-white">{data.behavior.common_action}</div>
            <div className="text-xs text-gray-500 mt-2">
              {data.behavior.side_bias} bias · Avg {formatUsd(data.behavior.avg_trade_size)}
            </div>
          </div>
        </section>

        <section className="mb-10 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            { label: 'Last 7 days', data: perf7d },
            { label: 'Last 30 days', data: perf30d },
            { label: 'Last 90 days', data: perf90d },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-3"
            >
              <div className="text-xs uppercase tracking-wide text-gray-400">{item.label} performance</div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-2xl font-semibold text-white">
                    {formatUsd(item.data.volume)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Total volume</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-white">
                    {item.data.trades.toLocaleString()} trades
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Avg Score {safeNumber(item.data.avgScore, 0).toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="mb-10 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white mb-2">Share this whale</h2>
              <p className="text-xs text-gray-400">
                Share this performance summary to social media.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <a
                href={shareX}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 font-medium text-gray-200 hover:bg-white/10"
              >
                Share to X
              </a>
              <a
                href={shareTelegram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 font-medium text-gray-200 hover:bg-white/10"
              >
                Share to Telegram
              </a>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-violet-500/60 bg-violet-500/10 px-3 py-1 font-medium text-violet-100 hover:bg-violet-500/20"
              >
                Open share card
              </a>
            </div>
          </div>
        </section>

        <FullAccessGating hasFullAccess={hasFullAccess}>
          <section className="mb-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">30D Performance</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl bg-black/40 border border-white/10 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">
                    30D PnL
                  </div>
                  <div
                    className={`text-2xl font-semibold ${
                      data.performance_30d.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {formatUsd(data.performance_30d.pnl)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Realized over last 30 days</div>
                </div>
                <div className="rounded-xl bg-black/40 border border-white/10 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">
                    30D Win Rate
                  </div>
                  <div className="text-2xl font-semibold text-white">
                    {formatWinRate(data.performance_30d.win_rate, {
                      volume: data.performance_30d.volume,
                      pnl: data.performance_30d.pnl,
                    })}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Closed trades only</div>
                </div>
                <div className="rounded-xl bg-black/40 border border-white/10 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">
                    30D Volume
                  </div>
                  <div className="text-2xl font-semibold text-white">
                    {formatUsd(data.performance_30d.volume)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Tracked whale volume</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-white mb-3">Behavior Summary</h2>
              <div className="space-y-3 text-sm text-gray-300">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-400">
                    Common Action
                  </div>
                  <div className="mt-1 text-white">{data.behavior.common_action}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-400">
                    Avg Trade Size
                  </div>
                  <div className="mt-1">{formatUsd(data.behavior.avg_trade_size)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-400">
                    Side Bias
                  </div>
                  <div className="mt-1 text-white">{data.behavior.side_bias}</div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Top Markets</h2>
                <span className="text-xs text-gray-500">
                  {data.top_markets.length} markets
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-300">
                  <thead className="text-xs uppercase tracking-wide text-gray-500 border-b border-white/10">
                    <tr>
                      <th className="py-2 pr-4 text-left">Market</th>
                      <th className="py-2 px-4 text-right">Trades</th>
                      <th className="py-2 px-4 text-right">Volume</th>
                      <th className="py-2 pl-4 text-right">PnL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.top_markets.map((m, idx) => (
                      <tr key={`${m.market}-${idx}`} className="hover:bg-white/[0.03]">
                        <td className="py-3 pr-4 align-top max-w-xs">
                          <div className="line-clamp-2 text-gray-100 text-sm">
                            {m.market}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-gray-400">
                          {m.trades.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-gray-200">
                          {formatUsd(m.volume)}
                        </td>
                        <td
                          className={`py-3 pl-4 text-right font-mono text-xs ${
                            m.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'
                          }`}
                        >
                          {formatUsd(m.pnl)}
                        </td>
                      </tr>
                    ))}
                    {data.top_markets.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-6 text-center text-sm text-gray-500"
                        >
                          No markets yet for this whale.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Recent Trades</h2>
                <span className="text-xs text-gray-500">
                  {data.recent_trades.length} trades
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-300">
                  <thead className="text-xs uppercase tracking-wide text-gray-500 border-b border-white/10">
                    <tr>
                      <th className="py-2 pr-4 text-left">Time</th>
                      <th className="py-2 px-4 text-left">Market</th>
                      <th className="py-2 px-4 text-right">Action</th>
                      <th className="py-2 px-4 text-right">Side</th>
                      <th className="py-2 px-4 text-right">Size</th>
                      <th className="py-2 pl-4 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.recent_trades.map((t, idx) => (
                      <tr key={`${t.time}-${idx}`} className="hover:bg-white/[0.03]">
                        <td className="py-3 pr-4 align-top text-xs text-gray-400 whitespace-nowrap font-mono">
                          {new Date(t.time).toLocaleString(undefined, {
                            month: 'short',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })}
                        </td>
                        <td className="py-3 px-4 align-top max-w-xs">
                          <div className="line-clamp-2 text-gray-100 text-sm">
                            {t.market}
                          </div>
                        </td>
                        <td className="py-3 px-4 align-top text-right text-xs">
                          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gray-200">
                            {t.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-top text-right text-xs">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                              t.side.toLowerCase() === 'buy'
                                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                                : 'border-rose-500/60 bg-rose-500/10 text-rose-200'
                            }`}
                          >
                            {t.side}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-top text-right font-mono text-xs text-gray-200">
                          {formatUsd(t.size)}
                        </td>
                        <td className="py-3 pl-4 align-top text-right font-mono text-xs text-gray-300">
                          {safeNumber(t.whale_score, 0).toFixed(1)}
                        </td>
                      </tr>
                    ))}
                    {data.recent_trades.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-6 text-center text-sm text-gray-500"
                        >
                          No recent whale trades yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </FullAccessGating>
      </main>

      <Footer />
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'negative';
};

function StatCard({ label, value, hint, tone = 'default' }: StatCardProps) {
  const toneClasses =
    tone === 'positive'
      ? 'text-emerald-300'
      : tone === 'negative'
      ? 'text-rose-300'
      : 'text-white';

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col justify-between">
      <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">
        {label}
      </div>
      <div className={`text-2xl font-semibold ${toneClasses}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function ScoreBar({
  label,
  value,
  tone,
  masked,
  hint,
}: {
  label: string;
  value: number;
  tone: 'violet' | 'emerald' | 'cyan' | 'rose' | 'gray';
  masked?: boolean;
  hint: string;
}) {
  const v = clamp01(value);
  const fill =
    tone === 'emerald'
      ? 'from-emerald-500 to-emerald-300'
      : tone === 'cyan'
      ? 'from-cyan-500 to-cyan-300'
      : tone === 'rose'
      ? 'from-rose-500 to-rose-300'
      : tone === 'gray'
      ? 'from-gray-600 to-gray-400'
      : 'from-violet-500 to-indigo-300';

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
          <div className="text-[11px] text-gray-500 mt-1">{hint}</div>
        </div>
        <div className="text-sm font-mono text-white">
          {masked ? 'Pro' : v.toFixed(0)}
        </div>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-white/5 overflow-hidden ring-1 ring-white/10">
        <div
          className={`h-full bg-gradient-to-r ${fill} ${masked ? 'opacity-30 blur-[1px]' : ''}`}
          style={{ width: `${masked ? 65 : v}%` }}
        />
      </div>
    </div>
  );
}

function WhaleScoreBreakdownCard({
  score,
  breakdown,
  hasFullAccess,
}: {
  score: number;
  breakdown: WhaleScoreBreakdown;
  hasFullAccess: boolean;
}) {
  const hasBreakdown = Boolean(breakdown);
  const masked = !hasFullAccess;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">Whale Score™ Breakdown</div>
          <div className="text-[11px] text-gray-500 mt-1">
            Computed from recent 7/30/90D performance, stability, timing, risk, and market impact.
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2">
          <span className="text-xs text-violet-200">Total</span>
          <span className="text-xl font-semibold text-white tabular-nums">{safeNumber(score, 0).toFixed(0)}</span>
        </div>
      </div>

      {!hasBreakdown ? (
        <div className="text-sm text-gray-400">
          Breakdown is not available for this wallet yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ScoreBar
            label="Performance"
            value={breakdown?.performance ?? 0}
            tone="emerald"
            masked={false}
            hint="Win rate + ROI blended score."
          />
          <ScoreBar
            label="Impact"
            value={breakdown?.impact ?? 0}
            tone="cyan"
            masked={masked}
            hint="Trade size + market liquidity ratio."
          />
          <ScoreBar
            label="Consistency"
            value={breakdown?.consistency ?? 0}
            tone="violet"
            masked={masked}
            hint="Lower volatility and steadier PnL."
          />
          <ScoreBar
            label="Timing"
            value={breakdown?.timing ?? 0}
            tone="gray"
            masked={masked}
            hint="Entry/exit price percentile quality."
          />
          <ScoreBar
            label="Risk"
            value={breakdown?.risk ?? 0}
            tone="rose"
            masked={masked}
            hint="Drawdown + risk/reward ratio."
          />
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400">Access</div>
            <div className="mt-2 text-sm text-gray-300 leading-relaxed">
              {hasFullAccess
                ? 'You have full access to the breakdown.'
                : 'Upgrade to Pro or Elite to unlock full breakdown scores and deep analytics.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
