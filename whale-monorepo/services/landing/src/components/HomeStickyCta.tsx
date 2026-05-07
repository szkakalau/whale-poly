'use client';

import { HomeCtaLink } from '@/components/HomeCtaLink';
import { PRICING_PRO_MONTHLY } from '@/lib/pricing-plans';

export default function HomeStickyCta() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-md pb-[calc(0.75rem+env(safe-area-inset-bottom,0))] sm:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-foreground truncate">Unlock real-time</p>
          <p className="text-[11px] text-muted tabular-nums">From ${PRICING_PRO_MONTHLY}/mo · Pro</p>
        </div>
        <HomeCtaLink
          href="/pricing"
          placement="sticky"
          className="btn-primary shrink-0 px-5 py-2.5 text-xs font-black rounded-xl"
        >
          View plans
        </HomeCtaLink>
      </div>
    </div>
  );
}
