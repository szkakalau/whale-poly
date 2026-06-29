'use client';

import { VwMetricsRow } from '@/lib/vw-client';
import { useLocale } from '@/lib/vw-i18n';

interface Props {
  data: VwMetricsRow;
  onSelect: (marketId: string) => void;
}

export default function MarketCard({ data, onSelect }: Props) {
  const { t } = useLocale();

  const div = data.vwDivergence ?? 0;
  const directionColor = data.signalDirection === 'bullish'
    ? 'text-emerald-600'
    : data.signalDirection === 'bearish'
    ? 'text-red-600'
    : 'text-gray-500';
  const directionBg = data.signalDirection === 'bullish'
    ? 'bg-emerald-50'
    : data.signalDirection === 'bearish'
    ? 'bg-red-50'
    : 'bg-gray-50';

  const signalLabel = data.signalDirection === 'bullish'
    ? t('signal.bullish')
    : data.signalDirection === 'bearish'
    ? t('signal.bearish')
    : t('signal.neutral');

  const fmtUsd = (v: number) =>
    v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000 ? `$${(v / 1_000).toFixed(1)}K`
    : `$${v.toFixed(0)}`;

  return (
    <div
      className="p-4 rounded-xl border border-gray-100 hover:border-gray-200
                 transition-colors duration-200 ease-out cursor-pointer bg-white"
      onClick={() => onSelect(data.marketId)}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 flex-1">
          {data.marketTitle}
        </h3>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${directionBg} ${directionColor}`}>
          {signalLabel}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>{t('card.volume')} {fmtUsd(data.totalVolumeUsd)}</span>
        <span>
          {t('card.strength')} {data.signalStrength ?? '-'}
        </span>
        <span>YES {fmtUsd(data.yesVolumeUsd)} / NO {fmtUsd(data.noVolumeUsd)}</span>
        <span>
          {t('card.price')} {(data.yesMarketPrice ?? 0) * 100 | 0}¢
          {' · '}
          VW {(data.yesVwPrice ?? 0) * 100 | 0}¢
        </span>
      </div>

      <div className="mt-2 flex items-center gap-3 text-xs">
        <span className={`font-mono ${directionColor}`}>
          {t('card.divergence')} {div > 0 ? '+' : ''}{(div * 100).toFixed(1)}%
        </span>
        {data.uai != null && (
          <span className="text-gray-400">
            {t('card.uai')} {data.uai.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}
