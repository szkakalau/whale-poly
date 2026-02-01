import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const metadata = {
  title: 'My Followed Whales - Sight Whale',
  description: 'View and manage the whales you follow and their latest activity.',
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
};

const WHALE_ENGINE_BASE =
  process.env.NEXT_PUBLIC_WHALE_ENGINE_API_BASE_URL || 'https://whale-engine-api.onrender.com';

async function getFollowRows(): Promise<FollowRow[]> {
  const user = await getCurrentUser();
  if (!user) {
    return [];
  }
  const rows = await prisma.whaleFollow.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  return rows;
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
    };
  }
  const data = (await res.json()) as {
    whale_score?: number;
    recent_trades?: { time?: string }[];
  };
  const whaleScore =
    typeof data.whale_score === 'number' && Number.isFinite(data.whale_score)
      ? data.whale_score
      : null;
  const last = Array.isArray(data.recent_trades) && data.recent_trades.length > 0
    ? data.recent_trades[0]
    : null;
  const lastTradeTime = last && typeof last.time === 'string' ? last.time : null;
  return {
    wallet,
    whaleScore,
    lastTradeTime,
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

export default async function FollowPage() {
  const rows = await getFollowRows();
  const summaries = await Promise.all(rows.map((row) => fetchWhaleSummary(row.wallet)));
  const byWallet = new Map(summaries.map((s) => [s.wallet.toLowerCase(), s]));

  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-15%] w-[45%] h-[45%] bg-violet-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[45%] h-[45%] bg-cyan-500/10 rounded-full blur-[140px]" />
      </div>

      <Header />

      <main className="mx-auto max-w-5xl px-6 pt-32 pb-24 relative">
        <section className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">My Followed Whales</h1>
          <p className="text-gray-400 text-sm max-w-2xl">
            View wallets you follow, their current whale score, and recent activity.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          {rows.length === 0 ? (
            <div className="text-sm text-gray-400">
              You are not following any whales yet.{' '}
              <Link href="/" className="text-violet-300 hover:text-violet-200 underline">
                Browse whales from the landing page
              </Link>{' '}
              or open a whale profile to start following.
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

