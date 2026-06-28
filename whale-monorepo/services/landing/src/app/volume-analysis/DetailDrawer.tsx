'use client';

import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { getVwSnapshots, getCrossSignals, VwSnapshotPoint, CrossSignal, VwMetricsRow } from '@/lib/vw-signals';
import DivergenceChart from './DivergenceChart';

interface Props {
  market: VwMetricsRow;
  onClose: () => void;
}

export default function DetailDrawer({ market, onClose }: Props) {
  const [snapshots, setSnapshots] = useState<VwSnapshotPoint[]>([]);
  const [cross, setCross] = useState<CrossSignal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [snaps, cs] = await Promise.all([
        getVwSnapshots(market.marketId),
        getCrossSignals(market.marketId),
      ]);
      setSnapshots(snaps);
      setCross(cs);
      setLoading(false);
    }
    load();
  }, [market.marketId]);

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-50
                    flex flex-col transition-transform duration-200 ease-out">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-sm text-gray-900 line-clamp-1 flex-1 mr-3">
          {market.marketTitle}
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors duration-200 ease-out">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        ) : (
          <>
            {/* 走势图 */}
            <section>
              <h3 className="text-xs font-medium text-gray-500 mb-3">量价走势</h3>
              <DivergenceChart snapshots={snapshots} />
            </section>

            {/* 交叉信号 */}
            {cross && (
              <section>
                <h3 className="text-xs font-medium text-gray-500 mb-3">交叉信号</h3>
                <div className="rounded-lg bg-gray-50 p-4 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">VW 信号</span>
                    <span className={cross.vwDirection === 'bullish' ? 'text-emerald-600' : 'text-red-600'}>
                      {cross.vwDirection === 'bullish' ? '🟢 偏多' : '🔴 偏空'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Whale 信号</span>
                    <span className={cross.whaleDirection === 'bullish' ? 'text-emerald-600' : 'text-red-600'}>
                      {cross.whaleDirection === 'bullish' ? '🟢 做多' : '🔴 做空'}
                    </span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-gray-500">交叉判断</span>
                    <span>
                      置信度：
                      <span className={
                        cross.confidenceLevel === 'high' ? 'text-emerald-600'
                        : cross.confidenceLevel === 'low' ? 'text-red-600'
                        : 'text-amber-600'
                      }>
                        {cross.confidenceLevel === 'high' ? '高 ✓'
                         : cross.confidenceLevel === 'low' ? '低 ⚠️'
                         : '中'}
                      </span>
                    </span>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
