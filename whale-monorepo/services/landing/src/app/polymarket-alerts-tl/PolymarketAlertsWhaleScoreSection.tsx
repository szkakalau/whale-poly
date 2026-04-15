'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

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

  const backtestRows = useMemo(
    () =>
      [
        { tier: '90+ Insider', winRate: '91%', avgRoi: '+42.7%', trades: '127', plan: 'Elite Priority' },
        { tier: '80+ Elite', winRate: '84%', avgRoi: '+28.3%', trades: '582', plan: 'Elite' },
        { tier: '70+ Pro', winRate: '76%', avgRoi: '+19.5%', trades: '1243', plan: 'Pro' },
      ] as const,
    [],
  );

  const verifyWallet = useMemo(
    () =>
      ({
        score: 88,
        addressDisplay: '0x246b...fb5b',
        addressCopy: '0x246b...fb5b',
        winRate: '92%',
        polymarketUrl: 'https://polymarket.com/profile/0x246b...fb5b',
      }) as const,
    [],
  );

  const [copied, setCopied] = useState(false);
  const copyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(verifyWallet.addressCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }, [verifyWallet.addressCopy]);

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

      <div className="relative mt-7 md:mt-10 space-y-4">
        <div className="rounded-2xl border border-violet-200/15 bg-violet-400/10 px-4 py-4 text-center">
          <p className="text-sm font-semibold text-white">
            <span className="mr-2" aria-hidden>
              ✅
            </span>
            Whale Score is updated every 4 hours with live Polymarket data
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-5 md:p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-display text-lg md:text-xl font-black text-white">
                Proven Win Rate, Backtested &amp; Verified
              </h3>
              <p className="mt-1 text-xs md:text-sm text-gray-400">Live performance data updated daily</p>
            </div>
          </div>

          <div className="mt-4 hidden md:block">
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="bg-white/[0.04]">
                    <th className="px-4 py-3 font-semibold text-gray-200">Score Tier</th>
                    <th className="px-4 py-3 font-semibold text-gray-200">2026 YTD Win Rate</th>
                    <th className="px-4 py-3 font-semibold text-gray-200">Avg ROI</th>
                    <th className="px-4 py-3 font-semibold text-gray-200">Trades</th>
                    <th className="px-4 py-3 font-semibold text-gray-200">Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {backtestRows.map((r) => (
                    <tr key={r.tier} className="border-t border-white/10">
                      <td className="px-4 py-3 font-semibold text-white">{r.tier}</td>
                      <td className="px-4 py-3 text-gray-200">{r.winRate}</td>
                      <td className="px-4 py-3 text-emerald-300 font-semibold">{r.avgRoi}</td>
                      <td className="px-4 py-3 text-gray-200">{r.trades}</td>
                      <td className="px-4 py-3 text-gray-200">{r.plan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:hidden">
            {backtestRows.map((r) => (
              <div key={r.tier} className="rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-extrabold text-white">{r.tier}</p>
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-gray-200">
                    {r.plan}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-gray-400">Win Rate</p>
                    <p className="mt-1 text-sm font-semibold text-gray-100">{r.winRate}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-gray-400">Avg ROI</p>
                    <p className="mt-1 text-sm font-semibold text-emerald-300">{r.avgRoi}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-gray-400">Trades</p>
                    <p className="mt-1 text-sm font-semibold text-gray-100">{r.trades}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-5 md:p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-display text-lg md:text-xl font-black text-white">Verify The Performance Yourself</h3>
              <p className="mt-1 text-xs md:text-sm text-gray-400">One public wallet example to cross-check.</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-black/10 to-transparent p-4 md:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/80">Example Wallet</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-semibold text-white">
                    Score: {verifyWallet.score}
                  </span>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                    Win Rate: {verifyWallet.winRate}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-400">Address:</span>
                  <code className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 text-xs text-gray-100">
                    {verifyWallet.addressDisplay}
                  </code>
                  <button
                    type="button"
                    onClick={copyAddress}
                    className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.10] transition-colors active:scale-[0.99]"
                    aria-label="Copy wallet address"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <a
                href={verifyWallet.polymarketUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-extrabold text-zinc-950 hover:bg-cyan-300 transition-colors active:scale-[0.99]"
              >
                View On Polymarket →
              </a>
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

