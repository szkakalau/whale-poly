'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { VwSnapshotPoint } from '@/lib/vw-client';
import { useLocale } from '@/lib/vw-i18n';

interface Props {
  snapshots: VwSnapshotPoint[];
}

export default function DivergenceChart({ snapshots }: Props) {
  const { t } = useLocale();

  const data = snapshots.map((s) => ({
    time: new Date(s.snapshotAt).toLocaleTimeString('zh-CN', {
      hour: '2-digit', minute: '2-digit',
    }),
    vwYesShare: (s.yesMarketPrice ?? 0) + (s.vwDivergence ?? 0),
    priceYes: s.yesMarketPrice ?? 0,
    divergence: s.vwDivergence ?? 0,
  }));

  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-gray-400 text-sm">{t('chart.noData')}</div>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="time" tick={{ fontSize: 11 }} />
          <YAxis
            domain={[0, 1]}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
          />
          <Tooltip
            formatter={(value, name) => {
              const n = Number(value);
              if (name === 'vwYesShare') return [`${(n * 100).toFixed(1)}%`, t('chart.legendVw')];
              if (name === 'priceYes') return [`${(n * 100).toFixed(1)}%`, t('chart.legendPrice')];
              return [n, String(name)];
            }}
          />
          <ReferenceLine
            y={data[0]?.priceYes}
            stroke="#9CA3AF"
            strokeDasharray="5 5"
            label={t('chart.reference')}
          />
          <Line
            type="monotone"
            dataKey="vwYesShare"
            stroke="#10B981"
            strokeWidth={2}
            dot={false}
            name="vwYesShare"
          />
          <Line
            type="monotone"
            dataKey="priceYes"
            stroke="#9CA3AF"
            strokeWidth={1.5}
            dot={false}
            name="priceYes"
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-6 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-emerald-500 inline-block" /> {t('chart.legendVw')}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-gray-400 inline-block" /> {t('chart.legendPrice')}
        </span>
      </div>
    </div>
  );
}
