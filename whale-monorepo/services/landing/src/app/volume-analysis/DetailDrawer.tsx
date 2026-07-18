'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { X, Loader2 } from 'lucide-react';
import { getVwSnapshotsApi, getCrossSignalsApi, VwSnapshotPoint, CrossSignal, VwMetricsRow } from '@/lib/vw-client';
import { useLocale } from '@/lib/vw-i18n';

// Lazy-load recharts (~150KB gzipped) only when the drawer opens (PF-H9).
const DivergenceChart = dynamic(() => import('./DivergenceChart'), { ssr: false });

interface Props {
  market: VwMetricsRow;
  onClose: () => void;
}

export default function DetailDrawer({ market, onClose }: Props) {
  const { t } = useLocale();
  const [snapshots, setSnapshots] = useState<VwSnapshotPoint[]>([]);
  const [cross, setCross] = useState<CrossSignal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [snaps, cs] = await Promise.all([
        getVwSnapshotsApi(market.marketId),
        getCrossSignalsApi(market.marketId),
      ]);
      setSnapshots(snaps);
      setCross(cs);
      setLoading(false);
    }
    load();
  }, [market.marketId]);

  const vwDirectionColor =
    cross?.vwDirection === 'bullish' ? 'text-accent' : cross?.vwDirection === 'bearish' ? 'text-red-500' : 'text-muted';

  const whaleDirectionColor =
    cross?.whaleDirection === 'bullish' ? 'text-accent' : cross?.whaleDirection === 'bearish' ? 'text-red-500' : 'text-muted';

  const confidenceColor =
    cross?.confidenceLevel === 'high'
      ? 'text-accent'
      : cross?.confidenceLevel === 'low'
        ? 'text-red-500'
        : 'text-amber-500';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity duration-200 ease-out"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <div
        className="fixed inset-y-0 right-0 w-full max-w-lg bg-background border-l border-border
                    shadow-2xl z-50 flex flex-col transition-transform duration-200 ease-out"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-sm text-foreground line-clamp-1 flex-1 mr-3">
            {market.marketTitle}
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground transition-colors duration-200 ease-out"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-muted" size={24} />
            </div>
          ) : (
            <>
              {/* Divergence chart */}
              <section>
                <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
                  {t('drawer.title')}
                </h3>
                <DivergenceChart snapshots={snapshots} />
              </section>

              {/* Cross signal */}
              {cross && (
                <section>
                  <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
                    {t('drawer.crossSignal')}
                  </h3>
                  <div className="rounded-lg bg-surface card-shadow p-4 text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted">{t('drawer.vwSignal')}</span>
                      <span className={vwDirectionColor}>
                        {cross.vwDirection === 'bullish'
                          ? `🟢 ${t('signal.bullish')}`
                          : cross.vwDirection === 'bearish'
                            ? `🔴 ${t('signal.bearish')}`
                            : t('signal.neutral')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">{t('drawer.whaleSignal')}</span>
                      <span className={whaleDirectionColor}>
                        {cross.whaleDirection === 'bullish'
                          ? `🟢 ${t('drawer.long')}`
                          : cross.whaleDirection === 'bearish'
                            ? `🔴 ${t('drawer.short')}`
                            : t('signal.neutral')}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium pt-2 border-t border-border-muted">
                      <span className="text-muted">{t('drawer.crossVerdict')}</span>
                      <span>
                        {t('drawer.confidence')}：
                        <span className={confidenceColor}>
                          {cross.confidenceLevel === 'high'
                            ? t('drawer.confidenceHigh')
                            : cross.confidenceLevel === 'low'
                              ? t('drawer.confidenceLow')
                              : t('drawer.confidenceMedium')}
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
    </>
  );
}
