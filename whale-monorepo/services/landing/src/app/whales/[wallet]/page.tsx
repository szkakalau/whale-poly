import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WhaleFollowButton from '@/components/WhaleFollowButton';
import FullAccessGating from '@/components/FullAccessGating';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { canAccessFeature } from '@/lib/plans';

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

type WhaleProfileResponse = {
  wallet: string;
  display_name: string;
  whale_score: number;
  rank: number;
  stats: WhaleStats;
  performance_30d: WhalePerformance30d;
  top_markets: WhaleTopMarket[];
  recent_trades: WhaleRecentTrade[];
  behavior: WhaleBehavior;
};

type PageProps = {
  params: Promise<{ wallet: string }>;
};

const WHALE_ENGINE_BASE =
  process.env.NEXT_PUBLIC_WHALE_ENGINE_API_BASE_URL || 'https://whale-engine-api.onrender.com';
const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://sightwhale.com';

export const revalidate = 0;

async function fetchWhaleProfile(wallet: string): Promise<WhaleProfileResponse | null> {
  const base = WHALE_ENGINE_BASE.replace(/\/$/, '');
  const res = await fetch(`${base}/whales/${encodeURIComponent(wallet)}`, {
    cache: 'no-store',
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as WhaleProfileResponse;
  return data;
}

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
      url: `https://sightwhale.com/whales/${wallet}`,
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
  const shareUrl = `${SITE_BASE.replace(/\/$/, '')}/whales/${encodeURIComponent(data.wallet)}`;
  const shareText = `Whale ${data.display_name} · Score ${data.whale_score.toFixed(
    1,
  )} · 30D PnL ${formatUsd(data.performance_30d.pnl)}`;
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
                    {data.whale_score.toFixed(1)}
                  </span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/50 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
                  Rank
                  <span className="text-sm font-semibold text-white">#{data.rank}</span>
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
            value={formatPercent(data.stats.win_rate)}
            hint="Closed positions"
          />
          <StatCard
            label="Realized PnL"
            value={formatUsd(data.stats.realized_pnl)}
            hint="Across settled markets"
            tone={data.stats.realized_pnl >= 0 ? 'positive' : 'negative'}
          />
        </section>

        <section className="mb-10 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">最近交易</div>
            <div className="text-lg font-semibold text-white">
              {formatDateTime(lastTradeTime)}
            </div>
            <div className="text-xs text-gray-500 mt-2">用于衡量活跃度与新鲜度</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">样本覆盖</div>
            <div className="text-lg font-semibold text-white">
              {data.stats.total_trades.toLocaleString()} trades
            </div>
            <div className="text-xs text-gray-500 mt-2">统计鲸鱼级别交易次数</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">行为特征</div>
            <div className="text-lg font-semibold text-white">{data.behavior.common_action}</div>
            <div className="text-xs text-gray-500 mt-2">
              {data.behavior.side_bias} bias · Avg {formatUsd(data.behavior.avg_trade_size)}
            </div>
          </div>
        </section>

        <section className="mb-10 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            { label: '近 7 天', data: perf7d },
            { label: '近 30 天', data: perf30d },
            { label: '近 90 天', data: perf90d },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-3"
            >
              <div className="text-xs uppercase tracking-wide text-gray-400">{item.label}表现</div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-2xl font-semibold text-white">
                    {formatUsd(item.data.volume)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">累计成交额</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-white">
                    {item.data.trades.toLocaleString()} trades
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Avg Score {item.data.avgScore.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="mb-10 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white mb-2">分享这位鲸鱼</h2>
              <p className="text-xs text-gray-400">
                将这张表现摘要转发到社交媒体，吸引更多关注与复访。
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <a
                href={shareX}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 font-medium text-gray-200 hover:bg-white/10"
              >
                分享到 X
              </a>
              <a
                href={shareTelegram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 font-medium text-gray-200 hover:bg-white/10"
              >
                分享到 Telegram
              </a>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-violet-500/60 bg-violet-500/10 px-3 py-1 font-medium text-violet-100 hover:bg-violet-500/20"
              >
                打开分享卡
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
                    {formatPercent(data.performance_30d.win_rate)}
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
                          {t.whale_score.toFixed(1)}
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
