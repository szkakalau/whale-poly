'use client';

import type { SignalComponent, SignalSource } from '@/lib/prediction-fusion';

// ── Icons & labels per source ─────────────────────────────

const SOURCE_META: Record<SignalSource, { icon: string; label: string; desc: string }> = {
  whale_quality: { icon: '🐋', label: 'Whale Quality', desc: 'Historical whale performance score' },
  behavior:      { icon: '🏗', label: 'Behavior',      desc: 'Current trade pattern detection' },
  vw_analysis:   { icon: '📈', label: 'VW Divergence',  desc: 'Volume-weighted price deviation' },
  flow_direction:{ icon: '🌊', label: 'Flow Direction', desc: 'YES/NO volume ratio & confidence' },
};

function formatSigned(n: number): string {
  if (n > 0) return `+${n.toFixed(1)}`;
  return n.toFixed(1);
}

// ── Sub: single pillar ───────────────────────────────────

function SignalPillar({ signal }: { signal: SignalComponent }) {
  const meta = SOURCE_META[signal.source];
  const isBullish = signal.signedValue > 0;
  const barColor = isBullish ? 'var(--accent)' : signal.signedValue < 0 ? '#D64045' : 'var(--text-tertiary)';
  const pct = Math.round(signal.normalizedValue);

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-surface card-shadow px-4 py-5 text-center">
      {/* Icon */}
      <span className="text-2xl" role="img" aria-label={meta.label}>
        {meta.icon}
      </span>

      {/* Label */}
      <div>
        <p className="text-xs font-semibold text-foreground">{meta.label}</p>
        <p className="text-[10px] text-subtle mt-0.5">{meta.desc}</p>
      </div>

      {/* Normalised bar */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-subtle">强度</span>
          <span className="font-mono text-xs font-semibold tabular-nums stat-number text-foreground">
            {pct}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/8">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%`, backgroundColor: barColor }}
          />
        </div>
      </div>

      {/* Contribution */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-subtle">贡献</span>
        <span
          className="font-mono text-sm font-bold tabular-nums stat-number"
          style={{ color: barColor }}
        >
          {formatSigned(signal.signedValue)}
        </span>
      </div>
    </div>
  );
}

function SignalPillarLocked({ source }: { source: SignalSource }) {
  const meta = SOURCE_META[source];
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-surface/40 border border-dashed border-border px-4 py-5 text-center opacity-50">
      <span className="text-2xl grayscale" role="img" aria-label={meta.label}>
        {meta.icon}
      </span>
      <div>
        <p className="text-xs font-semibold text-muted">{meta.label}</p>
        <p className="text-[10px] text-subtle mt-0.5">{meta.desc}</p>
      </div>
      <span className="rounded border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">
        Pro+
      </span>
    </div>
  );
}

// ── Main component ───────────────────────────────────────

type SignalBreakdownProps = {
  components: SignalComponent[];
  agreementScore: number;
  /** If true, locked sources show upgrade prompt instead of data. */
  isLocked?: boolean;
};

/**
 * Displays 4 signal pillars (whale / behavior / VW / flow) in a responsive 2×2 or 4-col grid.
 * When `isLocked`, whale_quality and vw_analysis show locked placeholders (Free-tier gating).
 */
export default function SignalBreakdown({ components, agreementScore, isLocked = false }: SignalBreakdownProps) {
  const sourceMap = new Map(components.map(c => [c.source, c]));

  // Ordered pillars
  const order: SignalSource[] = ['whale_quality', 'behavior', 'vw_analysis', 'flow_direction'];

  return (
    <div className="space-y-4">
      {/* Agreement bar */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
          Signal Consistency
        </span>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/8">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${agreementScore}%`,
              backgroundColor:
                agreementScore >= 70 ? 'var(--accent)'
                : agreementScore >= 30 ? '#D97706'
                : '#D64045',
            }}
          />
        </div>
        <span className="font-mono text-xs font-semibold tabular-nums stat-number text-foreground min-w-[3ch] text-right">
          {agreementScore}%
        </span>
      </div>

      {/* Pillars grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {order.map(source => {
          const signal = sourceMap.get(source);
          if (!signal || isLocked && (source === 'whale_quality' || source === 'vw_analysis')) {
            return <SignalPillarLocked key={source} source={source} />;
          }
          return <SignalPillar key={source} signal={signal} />;
        })}
      </div>
    </div>
  );
}
