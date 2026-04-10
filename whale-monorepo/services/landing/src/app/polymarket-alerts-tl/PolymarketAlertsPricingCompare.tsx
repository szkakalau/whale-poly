import Link from 'next/link';

type PolymarketAlertsPricingCompareProps = {
  compact?: boolean;
};

export function PolymarketAlertsPricingCompare({ compact = false }: PolymarketAlertsPricingCompareProps) {
  const shell = compact
    ? 'p-5 pb-6 pt-6 md:p-6 md:pb-7 md:pt-7'
    : 'p-8 pb-10 pt-10 md:p-12 md:pb-12 md:pt-12';
  const grid = compact ? 'mt-6 gap-4 pt-1' : 'mt-12 gap-6 pt-2';
  const cardPad = compact ? 'p-4 md:p-5' : 'p-6 md:p-8';
  const listGap = compact ? 'mt-4 space-y-2' : 'mt-6 space-y-3';
  const btnMt = compact ? 'mt-5' : 'mt-8';
  const anchor = compact ? 'text-base md:text-lg' : 'text-lg md:text-xl';
  const h2 = compact ? 'mt-3 text-2xl md:text-3xl' : 'mt-5 text-3xl md:text-4xl';
  const sub = compact ? 'mt-2 text-xs md:text-sm' : 'mt-3 text-sm md:text-base';

  return (
    <section
      className={`relative overflow-x-hidden rounded-3xl border border-white/10 bg-[#0c0c0e] ${shell}`}
      aria-labelledby="pricing-compare-heading"
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_70%_20%,#a3e635,transparent_45%),radial-gradient(circle_at_20%_80%,#22d3ee,transparent_40%)]" />

      <p className={`relative text-center font-display font-semibold leading-snug text-lime-200/95 ${anchor}`}>
        Most active traders choose Lite for faster alerts.
      </p>

      <h2
        id="pricing-compare-heading"
        className={`font-display relative text-center font-black tracking-tight text-white ${h2}`}
      >
        Choose your alert speed
      </h2>
      <p className={`relative mx-auto max-w-xl text-center text-gray-400 ${sub}`}>
        Most traders upgrade after their first month.
      </p>

      <div className={`relative grid lg:grid-cols-3 lg:items-stretch ${grid}`}>
        {/* Pro — $29 */}
        <div className={`flex flex-col rounded-2xl border border-white/[0.09] bg-black/50 shadow-inner shadow-black/40 ${cardPad}`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-xl font-bold text-white">Pro</h3>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gray-400">
              Entry
            </span>
          </div>
          <p className="mt-4 font-display text-4xl font-black tabular-nums text-white md:text-5xl">
            $29
            <span className="text-lg font-semibold text-gray-500 md:text-xl">/month</span>
          </p>
          <ul className={`flex-1 text-sm text-gray-300 ${listGap}`}>
            <li className="flex gap-2">
              <span className="text-lime-400/90" aria-hidden>
                ✓
              </span>
              <span>Real-time whale alerts</span>
            </li>
            <li className="flex gap-2">
              <span className="text-lime-400/90" aria-hidden>
                ✓
              </span>
              <span>All Polymarket markets</span>
            </li>
            <li className="flex gap-2">
              <span className="text-lime-400/90" aria-hidden>
                ✓
              </span>
              <span>Telegram delivery</span>
            </li>
            <li className="flex gap-2">
              <span className="text-lime-400/90" aria-hidden>
                ✓
              </span>
              <span>Cancel anytime</span>
            </li>
          </ul>
          <Link
            href="/subscribe?plan=pro"
            className={`inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.07] px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-lime-400/40 hover:bg-lime-400/10 ${btnMt}`}
          >
            Get started
          </Link>
        </div>

        {/* Lite — $59 — featured */}
        <div
          className={`relative flex flex-col rounded-2xl border-2 border-lime-400/45 bg-gradient-to-b from-lime-400/[0.09] via-black/60 to-black/80 shadow-[0_0_60px_-12px_rgba(163,230,53,0.35)] lg:scale-[1.02] lg:z-[1] ${cardPad}`}
        >
          <div className="absolute -top-3 left-1/2 z-[2] -translate-x-1/2 whitespace-nowrap rounded-full bg-lime-400 px-4 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-950 shadow-lg">
            Most popular
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <h3 className="font-display text-xl font-bold text-white">Lite</h3>
            <span className="rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-lime-200">
              Recommended
            </span>
          </div>
          <p className="mt-4 font-display text-4xl font-black tabular-nums text-white md:text-5xl">
            $59
            <span className="text-lg font-semibold text-lime-200/70 md:text-xl">/month</span>
          </p>
          <ul className={`flex-1 text-sm text-gray-200 ${listGap}`}>
            <li className="flex gap-2">
              <span className="text-lime-400" aria-hidden>
                ✓
              </span>
              <span>Everything in Pro</span>
            </li>
            <li className="flex gap-2">
              <span className="text-lime-400" aria-hidden>
                ✓
              </span>
              <span>
                <strong className="text-white">Faster alert channel</strong>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-lime-400" aria-hidden>
                ✓
              </span>
              <span>
                <strong className="text-white">Large trades filter</strong>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-lime-400" aria-hidden>
                ✓
              </span>
              <span>
                <strong className="text-white">Priority delivery</strong>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-lime-400" aria-hidden>
                ✓
              </span>
              <span>
                <strong className="text-white">Daily summary</strong>
              </span>
            </li>
          </ul>
          <Link
            href="/subscribe?plan=elite"
            className={`inline-flex w-full items-center justify-center rounded-xl bg-lime-400 px-5 py-3 text-sm font-bold text-zinc-950 shadow-[0_0_32px_-8px_rgba(163,230,53,0.55)] transition-transform hover:scale-[1.02] hover:bg-lime-300 active:scale-[0.99] ${btnMt}`}
          >
            Upgrade to Lite
          </Link>
        </div>

        {/* Whale — $99 — coming soon */}
        <div className={`flex flex-col rounded-2xl border border-dashed border-white/20 bg-black/35 opacity-95 ${cardPad}`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-xl font-bold text-white">Whale</h3>
            <span className="rounded-full border border-amber-400/35 bg-amber-500/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-200">
              Coming soon
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">Full-depth signal stack for size and teams.</p>
          <p className="mt-4 font-display text-4xl font-black tabular-nums text-gray-500 md:text-5xl">
            $99
            <span className="text-lg font-semibold text-gray-600 md:text-xl">/month</span>
          </p>
          <ul className={`flex-1 text-sm text-gray-500 ${listGap}`}>
            <li className="flex gap-2">
              <span className="text-gray-600" aria-hidden>
                ◇
              </span>
              <span>Everything in Lite</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-600" aria-hidden>
                ◇
              </span>
              <span>Dedicated coverage &amp; concierge onboarding</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-600" aria-hidden>
                ◇
              </span>
              <span>Custom watchlists &amp; API-style exports</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-600" aria-hidden>
                ◇
              </span>
              <span>Early access to new signal types</span>
            </li>
          </ul>
          <a
            href="mailto:support@sightwhale.com?subject=Whale%20tier%20waitlist"
            className={`inline-flex w-full cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-transparent px-5 py-3 text-sm font-semibold text-gray-400 transition-colors hover:border-amber-400/40 hover:text-amber-100 ${btnMt}`}
          >
            Join the waitlist
          </a>
        </div>
      </div>

      <p className={`relative text-center text-xs text-gray-500 ${compact ? 'mt-5' : 'mt-8'}`}>
        No contracts. Cancel anytime on paid tiers. Whale launches when infrastructure is ready—we&apos;ll email waitlist
        first.
      </p>
    </section>
  );
}
