import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';

const caseStudies2026 = [
  {
    n: 1,
    alert: '$42,000 YES bet',
    whaleScore: 89,
    market: 'Will Trump win the 2026 US Presidential Election?',
    timeUtc: '09:27 UTC, April 2026',
    moveFrom: '52%',
    moveTo: '61%',
    minutes: 19,
    roi: '+17% ROI',
    meaning: 'If you followed the alert, you could’ve locked in +17% ROI in under 20 minutes',
  },
  {
    n: 2,
    alert: '$27,500 NO bet',
    whaleScore: 85,
    market: 'US recession in 2026?',
    timeUtc: '09:47 UTC, March 2026',
    moveFrom: '41%',
    moveTo: '35%',
    minutes: 18,
    roi: '+17% ROI (NO side)',
    meaning: 'If you followed the alert, you could’ve avoided a losing trade, or locked in +17% ROI on the NO side',
  },
  {
    n: 3,
    alert: '$51,200 YES bet',
    whaleScore: 92,
    market: 'Ethereum ETF approved in 2026?',
    timeUtc: '17:03 UTC, April 2026',
    moveFrom: '48%',
    moveTo: '58%',
    minutes: 31,
    roi: '+20.8% ROI',
    meaning: 'If you followed the alert, you could’ve locked in +20.8% ROI in just over 30 minutes',
  },
] as const;

const traderUseBullets = [
  'Spot markets you were not watching before the crowd notices them',
  'Avoid entering after a large move is already underway',
  'Use whale activity as a second layer of confirmation',
  'Spend less time scanning noisy free sources',
  'Stay closer to where large money is positioning',
] as const;

