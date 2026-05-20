import { Filter, TrendingUp } from 'lucide-react';

type WhaleScoreMoatSectionProps = {
  variant?: 'light' | 'dark';
  className?: string;
};

export function WhaleScoreMoatSection({ variant = 'light', className = '' }: WhaleScoreMoatSectionProps) {
  if (variant === 'dark') {
    return (
      <section className={className} aria-labelledby="whale-score-moat-heading">
        <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
          <div className="relative overflow-hidden rounded-2xl border border-border-muted bg-surface/30 p-6 sm:p-8 layout-diagonal-band lg:-rotate-1 lg:translate-x-3">
            <p className="relative text-[11px] font-bold text-muted tracking-[0.35em] uppercase mb-3 flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-accent-primary" aria-hidden />
              Proprietary signal layer
            </p>
            <h2
              id="whale-score-moat-heading"
              className="relative font-display text-balance text-[clamp(1.25rem,4.2vw,1.65rem)] font-semibold leading-tight tracking-tight text-foreground"
            >
              Not all whale bets are equal.
              <span className="mt-2 block text-muted">We only send you the ones that move markets.</span>
            </h2>

            <div className="relative mt-6 space-y-4 border-t border-border pt-6 text-[15px] leading-relaxed text-muted">
              <p className="max-w-[74ch]">
                Any tool can show you large Polymarket trades. Only SightWhale filters the noise with our proprietary{' '}
                <span className="font-semibold text-foreground">Whale Score™</span>{' '}
                <span className="font-mono text-[13px] text-subtle">(0–100)</span>.
              </p>
              <p className="max-w-[78ch] text-[14px] sm:text-[15px]">
                Our AI-driven scoring system separates &quot;dumb large money&quot; from the top 1% of Polymarket wallets
                that consistently drive price action. Every alert we send has a Whale Score of{' '}
                <span className="rounded-md border border-border bg-background/80 px-2 py-0.5 font-semibold text-foreground">
                  70+
                </span>
                , so you skip{' '}
                <span className="rounded-md border border-border bg-background/80 px-2 py-0.5 font-semibold text-foreground">
                  90%
                </span>{' '}
                of the noise and only act on signals that matter.
              </p>
            </div>
          </div>

          <div className="relative rounded-2xl border border-accent-primary/25 bg-accent-primary/5 p-6 sm:p-8 lg:-mt-8 lg:ml-[-1.5rem] lg:translate-y-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-accent-sharp" aria-hidden />
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">Whale Score™</p>
            </div>
            <div className="flex items-center justify-between font-mono text-xs tabular-nums text-subtle mb-2">
              <span>0</span>
              <span>100</span>
            </div>
            <div className="relative h-4 overflow-hidden rounded-full bg-foreground/8 ring-1 ring-border">
              <div
                className="h-full w-[70%] rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, oklch(0.54 0.12 252), oklch(0.62 0.17 220) 55%, oklch(0.78 0.19 68))',
                }}
                aria-hidden
              />
            </div>
            <div className="mt-4 flex flex-col items-start gap-2 font-mono text-[11px] text-subtle">
              <span className="rounded border border-accent-sharp/35 bg-accent-sharp/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-sharp">
                70+ only
              </span>
              <span>Below this — filtered out.</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`mt-10 border-t border-neutral-200 pt-8 sm:mt-14 sm:pt-12 ${className}`}
      aria-labelledby="whale-score-moat-heading"
    >
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_1px_0_oklch(0.2_0.02_252_/_0.04)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-[0.65]" aria-hidden>
          <div className="absolute -left-24 -top-28 h-64 w-64 rounded-full bg-neutral-100 blur-2xl" />
          <div className="absolute -right-24 -top-16 h-56 w-56 rounded-full bg-neutral-100 blur-2xl" />
        </div>

        <p className="relative font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500">Proprietary signal layer</p>
        <h2
          id="whale-score-moat-heading"
          className="relative font-display mt-3 text-balance text-[clamp(1.25rem,4.2vw,1.65rem)] font-semibold leading-tight tracking-tight text-[oklch(0.18_0.02_252)]"
        >
          Not all whale bets are equal.
          <span className="mt-2 block text-neutral-600">We only send you the ones that move markets.</span>
        </h2>

        <div className="relative mt-6 space-y-4 border-t border-neutral-200 pt-6 text-[15px] leading-relaxed text-neutral-600">
          <p className="max-w-[74ch]">
            Any tool can show you large Polymarket trades. Only SightWhale filters the noise with our proprietary{' '}
            <span className="font-semibold text-[oklch(0.18_0.02_252)]">Whale Score™</span>{' '}
            <span className="font-mono text-[13px] text-neutral-500">(0–100)</span>.
          </p>
          <p className="max-w-[78ch] text-[14px] text-neutral-600 sm:text-[15px]">
            Our AI-driven scoring system separates &quot;dumb large money&quot; from the top 1% of Polymarket wallets that
            consistently drive price action. Every alert we send has a Whale Score of{' '}
            <span className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-semibold text-[oklch(0.18_0.02_252)]">
              70+
            </span>
            , so you skip{' '}
            <span className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-semibold text-[oklch(0.18_0.02_252)]">
              90%
            </span>{' '}
            of the noise and only act on signals that matter.
          </p>
        </div>

        <div className="relative mt-6">
          <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            <span>0</span>
            <span className="text-neutral-700">Whale Score™</span>
            <span>100</span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200">
            <div
              className="h-full w-[70%] rounded-full"
              style={{
                background: 'linear-gradient(90deg, oklch(0.35 0.03 252), oklch(0.45 0.05 252), oklch(0.55 0.08 220))',
              }}
              aria-hidden
            />
          </div>
          <div className="mt-2 flex flex-col items-center justify-center gap-1.5 font-mono text-[11px] text-neutral-500 sm:flex-row sm:gap-2">
            <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
              70+ only
            </span>
            <span>Below this — filtered out.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
