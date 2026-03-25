'use client';

import dynamic from 'next/dynamic';
import type { LiveSignal } from '@/lib/live-signals';

function LiveSignalsSkeleton() {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          <div className="text-xs font-black tracking-[0.25em] uppercase text-emerald-300">
            Live Signals
          </div>
          <div className="text-xs text-gray-500 hidden sm:block">Loading…</div>
        </div>
        <div className="h-4 w-28 rounded bg-white/10 animate-pulse" />
      </div>
      <div className="px-3 py-3 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 flex items-center justify-between gap-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div className="h-3 w-14 rounded bg-white/10 animate-pulse" />
                <div className="h-3 w-10 rounded bg-white/10 animate-pulse" />
              </div>
              <div className="mt-2 h-4 w-[85%] rounded bg-white/10 animate-pulse" />
              <div className="mt-2 h-3 w-24 rounded bg-white/10 animate-pulse" />
            </div>
            <div className="shrink-0 text-right">
              <div className="h-4 w-16 rounded bg-white/10 animate-pulse" />
              <div className="mt-2 h-3 w-12 rounded bg-white/10 animate-pulse" />
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

export default function LiveSignalsFeedLazy({ signals }: { signals: LiveSignal[] }) {
  return <LiveSignalsFeedInner signals={signals} />;
}