export function PolymarketAlertsConversionAfterHero({ compact = false }: { compact?: boolean }) {
  const pad = compact ? 'p-5 md:p-6' : 'p-8 md:p-12';
  const speedGrid = compact ? 'mt-5 gap-3' : 'mt-8 gap-4';
  const speedCard = compact ? 'p-4' : 'p-6';
  const volGrid = compact ? 'mt-5 gap-3' : 'mt-8 gap-4';
  const volCard = compact ? 'px-4 py-4' : 'px-5 py-6';
  const useList = compact ? 'mt-5 space-y-2' : 'mt-8 space-y-4';
  const useItem = compact ? 'px-3 py-2 text-sm' : 'px-4 py-3';

  return (
    <>
      <section
        className={`rounded-3xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/[0.08] via-transparent to-violet-600/[0.06] ${pad}`}
        aria-labelledby="speed-edge-heading"
      >
        <h2 id="speed-edge-heading" className="font-display text-2xl font-bold text-white md:text-3xl">
          Why traders pay for this instead of relying on free sources
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-cyan-50/85 md:text-base">
          Free sources can show you big trades. They usually do not help you decide which ones matter fast enough.
        </p>
        <div className={`grid md:grid-cols-3 ${speedGrid}`}>
          {[
            {
              label: 'Free sources',
              line1: '15–60',
              line2: 'minutes',
              sub: 'You often notice the move only after the market starts reacting',
            },
            {
              label: 'SightWhale',
              line1: '<30',
              line2: 'seconds',
              sub: 'Filtered alerts are typically delivered in under 30 seconds',
            },
          ].map((col) => (
            <div
              key={col.label}
              className={`relative overflow-hidden rounded-2xl border border-white/10 bg-black/35 text-center md:text-left ${speedCard}`}
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-400/10 blur-2xl" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/90">{col.label}</p>
              <p className="font-display mt-4 text-4xl font-black tabular-nums text-white md:text-5xl">
                {col.line1}
                <span className="block text-lg font-bold tracking-wide text-cyan-200/90 md:inline md:ml-2 md:text-2xl">
                  {col.line2}
                </span>
              </p>
              <p className="mt-3 text-sm text-gray-400">{col.sub}</p>
            </div>
          ))}
          <div
            className={`relative overflow-hidden rounded-2xl border border-white/10 bg-black/35 text-center md:text-left md:flex md:flex-col md:justify-center ${speedCard}`}
          >
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-400/10 blur-2xl" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/90">What changes</p>
            <p className="font-display mt-4 text-2xl font-black leading-snug text-white md:text-3xl">
              Faster awareness. Less noise.
            </p>
            <p className="mt-3 text-sm text-gray-400">You spend less time scanning feeds and more time deciding whether the positioning matters</p>
          </div>
        </div>
      </section>

      <section
        className={`rounded-3xl border border-amber-400/25 bg-gradient-to-br from-amber-500/[0.07] to-black/40 ${pad}`}
        aria-labelledby="volume-alerts-heading"
      >
        <h2 id="volume-alerts-heading" className="font-display text-2xl font-bold text-white md:text-3xl">
          We scan a lot so you do not have to
        </h2>
        <p className={`max-w-2xl text-amber-100/85 ${compact ? 'mt-3 text-base' : 'mt-4 text-lg'}`}>
          SightWhale watches broad whale activity across Polymarket, then filters for the handful of alerts most worth your attention.
        </p>
        <div className={`grid sm:grid-cols-3 ${volGrid}`}>
          {[
            { k: 'Markets watched', v: '100+', hint: 'Broad Polymarket coverage' },
            { k: 'Whale events scanned', v: '120+', hint: 'Representative weekly volume' },
            { k: 'Delivery threshold', v: '70+', hint: 'Only higher-signal alerts pass through' },
          ].map((row) => (
            <div
              key={row.k}
              className={`rounded-2xl border border-white/10 bg-black/45 text-center sm:text-left ${volCard}`}
            >
              <p className="text-xs uppercase tracking-[0.16em] text-amber-200/70">{row.k}</p>
              <p className="font-display mt-3 text-3xl font-black text-white md:text-4xl">{row.v}</p>
              <p className="mt-2 text-xs text-gray-500">{row.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        className={`rounded-3xl border border-white/10 bg-white/[0.04] ${pad}`}
        aria-labelledby="how-traders-use-heading"
      >
        <h2 id="how-traders-use-heading" className="font-display text-2xl font-bold text-white md:text-3xl">
          How traders use whale alerts
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-300 md:text-base">
          Most users do not treat these as automatic buy signals. They use them to get faster context and improve timing.
        </p>
        <ul className={useList}>
          {traderUseBullets.map((line) => (
            <li
              key={line}
              className={`flex gap-3 rounded-xl border border-white/[0.06] bg-black/25 text-gray-200 ${useItem}`}
            >
              <span className="mt-0.5 font-mono text-lime-400" aria-hidden>
                ●
              </span>
              <span className="leading-relaxed">{line}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export function PolymarketAlertsCaseStudies2026({ compact = false }: { compact?: boolean }) {
  const pad = compact ? 'p-5 md:p-6' : 'p-8 md:p-12';
  const caseList = compact ? 'mt-6 space-y-4' : 'mt-10 space-y-6';
  const caseArt = compact ? 'p-4 pl-4 md:p-5 md:pl-8' : 'p-6 pl-5 md:p-8 md:pl-10';
  const badge = compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs';
  const ctaMt = compact ? 'mt-6' : 'mt-10';

  return (
    <section
      id="case-studies-2026"
      className={`group/section relative scroll-mt-24 overflow-hidden rounded-3xl border border-lime-400/20 bg-[#070807]/90 shadow-[0_0_80px_-20px_rgba(163,230,53,0.25)] ${pad}`}
      aria-labelledby="proof-case-studies-2026-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(163, 230, 53, 0.35) 2px,
              rgba(163, 230, 53, 0.35) 3px
            )`,
        }}
      />
      <div className="pointer-events-none absolute -right-16 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-lime-400/10 blur-[80px]" />

      <p className="relative font-mono text-[11px] uppercase tracking-[0.28em] text-lime-300/90">
        Recent alert examples
      </p>
      <h2
        id="proof-case-studies-2026-heading"
        className="font-display relative mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl"
      >
        Recent examples of alerts appearing before market moves
      </h2>
      <p className="relative mt-3 max-w-2xl text-base text-gray-300 md:text-lg">
        A few representative cases where large, high-score bets showed up before meaningful price movement.
      </p>

      <div className={`relative ${caseList}`}>
        {caseStudies2026.map((cs, i) => (
          <article
            key={cs.n}
            className={`relative rounded-2xl border border-white/[0.08] bg-black/40 shadow-inner shadow-black/40 ${caseArt}`}
            style={{
              animationDelay: `${i * 80}ms`,
            }}
          >
            <div className="absolute left-0 top-6 bottom-6 w-1 rounded-full bg-gradient-to-b from-lime-400/90 via-lime-300/50 to-transparent md:top-8 md:bottom-8" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-lime-200/80">Case Study #{cs.n}</span>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full border border-white/10 bg-white/[0.03] font-mono text-gray-200 ${badge}`}>
                  Whale Score: <span className="font-bold text-lime-200 tabular-nums">{cs.whaleScore}</span>
                </span>
                <span className={`rounded-full border border-lime-400/25 bg-lime-400/10 font-mono text-lime-100 ${badge}`}>
                  {cs.roi}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Alert detected</p>
                <p className="font-mono text-base font-semibold text-lime-100 md:text-lg">{cs.alert}</p>
                <p className="text-sm leading-relaxed text-gray-300">{cs.market}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-lime-400/5 px-4 py-3 font-mono text-sm text-lime-100/95 md:text-right">
                <p className="text-[10px] uppercase tracking-[0.2em] text-lime-300/70">Time</p>
                <p className="mt-1 text-sm font-semibold tabular-nums md:text-base">{cs.timeUtc}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">Move</p>
                <p className="mt-1 font-mono text-lg font-bold text-lime-200">
                  {cs.moveFrom} {'->'} {cs.moveTo}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">Window</p>
                <p className="mt-1 font-mono text-lg font-bold text-white">{cs.minutes} min</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">Why it matters</p>
                <p className="mt-1 text-sm font-medium text-gray-200">Earlier context before the crowd had it</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className={`relative flex flex-col items-center gap-3 ${ctaMt}`}>
        <Link
          href="/subscribe?plan=pro"
          onClick={() =>
            trackEvent('lp_cta_click', {
              page: 'polymarket-alerts-tl',
              section: 'case_studies',
              cta_id: 'case_studies_primary',
              destination: '/subscribe?plan=pro',
              plan: 'pro',
            })
          }
          className="inline-flex w-full sm:w-auto min-h-[48px] items-center justify-center rounded-xl bg-lime-400 px-7 py-3.5 text-sm font-extrabold text-zinc-950 shadow-[0_0_40px_-10px_rgba(163,230,53,0.65)] transition-transform hover:scale-[1.02] hover:bg-lime-300 active:scale-[0.99]"
        >
          Start 7-Day Risk-Free Trial
        </Link>
        <p className="text-center text-xs text-gray-500">
          Representative examples for timing and market reaction, not promises or guarantees.
        </p>
      </div>
    </section>
  );
}

export function PolymarketAlertsPrePricing({ compact = false }: { compact?: boolean }) {
  const shell = compact
    ? 'px-6 py-8 text-center md:px-10 md:py-10'
    : 'px-8 py-12 text-center md:px-14 md:py-16';
  const h2 = compact
    ? 'font-display relative text-2xl font-black leading-tight tracking-tight text-white md:text-4xl'
    : 'font-display relative text-3xl font-black leading-tight tracking-tight text-white md:text-5xl lg:text-[3.25rem]';
  const sub = compact ? 'relative mx-auto mt-4 max-w-xl text-sm text-violet-100/90 md:text-base' : 'relative mx-auto mt-6 max-w-xl text-base text-violet-100/90 md:text-lg';

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-violet-400/35 bg-gradient-to-br from-violet-600/25 via-fuchsia-600/10 to-transparent ${shell}`}
      aria-labelledby="one-trade-heading"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(167,139,250,0.22),transparent_55%)]" />
      <h2 id="one-trade-heading" className={h2}>
        One earlier signal or one avoided bad entry can justify the month
      </h2>
      <p className={sub}>
        Most of the value comes from seeing important moves sooner, not from copying every alert.
      </p>
      <div className="relative mx-auto mt-6 grid max-w-4xl gap-3 text-left md:grid-cols-3">
        {[
          'Catch one strong move earlier',
          'Avoid one late chase into a stretched market',
          'Spend less time scanning noisy feeds and trackers',
        ].map((item) => (
          <div key={item} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-sm text-violet-50/90">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}
