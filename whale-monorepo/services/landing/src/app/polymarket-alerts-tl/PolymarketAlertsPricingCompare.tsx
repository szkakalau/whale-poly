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
  const listGap = compact ? 'mt-4 space-y-2.5' : 'mt-6 space-y-3';
  const btnMt = compact ? 'mt-5' : 'mt-8';
  const h2 = compact ? 'text-2xl md:text-3xl' : 'text-3xl md:text-4xl';
  const sub = compact ? 'mt-2 text-xs md:text-sm' : 'mt-3 text-sm md:text-base';

  return (
    <section
      className={`relative overflow-x-hidden rounded-3xl border border-white/10 bg-[#0c0c0e] ${shell}`}
      aria-labelledby="pricing-compare-heading"
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_70%_20%,#a3e635,transparent_45%),radial-gradient(circle_at_20%_80%,#22d3ee,transparent_40%)]" />

      <h2
        id="pricing-compare-heading"
        className={`font-display relative text-center font-black tracking-tight text-white ${h2}`}
      >
        Choose your plan
      </h2>
      <p className={`relative mx-auto max-w-xl text-center text-gray-400 ${sub}`}>
        Pick the alert speed and coverage that fit how actively you trade.
      </p>

      <div className={`relative grid lg:grid-cols-3 lg:items-stretch ${grid}`}>
        <div
          className={`relative order-1 lg:order-2 flex flex-col rounded-2xl border-2 border-violet-500 bg-gradient-to-b from-violet-500/[0.14] via-black/60 to-black/80 shadow-[0_0_70px_-14px_rgba(139,92,246,0.50)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_90px_-18px_rgba(139,92,246,0.65)] lg:z-[1] lg:-mt-3 lg:mb-3 ${cardPad}`}
        >
          <div className="absolute -top-3 left-1/2 z-[2] -translate-x-1/2 whitespace-nowrap rounded-full bg-violet-500 px-4 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-lg">
            Best for active traders
          </div>

          <div className="mt-4 text-center">
            <h3 className="font-display text-2xl font-black text-white">Elite</h3>
            <p className="mt-3 font-display text-5xl font-black tabular-nums text-white md:text-6xl">
              $59
              <span className="text-base font-medium text-violet-200/80 md:text-lg">/month</span>
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-300">
              Faster delivery and more selective alerts for active traders.
            </p>
          </div>

          <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          <ul className={`flex-1 text-sm text-gray-200 ${listGap}`}>
            <li className="flex items-start gap-2.5 text-left">
              <span className="w-5 shrink-0 text-emerald-400" aria-hidden>
                ✅
              </span>
              <span>Everything in Pro</span>
            </li>
            <li className="flex items-start gap-2.5 text-left">
              <span className="w-5 shrink-0 text-emerald-400" aria-hidden>
                ✅
              </span>
              <span>Priority alert channel with 10-15s delivery</span>
            </li>
            <li className="flex items-start gap-2.5 text-left">
              <span className="w-5 shrink-0 text-emerald-400" aria-hidden>
                ✅
              </span>
              <span>Alerts from whales with 80+ Whale Score</span>
            </li>
            <li className="flex items-start gap-2.5 text-left">
              <span className="w-5 shrink-0 text-emerald-400" aria-hidden>
                ✅
              </span>
              <span>Large-trade filter for higher-conviction signals</span>
            </li>
            <li className="flex items-start gap-2.5 text-left">
              <span className="w-5 shrink-0 text-emerald-400" aria-hidden>
                ✅
              </span>
              <span>Priority delivery during volatile market windows</span>
            </li>
            <li className="flex items-start gap-2.5 text-left">
              <span className="w-5 shrink-0 text-emerald-400" aria-hidden>
                ✅
              </span>
              <span>Daily market summary and whale watchlist</span>
            </li>
            <li className="flex items-start gap-2.5 text-left">
              <span className="w-5 shrink-0 text-emerald-400" aria-hidden>
                ✅
              </span>
              <span>Cancel anytime, no contracts</span>
            </li>
          </ul>

          <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          <Link
            href="/subscribe?plan=elite"
            className={`inline-flex w-full min-h-[48px] items-center justify-center rounded-xl bg-violet-500 px-5 py-3.5 text-sm font-extrabold text-white shadow-[0_0_34px_-10px_rgba(139,92,246,0.75)] transition-all hover:bg-violet-400 active:scale-[0.98] ${btnMt}`}
          >
            Get Elite Priority Alerts
          </Link>
        </div>

        <div
          className={`order-2 lg:order-1 flex flex-col rounded-2xl border border-white/[0.10] bg-black/50 shadow-inner shadow-black/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_55px_-22px_rgba(0,0,0,0.85)] ${cardPad}`}
        >
          <div className="text-center">
            <div className="inline-flex items-center justify-center rounded-full bg-violet-500 px-4 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white">
              Most Popular
            </div>
            <h3 className="mt-3 font-display text-2xl font-black text-white">Pro</h3>
            <p className="mt-3 font-display text-5xl font-black tabular-nums text-white md:text-6xl">
              $29
              <span className="text-base font-medium text-gray-400 md:text-lg">/month</span>
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-300">
              Best for most traders who want real-time whale alerts without extra complexity.
            </p>
          </div>

          <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          <ul className={`flex-1 text-sm text-gray-200 ${listGap}`}>
            <li className="flex items-start gap-2.5 text-left">
              <span className="w-5 shrink-0 text-emerald-400" aria-hidden>
                ✅
              </span>
              <span>Real-time &lt;30s Polymarket whale alerts</span>
            </li>
            <li className="flex items-start gap-2.5 text-left">
              <span className="w-5 shrink-0 text-emerald-400" aria-hidden>
                ✅
              </span>
              <span>Full coverage of all active Polymarket markets</span>
            </li>
            <li className="flex items-start gap-2.5 text-left">
              <span className="w-5 shrink-0 text-emerald-400" aria-hidden>
                ✅
              </span>
              <span>Alerts from whales with 70+ exclusive Whale Score</span>
            </li>
            <li className="flex items-start gap-2.5 text-left">
              <span className="w-5 shrink-0 text-emerald-400" aria-hidden>
                ✅
              </span>
              <span>Instant Telegram alert delivery</span>
            </li>
            <li className="flex items-start gap-2.5 text-left">
              <span className="w-5 shrink-0 text-emerald-400" aria-hidden>
                ✅
              </span>
              <span>No dashboards, 2-minute one-time setup</span>
            </li>
            <li className="flex items-start gap-2.5 text-left">
              <span className="w-5 shrink-0 text-emerald-400" aria-hidden>
                ✅
              </span>
              <span>Cancel anytime, no contracts</span>
            </li>
          </ul>

          <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          <Link
            href="/subscribe?plan=pro"
            className={`inline-flex w-full min-h-[48px] items-center justify-center rounded-xl bg-violet-500 px-5 py-3.5 text-sm font-extrabold text-white transition-all hover:bg-violet-400 active:scale-[0.98] ${btnMt}`}
          >
            Start 7-Day Risk-Free Trial
          </Link>
        </div>

        <div
          className={`order-3 lg:order-3 flex flex-col rounded-2xl border border-dashed border-white/25 bg-black/35 opacity-95 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_55px_-22px_rgba(0,0,0,0.85)] ${cardPad}`}
        >
          <div className="text-center">
            <div className="inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-gray-200">
              Coming Soon
            </div>
            <h3 className="mt-3 font-display text-2xl font-black text-gray-400">Whale</h3>
            <p className="mt-3 font-display text-5xl font-black tabular-nums text-gray-500 md:text-6xl">
              $99
              <span className="text-base font-medium text-gray-600 md:text-lg">/month</span>
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-500">
              Built for teams and high-volume users who need more support and custom access.
            </p>
          </div>

          <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          <ul className={`flex-1 text-sm text-gray-500 ${listGap}`}>
            <li className="flex items-start gap-2.5 text-left">
              <span className="w-5 shrink-0 text-gray-600" aria-hidden>
                ◇
              </span>
              <span>Everything in Elite</span>
            </li>
            <li className="flex items-start gap-2.5 text-left">
              <span className="w-5 shrink-0 text-gray-600" aria-hidden>
                ◇
              </span>
              <span>Dedicated account manager &amp; concierge onboarding</span>
            </li>
            <li className="flex items-start gap-2.5 text-left">
              <span className="w-5 shrink-0 text-gray-600" aria-hidden>
                ◇
              </span>
              <span>Custom watchlists &amp; API-style data exports</span>
            </li>
            <li className="flex items-start gap-2.5 text-left">
              <span className="w-5 shrink-0 text-gray-600" aria-hidden>
                ◇
              </span>
              <span>Early access to all new signal types</span>
            </li>
            <li className="flex items-start gap-2.5 text-left">
              <span className="w-5 shrink-0 text-gray-600" aria-hidden>
                ◇
              </span>
              <span>Exclusive whale-cluster trade alerts</span>
            </li>
            <li className="flex items-start gap-2.5 text-left">
              <span className="w-5 shrink-0 text-gray-600" aria-hidden>
                ◇
              </span>
              <span>Waitlist members get first access + grandfathered pricing</span>
            </li>
          </ul>

          <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          <Link
            href="/whale-waitlist"
            className={`inline-flex w-full min-h-[48px] items-center justify-center rounded-xl border-2 border-violet-500/70 bg-transparent px-5 py-3.5 text-sm font-extrabold text-violet-200 transition-all hover:bg-violet-500 hover:text-white active:scale-[0.98] ${btnMt}`}
          >
            Join The Waitlist
          </Link>
        </div>
      </div>

      <div className={`relative ${compact ? 'mt-5' : 'mt-8'}`}>
        <div className="w-full rounded-2xl border border-violet-500/15 bg-violet-500/10 px-5 py-4 text-center">
          <p className="text-sm font-semibold text-white">
            All paid plans come with a 7-day no-questions-asked full refund.
          </p>
          <p className="mt-1 text-xs text-gray-300">
            If you don’t find the alerts useful within 7 days, email us and we’ll give you every penny back. No fine
            print, no hoops to jump through.
          </p>
        </div>
      </div>
    </section>
  );
}
