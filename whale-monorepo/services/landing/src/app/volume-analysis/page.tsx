'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Loader2 } from 'lucide-react';
import { getVwMetrics, VwMetricsRow } from '@/lib/vw-signals';
import { useAuth } from '@/lib/use-auth';
import FullAccessGating from '@/components/FullAccessGating';
import MarketCard from './MarketCard';
import DetailDrawer from './DetailDrawer';

export default function VolumeAnalysisPage() {
  const { user, plan, loading: authLoading } = useAuth();
  const [markets, setMarkets] = useState<VwMetricsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'volume' | 'divergence' | 'strength'>('volume');
  const [selected, setSelected] = useState<VwMetricsRow | null>(null);

  useEffect(() => {
    getVwMetrics(sortBy).then(setMarkets).finally(() => setLoading(false));
  }, [sortBy]);

  // Show loading while auth is being resolved
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    );
  }

  // Plan gating - Free users do not have access
  const hasAccess = plan === 'PRO' || plan === 'ELITE';

  return (
    <FullAccessGating
      hasFullAccess={hasAccess}
      title="量价分析频道"
      description="升级到 Pro 或 Elite 以访问量价分析频道。"
    >
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp size={22} className="text-emerald-500" />
              量价分析
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              基于成交量加权价格的市场情绪探测
            </p>
          </div>

          {/* Sort controls */}
          <div className="flex gap-2 mb-4">
            {(['volume', 'divergence', 'strength'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 ease-out
                  ${sortBy === key ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'}`}
              >
                {{ volume: '按成交额', divergence: '按偏离度', strength: '按信号强度' }[key]}
              </button>
            ))}
          </div>

          {/* Market list */}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-gray-400" size={28} />
            </div>
          ) : markets.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-sm">
              暂无活跃市场数据，请稍后再试
            </div>
          ) : (
            <div className="space-y-3">
              {markets.map((m) => (
                <MarketCard
                  key={m.marketId}
                  data={m}
                  onSelect={() => setSelected(m)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail Drawer */}
        {selected && (
          <DetailDrawer
            market={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </FullAccessGating>
  );
}
