'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import UpgradeModal from '@/components/UpgradeModal';

type Item = {
  wallet: string;
  volume: number;
  profit: number;
  roi: number;
};

type Props = {
  initialItems: Item[];
  initialOrderBy: 'PNL' | 'VOL' | 'ROI';
};

export default function SmartMoneyClient({ initialItems, initialOrderBy }: Props) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [orderBy, setOrderBy] = useState<'PNL' | 'VOL' | 'ROI'>(initialOrderBy);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState({ title: '', description: '', feature: '' });
  const [timePeriod, setTimePeriod] = useState<'DAY' | 'WEEK' | 'MONTH' | 'ALL'>('MONTH');
  const [category, setCategory] = useState<'OVERALL' | 'POLITICS' | 'SPORTS' | 'CRYPTO' | 'CULTURE' | 'MENTIONS' | 'WEATHER' | 'ECONOMICS' | 'TECH' | 'FINANCE'>('OVERALL');
  const timeLabels: Record<typeof timePeriod, string> = {
    DAY: 'Last 24 hours',
    WEEK: 'Last 7 days',
    MONTH: 'Last 30 days',
    ALL: 'All-time',
  };
  const categoryLabels: Record<typeof category, string> = {
    OVERALL: 'All Markets',
    POLITICS: 'Politics',
    SPORTS: 'Sports',
    CRYPTO: 'Crypto',
    CULTURE: 'Culture',
    MENTIONS: 'Mentions',
    WEATHER: 'Weather',
    ECONOMICS: 'Economics',
    TECH: 'Tech',
    FINANCE: 'Finance',
  };

  const tableRows: Item[] = pending
    ? Array.from({ length: 8 }, (_, idx) => ({
        wallet: `loading-${idx}`,
        volume: 0,
        profit: 0,
        roi: 0,
      }))
    : items;

  useEffect(() => {
    const controller = new AbortController();
    startTransition(() => {
      setError(null);
      const params = new URLSearchParams({ orderBy, limit: '25', timePeriod, category });
      fetch(`/api/smart-money/leaderboard?${params.toString()}`, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`failed ${res.status}`);
          }
          const data = await res.json();
          setItems(Array.isArray(data.items) ? data.items : []);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setError('Failed to load leaderboard. Please try again.');
          }
        });
    });
    return () => controller.abort();
  }, [orderBy, timePeriod, category]);

  const subscribeSmartCollection = () => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch('/api/smart-collections/high_pnl_whales/subscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
        });
        if (res.ok) {
          setUpgradeInfo({
            title: 'Subscribed to Smart Money collection',
            description: 'You will receive real-time alerts for wallets in this collection.',
            feature: 'Smart Money Alerts',
          });
          setShowUpgrade(true);
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) {
          setUpgradeInfo({
            title: 'Upgrade to subscribe',
            description: data.message || 'This feature is available for Pro or Elite plans only.',
            feature: 'Smart Money Collections',
          });
          setShowUpgrade(true);
          return;
        }
        setError('Subscription failed. Please try again.');
      } catch {
        setError('Network error. Please try again.');
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Recommended</p>
          <h2 className="text-lg font-semibold text-white">Start with Smart Collections</h2>
          <p className="text-xs text-gray-400 mt-1">
            Get diversified whale alerts without manually picking individual wallets.
          </p>
        </div>
        <Link
          href="/smart-collections"
          className="inline-flex items-center rounded-full border border-violet-500/60 bg-violet-500/10 px-4 py-2 text-xs font-medium text-violet-100 hover:bg-violet-500/20"
        >
          Explore Smart Collections
        </Link>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOrderBy('PNL')}
            className={`text-xs rounded-full border px-3 py-1 ${
              orderBy === 'PNL' ? 'border-violet-500/60 bg-violet-500/20 text-violet-100' : 'border-white/15 text-gray-300'
            }`}
          >
            Sort by Profit
          </button>
          <button
            type="button"
            onClick={() => setOrderBy('VOL')}
            className={`text-xs rounded-full border px-3 py-1 ${
              orderBy === 'VOL' ? 'border-violet-500/60 bg-violet-500/20 text-violet-100' : 'border-white/15 text-gray-300'
            }`}
          >
            Sort by Volume
          </button>
          <button
            type="button"
            onClick={() => setOrderBy('ROI')}
            className={`text-xs rounded-full border px-3 py-1 ${
              orderBy === 'ROI' ? 'border-violet-500/60 bg-violet-500/20 text-violet-100' : 'border-white/15 text-gray-300'
            }`}
          >
            Sort by ROI
          </button>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value as typeof timePeriod)}
            className="text-xs rounded-full border border-white/15 bg-black/40 px-3 py-1 text-gray-200"
          >
            <option value="DAY">Day</option>
            <option value="WEEK">Week</option>
            <option value="MONTH">Month</option>
            <option value="ALL">All</option>
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="text-xs rounded-full border border-white/15 bg-black/40 px-3 py-1 text-gray-200"
          >
            <option value="OVERALL">Overall</option>
            <option value="POLITICS">Politics</option>
            <option value="SPORTS">Sports</option>
            <option value="CRYPTO">Crypto</option>
            <option value="CULTURE">Culture</option>
            <option value="MENTIONS">Mentions</option>
            <option value="WEATHER">Weather</option>
            <option value="ECONOMICS">Economics</option>
            <option value="TECH">Tech</option>
            <option value="FINANCE">Finance</option>
          </select>
        </div>
        <button
          type="button"
          onClick={subscribeSmartCollection}
          disabled={pending}
          className="inline-flex items-center rounded-full border border-violet-500/60 bg-violet-500/20 px-4 py-1.5 text-xs font-medium text-violet-50 hover:bg-violet-500/30"
        >
          Subscribe (High PnL Whales)
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/50 p-3 flex items-center justify-between gap-3">
          <p className="text-xs text-red-200">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="shrink-0 inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-gray-100 hover:bg-white/10"
          >
            Reload
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Methodology</h3>
            <p className="text-xs text-gray-400">
              Rankings are aggregated by the selected time period and category. Profit/ROI/Volume are aggregated values.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-gray-300">
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1">
              {timeLabels[timePeriod]}
            </span>
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1">
              {categoryLabels[category]}
            </span>
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1">
              Sort: {orderBy === 'PNL' ? 'Profit' : orderBy === 'ROI' ? 'ROI' : 'Volume'}
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
        <table className="w-full text-sm text-gray-300">
          <thead className="text-xs uppercase tracking-wide text-gray-500 border-b border-white/10">
            <tr>
              <th className="py-2 pl-4 text-left">Wallet</th>
              <th className="py-2 px-4 text-right">Profit (USD)</th>
              <th className="py-2 px-4 text-right">ROI</th>
              <th className="py-2 pr-4 text-right">Volume (USD)</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((it) => (
              <tr key={it.wallet} className="border-b border-white/5">
                <td className="py-2 pl-4 font-mono text-xs">
                  {pending ? (
                    <div className="h-4 w-44 rounded bg-white/10" />
                  ) : (
                    <Link
                      href={`/whales/${encodeURIComponent(it.wallet)}`}
                      className="text-violet-300 hover:text-violet-200 underline underline-offset-2"
                    >
                      {it.wallet}
                    </Link>
                  )}
                </td>
                <td className="py-2 px-4 text-right">
                  {pending ? <div className="ml-auto h-4 w-20 rounded bg-white/10" /> : Math.round(it.profit).toLocaleString()}
                </td>
                <td className="py-2 px-4 text-right">
                  {pending ? <div className="ml-auto h-4 w-14 rounded bg-white/10" /> : `${(it.roi * 100).toFixed(2)}%`}
                </td>
                <td className="py-2 pr-4 text-right">
                  {pending ? <div className="ml-auto h-4 w-20 rounded bg-white/10" /> : Math.round(it.volume).toLocaleString()}
                </td>
              </tr>
            ))}
            {!pending && items.length === 0 && (
              <tr>
                <td className="py-6 px-4 text-center text-gray-400" colSpan={4}>
                  No data yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <UpgradeModal 
        isOpen={showUpgrade} 
        onClose={() => setShowUpgrade(false)}
        title={upgradeInfo.title}
        description={upgradeInfo.description}
        feature={upgradeInfo.feature}
      />
    </div>
  );
}
