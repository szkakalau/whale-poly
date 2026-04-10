import Link from 'next/link';

export function PolymarketAlertsPricingCompare() {
  return (
    <section
      className="relative overflow-x-hidden rounded-3xl border border-white/10 bg-[#0c0c0e] p-8 pb-10 pt-10 md:p-12 md:pb-12 md:pt-12"
      aria-labelledby="pricing-compare-heading"
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_70%_20%,#a3e635,transparent_45%),radial-gradient(circle_at_20%_80%,#22d3ee,transparent_40%)]" />

      <p className="relative text-center font-display text-lg font-semibold leading-snug text-lime-200/95 md:text-xl">
        Most active traders choose Lite for faster alerts.
      </p>

      <h2
        id="pricing-compare-heading"
        className="font-display relative mt-5 text-center text-3xl font-black tracking-tight text-white md:text-4xl"
      >
        Choose your alert speed
      </h2>
      <p className="relative mx-auto mt-3 max-w-xl text-center text-sm text-gray-400 md:text-base">
        Most traders upgrade after their first month.
      </p>

      <div className="relative mt-12 grid gap-6 pt-2 lg:grid-cols-3 lg:items-stretch">
        {/* Pro — $29 */}
        <div className="flex flex-col rounded-2xl border border-white/[0.09] bg-black/50 p-6 md:p-8 shadow-inner shadow-black/40">
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
          <ul className="mt-6 flex-1 space-y-3 text-sm text-gray-300">
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
            className="mt-8 inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.07] px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:border-lime-400/40 hover:bg-lime-400/10"
          >
            Get started
          </Link>
        </div>

        {/* Lite — $59 — featured */}
        <div className="relative flex flex-col rounded-2xl border-2 border-lime-400/45 bg-gradient-to-b from-lime-400/[0.09] via-black/60 to-black/80 p-6 shadow-[0_0_60px_-12px_rgba(163,230,53,0.35)] md:p-8 lg:scale-[1.02] lg:z-[1]">
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
          <ul className="mt-6 flex-1 space-y-3 text-sm text-gray-200">
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
            className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-lime-400 px-5 py-3.5 text-sm font-bold text-zinc-950 shadow-[0_0_32px_-8px_rgba(163,230,53,0.55)] transition-transform hover:scale-[1.02] hover:bg-lime-300 active:scale-[0.99]"
          >
            Upgrade to Lite
          </Link>
        </div>

        {/* Whale — $99 — coming soon */}
        <div className="flex flex-col rounded-2xl border border-dashed border-white/20 bg-black/35 p-6 md:p-8 opacity-95">
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
          <ul className="mt-6 flex-1 space-y-3 text-sm text-gray-500">
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
            className="mt-8 inline-flex w-full cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-transparent px-5 py-3.5 text-sm font-semibold text-gray-400 transition-colors hover:border-amber-400/40 hover:text-amber-100"
          >
            Join the waitlist
          </a>
        </div>
      </div>

      <p className="relative mt-8 text-center text-xs text-gray-500">
        No contracts. Cancel anytime on paid tiers. Whale launches when infrastructure is ready—we&apos;ll email waitlist
        first.
      </p>
    </section>
  );
}
