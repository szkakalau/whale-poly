import Link from 'next/link';

type PolymarketAlertsBeforeAfterTableProps = {
  compact?: boolean;
};

const rows = [
  {
    before: 'You discover big bets AFTER the price already spiked, chase bad entries and lose money',
    after:
      'You see high-conviction whale positioning BEFORE the market moves, lock in better entries and higher ROI',
  },
  {
    before: 'You spend 2+ hours a day manually scanning Polymarket markets, missing opportunities',
    after: 'We scan 120+ markets 24/7 for you, alerts sent straight to your Telegram, no work required',
  },
  {
    before: 'You make rushed, emotional decisions based on social media hype',
    after: 'You trade with data from proven winning whales, no guesswork',
  },
  {
    before: 'You’re always one step behind the smart money, playing catch-up',
    after: 'You’re on the same timeline as the whales, with the same edge',
  },
] as const;

export function PolymarketAlertsBeforeAfterTable({ compact = false }: PolymarketAlertsBeforeAfterTableProps) {
  const shell = compact ? 'p-5 md:p-6' : 'p-8 md:p-12';
  const h2 = compact ? 'text-2xl md:text-3xl' : 'text-3xl md:text-4xl';
  const sub = compact ? 'mt-2 text-sm' : 'mt-3 text-sm md:text-base';
  const ctaMt = compact ? 'mt-6' : 'mt-10';

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] ${shell}`}
      aria-labelledby="before-after-heading"
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_20%_0%,#22d3ee,transparent_45%),radial-gradient(circle_at_85%_80%,#a78bfa,transparent_46%)]" />

      <h2 id="before-after-heading" className={`font-display relative font-black tracking-tight text-white ${h2}`}>
        This Is What Changes For You: No More Losing To Late Entries
      </h2>
      <p className={`relative max-w-3xl text-gray-300 leading-relaxed ${sub}`}>
        A simple side-by-side view of what you stop doing — and what you start doing — once you trade with real-time
        whale intelligence.
      </p>

      {/* Desktop table */}
      <div className="relative mt-6 hidden sm:block">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b border-white/10">
                <th className="w-1/2 px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-rose-300">
                  Before SightWhale
                </th>
                <th className="w-1/2 px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  With SightWhale
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((r) => (
                <tr key={r.before} className="align-top">
                  <td className="px-5 py-4 text-sm leading-relaxed text-gray-300">{r.before}</td>
                  <td className="px-5 py-4 text-sm leading-relaxed text-gray-100">{r.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile stacked cards */}
      <div className="relative mt-6 sm:hidden space-y-3">
        {rows.map((r, idx) => (
          <div key={`${idx}-${r.before.slice(0, 12)}`} className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-300">Before SightWhale</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">{r.before}</p>
            <div className="my-4 h-px w-full bg-white/10" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">With SightWhale</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-100">{r.after}</p>
          </div>
        ))}
      </div>

      <div className={`relative flex justify-center ${ctaMt}`}>
        <Link
          href="/subscribe?plan=pro"
          className="inline-flex w-full sm:w-auto min-h-[48px] items-center justify-center rounded-xl bg-cyan-400 px-7 py-3.5 text-sm font-extrabold text-zinc-950 hover:bg-cyan-300 transition-colors active:scale-[0.98]"
        >
          Stop Chasing Moves, Start Winning Today
        </Link>
      </div>
    </section>
  );
}

