'use client';

import type { FusionResult } from '@/lib/prediction-fusion';

// ── Helpers ──────────────────────────────────────────────

const RING_R = 56;
const RING_C = 2 * Math.PI * RING_R;
const RING_SIZE = 140;
const RING_CENTER = RING_SIZE / 2;

function directionLabel(d: string): string {
  switch (d) {
    case 'bullish': return '看涨';
    case 'bearish': return '看跌';
    case 'mixed': return '分歧';
    default: return '中性';
  }
}

function directionColor(d: string): string {
  switch (d) {
    case 'bullish': return 'var(--accent)';
    case 'bearish': return '#D64045';
    case 'mixed': return '#D97706';
    default: return 'var(--text-tertiary)';
  }
}

function confidenceLabel(level: string): string {
  switch (level) {
    case 'high': return 'High Confidence';
    case 'medium': return 'Medium Confidence';
    default: return 'Low Confidence';
  }
}

// ── Sub-components ───────────────────────────────────────

function RingGauge({ score, direction }: { score: number; direction: string }) {
  const offset = RING_C - (score / 100) * RING_C;
  const color = directionColor(direction);

  return (
    <svg
      width={RING_SIZE}
      height={RING_SIZE}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      className="shrink-0"
      aria-label={`Score: ${score} out of 100`}
    >
      {/* Background track */}
      <circle
        cx={RING_CENTER}
        cy={RING_CENTER}
        r={RING_R}
        fill="none"
        stroke="var(--border-color)"
        strokeWidth="8"
      />
      {/* Score arc */}
      <circle
        cx={RING_CENTER}
        cy={RING_CENTER}
        r={RING_R}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={RING_C}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
      />
      {/* Center text */}
      <text
        x={RING_CENTER}
        y={RING_CENTER - 6}
        textAnchor="middle"
        className="fill-foreground"
        style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700 }}
      >
        {score}
      </text>
      <text
        x={RING_CENTER}
        y={RING_CENTER + 18}
        textAnchor="middle"
        className="fill-subtle"
        style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em' }}
      >
        / 100
      </text>
    </svg>
  );
}

function ProgressBar({ score, direction }: { score: number; direction: string }) {
  const color = directionColor(direction);
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-foreground/8 ring-1 ring-border">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.round(score)}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="font-mono text-lg font-bold tabular-nums stat-number"
        style={{ color }}
      >
        {Math.round(score)}
      </span>
    </div>
  );
}

// ── Main component ───────────────────────────────────────

type PredictionGaugeProps = {
  prediction: FusionResult;
  /** Show compact variant (progress bar instead of ring) — use on mobile or tight spaces. */
  compact?: boolean;
};

/**
 * Displays a fusion prediction score as either a SVG ring gauge (default, desktop)
 * or a horizontal progress bar (compact, mobile / inline).
 */
export default function PredictionGauge({ prediction, compact = false }: PredictionGaugeProps) {
  const { compositeScore, direction, confidenceLevel } = prediction;
  const dirLabel = directionLabel(direction);
  const dirColor = directionColor(direction);

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: `${dirColor}18`, color: dirColor, border: `1px solid ${dirColor}40` }}
          >
            {dirLabel}
          </span>
          <span className="text-[11px] text-subtle">{confidenceLabel(confidenceLevel)}</span>
        </div>
        <ProgressBar score={compositeScore} direction={direction} />
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
      {/* Ring */}
      <RingGauge score={compositeScore} direction={direction} />

      {/* Labels */}
      <div className="flex flex-col items-center sm:items-start gap-2 text-center sm:text-left">
        <span
          className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
          style={{ backgroundColor: `${dirColor}18`, color: dirColor, border: `1px solid ${dirColor}40` }}
        >
          {dirLabel}
        </span>
        <p className="text-sm text-subtle">{confidenceLabel(confidenceLevel)}</p>
        <p className="text-xs text-muted">
          综合评分 <span className="font-mono stat-number text-foreground">{compositeScore}</span>/100
        </p>
      </div>
    </div>
  );
}
