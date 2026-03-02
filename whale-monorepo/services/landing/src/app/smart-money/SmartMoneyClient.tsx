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

  useEffect(() => {
    startTransition(() => {
      const params = new URLSearchParams({ orderBy, limit: '25', timePeriod, category });
      fetch(`/api/smart-money/leaderboard?${params.toString()}`, { cache: 'no-store' })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`failed ${res.status}`);
          }
          const data = await res.json();
          setItems(Array.isArray(data.items) ? data.items : []);
        })
        .catch(() => {
          setError('加载榜单失败，请稍后重试');
        });
    });
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
            title: '已订阅 Smart Money 集合',
            description: '您将收到该集合中钱包的实时告警。',
            feature: 'Smart Money Alerts',
          });
          setShowUpgrade(true);
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) {
          setUpgradeInfo({
            title: '升级以订阅',
            description: data.message || '该功能仅限 Pro 或 Elite 计划用户使用。',
            feature: 'Smart Money Collections',
          });
          setShowUpgrade(true);
          return;
        }
        setError('订阅失败，请稍后重试');
      } catch {
        setError('网络错误，请稍后重试');
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOrderBy('PNL')}
            className={`text-xs rounded-full border px-3 py-1 ${
              orderBy === 'PNL' ? 'border-violet-500/60 bg-violet-500/20 text-violet-100' : 'border-white/15 text-gray-300'
            }`}
          >
            按 Profit
          </button>
          <button
            type="button"
            onClick={() => setOrderBy('VOL')}
            className={`text-xs rounded-full border px-3 py-1 ${
              orderBy === 'VOL' ? 'border-violet-500/60 bg-violet-500/20 text-violet-100' : 'border-white/15 text-gray-300'
            }`}
          >
            按 Volume
          </button>
          <button
            type="button"
            onClick={() => setOrderBy('ROI')}
            className={`text-xs rounded-full border px-3 py-1 ${
              orderBy === 'ROI' ? 'border-violet-500/60 bg-violet-500/20 text-violet-100' : 'border-white/15 text-gray-300'
            }`}
          >
            按 ROI
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
          订阅集合（High PnL Whales）
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/50 p-3">
          <p className="text-xs text-red-200">{error}</p>
        </div>
      )}

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
            {items.map((it) => (
              <tr key={it.wallet} className="border-b border-white/5">
                <td className="py-2 pl-4 font-mono text-xs">
                  <Link href={`/whales/${encodeURIComponent(it.wallet)}`} className="text-violet-300 hover:text-violet-200 underline underline-offset-2">
                    {it.wallet}
                  </Link>
                </td>
                <td className="py-2 px-4 text-right">{Math.round(it.profit).toLocaleString()}</td>
                <td className="py-2 px-4 text-right">{(it.roi * 100).toFixed(2)}%</td>
                <td className="py-2 pr-4 text-right">{Math.round(it.volume).toLocaleString()}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="py-6 px-4 text-center text-gray-400" colSpan={4}>
                  暂无数据
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
