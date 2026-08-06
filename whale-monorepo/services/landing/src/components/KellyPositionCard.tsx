'use client';

import { useState } from 'react';
import type { KellyResult } from '@/lib/position-sizing';

// ── Helpers ──────────────────────────────────────────────

function formatPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function confidenceColor(level: KellyResult['confidence']): string {
  switch (level) {
    case 'high': return 'var(--accent)';
    case 'medium': return '#D97706';
    default: return '#D64045';
  }
}

// ── Sub: position bar ────────────────────────────────────

function PositionBar({ fraction, label, muted = false }: { fraction: number; label: string; muted?: boolean }) {
  const pct = Math.min(fraction * 100, 100);
  return (
    <div className="flex items-center gap-3">
      <span className={`text-[11px] font-semibold min-w-[7rem] ${muted ? 'text-subtle' : 'text-foreground'}`}>
        {label}
      </span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-foreground/8">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${muted ? 'opacity-40' : ''}`}
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: 'var(--accent)' }}
        />
      </div>
      <span className={`font-mono text-xs tabular-nums stat-number min-w-[5ch] text-right ${muted ? 'text-subtle' : 'text-foreground font-semibold'}`}>
        {formatPct(fraction)}
      </span>
    </div>
  );
}

// ── Main component ───────────────────────────────────────

type KellyPositionCardProps = {
  result: KellyResult;
  score: number;
  marketSlug?: string;
};

/**
 * Displays a Kelly Criterion position sizing recommendation.
 * Elite-tier feature — shows Full/Half/Quarter Kelly fractions
 * with a recommendation, edge, and disclaimer.
 */
export default function KellyPositionCard({ result, score, marketSlug }: KellyPositionCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const color = confidenceColor(result.confidence);

  if (result.recommendedFraction === 0) {
    // No edge — minimal display
    return (
      <div className="rounded-xl bg-surface card-shadow px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-foreground">仓位建议：观望</p>
            <p className="text-xs text-subtle mt-1">{result.suggestion}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface card-shadow overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">💰</span>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">Kelly 仓位建议</p>
            <p className="text-[11px] text-subtle mt-0.5">
              基于 {result.sampleSize} 笔相似评分交易 · Score {score}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: `${color}18`, color, border: `1px solid ${color}40` }}
          >
            {result.confidence === 'high' ? '高置信' : result.confidence === 'medium' ? '中置信' : '低置信'}
          </span>
          <span className="text-xs text-subtle">{collapsed ? '展开 ▸' : '收起 ▾'}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="px-5 pb-5 border-t border-border-muted pt-4 space-y-4">
          {/* Recommended position */}
          <div className="rounded-lg bg-accent/[0.04] border border-accent/15 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                推荐仓位
              </span>
              <span className="font-mono text-xl font-bold tabular-nums stat-number text-accent">
                {formatPct(result.recommendedFraction)}
              </span>
            </div>
            <p className="text-[11px] text-subtle mt-1 leading-relaxed">{result.suggestion}</p>
          </div>

          {/* Kelly fractions */}
          <div className="space-y-2">
            <PositionBar fraction={result.kellyFraction} label="Full Kelly" muted />
            <PositionBar fraction={result.halfKellyFraction} label="Half-Kelly" />
            <PositionBar fraction={result.quarterKellyFraction} label="Quarter-Kelly" muted />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-surface-hover px-3 py-2">
              <p className="text-[10px] text-subtle uppercase tracking-wider mb-0.5">胜率</p>
              <p className="font-mono text-sm font-bold stat-number text-foreground">
                {formatPct(result.winProbability)}
              </p>
            </div>
            <div className="rounded-lg bg-surface-hover px-3 py-2">
              <p className="text-[10px] text-subtle uppercase tracking-wider mb-0.5">W/L 比</p>
              <p className="font-mono text-sm font-bold stat-number text-foreground">
                {result.winLossRatio.toFixed(1)}x
              </p>
            </div>
            <div className="rounded-lg bg-surface-hover px-3 py-2">
              <p className="text-[10px] text-subtle uppercase tracking-wider mb-0.5">Edge</p>
              <p className={`font-mono text-sm font-bold stat-number ${result.edge > 0 ? 'text-accent' : 'text-red-500'}`}>
                {result.edge > 0 ? '+' : ''}{(result.edge * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-[9px] text-subtle leading-relaxed">
            历史数据仅供参考，不构成投资建议。Kelly Criterion 基于历史胜率和 ROI 估算，实际结果可能不同。
          </p>
        </div>
      )}
    </div>
  );
}
