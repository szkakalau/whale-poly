'use client';

import { useEffect, useMemo, useRef } from 'react';

function setTopOffsetPx(px: number) {
  const clamped = Number.isFinite(px) ? Math.max(0, Math.round(px)) : 0;
  document.documentElement.style.setProperty('--sw-top-offset', `${clamped}px`);
}

export function RedditOfferTopBar({ scrollTargetId = 'pricing' }: { scrollTargetId?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  const onClaim = useMemo(() => {
    return () => {
      const el = document.getElementById(scrollTargetId);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }, [scrollTargetId]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const apply = () => setTopOffsetPx(node.getBoundingClientRect().height);
    apply();

    const ro = new ResizeObserver(() => apply());
    ro.observe(node);

    window.addEventListener('resize', apply, { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', apply);
      setTopOffsetPx(0);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="fixed inset-x-0 top-0 z-[60] w-full border-b border-white/10 bg-violet-600 text-white"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-5 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-center sm:text-left text-sm font-semibold tracking-tight">
            Welcome Reddit Traders <span className="text-white/70">|</span> Exclusive Offer
          </p>

          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-end">
            <p className="text-center sm:text-right text-sm text-white/90">
              Use code: <span className="font-mono font-bold text-white">REDDIT10</span> for 10% off your first month
            </p>
            <button
              type="button"
              onClick={onClaim}
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-white px-4 text-sm font-bold text-violet-700 shadow-sm hover:bg-white/95 active:scale-[0.98] transition"
            >
              Claim Discount
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

