'use client';

import dynamic from 'next/dynamic';
import type { LiveSignal } from '@/lib/live-signals';

function LiveSignalsSkeleton() {
  return (
    <div className="rounded-xl sm:rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-2 w-2 rounded-full bg-accent" />
          <div className="text-xs font-semibold tracking-[0.2em] uppercase text-accent">
            Live Signals
          </div>
          <div className="text-xs text-subtle hidden sm:block">Loading…</div>
        </div>
        <div className="h-4 w-28 rounded bg-surface-hover animate-pulse" />
      </div>
      <div className="px-3 py-3 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-background px-4 py-3 flex items-center justify-between gap-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div className="h-3 w-14 rounded bg-surface-hover animate-pulse" />
                <div className="h-3 w-10 rounded bg-surface-hover animate-pulse" />
              </div>
              <div className="mt-2 h-4 w-[85%] rounded bg-surface-hover animate-pulse" />
              <div className="mt-2 h-3 w-24 rounded bg-surface-hover animate-pulse" />
            </div>
            <div className="shrink-0 text-right">
              <div className="h-4 w-16 rounded bg-surface-hover animate-pulse" />
              <div className="mt-2 h-3 w-12 rounded bg-surface-hover animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const LiveSignalsFeedInner = dynamic(() => import('./LiveSignalsFeed'), {
  ssr: false,
  loading: () => <LiveSignalsSkeleton />,
});

export default function LiveSignalsFeedLazy({
  signals,
  homePreview,
}: {
  signals: LiveSignal[];
  /** When true, show at most 3 rows and skip paid polling (homepage teaser). */
  homePreview?: boolean;
}) {
  return <LiveSignalsFeedInner signals={signals} homePreview={homePreview} />;
}
