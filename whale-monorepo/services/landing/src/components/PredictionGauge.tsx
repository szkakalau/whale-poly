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

function RingGauge({ score, probability, direction }: { score: number; probability: number | null; direction: string }) {
  const displayValue = probability != null ? Math.round(probability * 100) : score;
  const offset = RING_C - (displayValue / 100) * RING_C;
  const color = directionColor(direction);

  return (
    <svg
      width={RING_SIZE}
      height={RING_SIZE}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      className="shrink-0"
      aria-label={probability != null ? `P(YES): ${displayValue}%` : `Score: ${score} out of 100`}
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
        y={RING_CENTER - 4}
        textAnchor="middle"
        className="fill-foreground"
        style={{ fontFamily: 'var(--font-mono)', fontSize: '26px', fontWeight: 700 }}
      >
        {displayValue}%
      </text>
      <text
        x={RING_CENTER}
        y={RING_CENTER + 18}
        textAnchor="middle"
        className="fill-subtle"
        style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em' }}
      >
        P(YES)
      </text>
    </svg>
  );
}

function ProgressBar({ score, probability, direction }: { score: number; probability: number | null; direction: string }) {
  const displayValue = probability != null ? Math.round(probability * 100) : Math.round(score);
  const color = directionColor(direction);
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-foreground/8 ring-1 ring-border">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${displayValue}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="font-mono text-lg font-bold tabular-nums stat-number"
        style={{ color }}
      >
        {displayValue}%
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
  const { compositeScore, direction, confidenceLevel, probability } = prediction;
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
        <ProgressBar score={compositeScore} probability={probability} direction={direction} />
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
      {/* Ring */}
      <RingGauge score={compositeScore} probability={probability} direction={direction} />

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
          预测概率 <span className="font-mono stat-number text-foreground">
            {probability != null ? `${Math.round(probability * 100)}%` : '—'}
          </span> P(YES)
          {probability != null && (
            <span className="ml-1 text-[10px] opacity-50">· 评分 {compositeScore}</span>
          )}
        </p>
      </div>
    </div>
  );
}
