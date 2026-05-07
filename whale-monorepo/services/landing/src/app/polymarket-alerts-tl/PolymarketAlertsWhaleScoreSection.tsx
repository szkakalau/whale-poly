import Image from 'next/image';
import Link from 'next/link';

type PolymarketAlertsWhaleScoreSectionProps = {
  compact?: boolean;
  imageSrc?: string;
};

export function PolymarketAlertsWhaleScoreSection({
  compact = false,
  imageSrc = '/images/alerts/ScreenShot_2026-03-29_003514_416.png',
}: PolymarketAlertsWhaleScoreSectionProps) {
  const shell = compact ? 'p-5 md:p-6' : 'p-8 md:p-12';
  const h2 = compact
    ? 'text-2xl md:text-4xl'
    : 'text-3xl md:text-5xl lg:text-[3.25rem]';
  const sub = compact ? 'mt-4 text-sm md:text-base' : 'mt-5 text-base md:text-lg';

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-violet-400/25 bg-gradient-to-br from-violet-600/15 via-black/40 to-transparent ${shell}`}
      aria-labelledby="whale-score-heading"
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_65%_10%,#a78bfa,transparent_48%),radial-gradient(circle_at_20%_90%,#22d3ee,transparent_40%)]" />

      <header className="relative text-center">
        <h2
          id="whale-score-heading"
          className={`font-display mx-auto max-w-4xl font-black tracking-tight text-white text-balance ${h2}`}
        >
          Our Exclusive Whale Score: We Don’t Just Track Whales — We Track The Whales That Actually Win
        </h2>
        <p className={`mx-auto max-w-3xl text-gray-300 leading-relaxed ${sub}`}>
          90% of large Polymarket bets lose money. We filter out the noise, and only alert you to whales with a proven
          track record of winning trades.
        </p>
        <div className="mt-6 h-px w-full bg-white/10" />
      </header>

      <div className="relative mt-7 grid gap-6 md:mt-10 md:grid-cols-2 md:items-start">
        <div className="order-1 md:order-none">
          <div className="rounded-2xl border border-white/10 bg-black/35 p-2 shadow-inner shadow-black/50">
            <div className="relative overflow-hidden rounded-xl">
              <Image
                src={imageSrc}
                alt="Whale Score visualization preview"
                width={1400}
                height={1100}
                sizes="(max-width: 768px) 100vw, 50vw"
                className="h-auto w-full object-cover object-top"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-gray-500 md:text-left">
            Placeholder visual — swap in Whale Score logic / dashboard screenshot anytime.
          </p>
        </div>

        <div className="order-2 rounded-2xl border border-white/10 bg-black/30 p-5 md:p-6">
          <div className="space-y-5 text-gray-200">
            <div className="flex gap-3">
              <span className="mt-0.5 font-mono text-lime-400" aria-hidden>
                ✅
              </span>
              <div>
                <p className="font-display text-base font-bold text-white">What Is Whale Score?</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-300">
                  Whale Score is our proprietary, battle-tested algorithm that ranks every active Polymarket trader
                  across 5 non-negotiable metrics: historical win rate, 30-day realized ROI, trade conviction, market
                  timing accuracy, and consistent wallet size.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="mt-0.5 font-mono text-lime-400" aria-hidden>
                ✅
              </span>
              <div>
                <p className="font-display text-base font-bold text-white">How It Gives You An Unfair Edge</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-300">
                  We eliminate 99% of low-conviction, losing whale bets for you. Only traders that pass our strict
                  scoring thresholds make it into our alert feed — no more chasing dumb large money that crashes the
                  market.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="mt-0.5 font-mono text-lime-400" aria-hidden>
                ✅
              </span>
              <div>
                <p className="font-display text-base font-bold text-white">What The Score Means For Your Trades</p>
                <ul className="mt-2 space-y-1.5 text-sm text-gray-300">
                  <li>
                    <span className="font-semibold text-white">- 70+ Score:</span> Consistent winning traders, included
                    in our Pro plan alerts
                  </li>
                  <li>
                    <span className="font-semibold text-white">- 80+ Score:</span> Top 1% of Polymarket whales, 84%
                    historical win rate (2026 YTD), exclusive to our Elite plan
                  </li>
                  <li>
                    <span className="font-semibold text-white">- 90+ Score:</span> Legendary Polymarket insiders, only
                    surfaced in our highest-conviction priority alerts
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-7 md:mt-10">
        <div className="h-px w-full bg-white/10" />
        <div className="mt-6 flex justify-center">
          <Link
            href="#case-studies-2026"
            className="inline-flex w-full sm:w-auto min-h-[48px] items-center justify-center rounded-xl bg-violet-500 px-7 py-3.5 text-sm font-extrabold text-white shadow-[0_0_40px_-10px_rgba(139,92,246,0.65)] transition-colors hover:bg-violet-400 active:scale-[0.99]"
          >
            See The Winning Whales In Action
          </Link>
        </div>
      </div>
    </section>
  );
}

