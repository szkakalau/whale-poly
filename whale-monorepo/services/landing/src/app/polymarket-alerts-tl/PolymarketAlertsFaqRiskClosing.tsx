import Link from 'next/link';

const SUPPORT_MAIL = 'mailto:support@sightwhale.com';

const faqEntries = [
  {
    id: 'speed',
    question: 'How fast are alerts delivered?',
    body: (
      <div className="space-y-3 text-sm leading-relaxed text-zinc-600">
        <p>
          Typically <strong className="text-zinc-900">under 30 seconds</strong> after the transaction is detected.
        </p>
        <p>Speed matters because large trades often move markets quickly.</p>
      </div>
    ),
  },
  {
    id: 'where',
    question: 'Where will I receive alerts?',
    body: (
      <div className="space-y-3 text-sm leading-relaxed text-zinc-600">
        <p>
          All alerts are delivered directly via <strong className="text-zinc-900">Telegram</strong>.
        </p>
        <p>No dashboards. No logins.</p>
        <p className="font-medium text-zinc-900">Just instant notifications.</p>
      </div>
    ),
  },
  {
    id: 'whale-score',
    question: 'What is Whale Score?',
    body: (
      <div className="space-y-3 text-sm leading-relaxed text-zinc-600">
        <p>
          Whale Score is our proprietary ranking that surfaces <strong className="text-zinc-900">whales that actually win</strong>
          — not just big wallets.
        </p>
        <p className="text-zinc-700">
          We score traders using five non-negotiables: historical win rate, 30-day realized ROI, conviction, timing
          accuracy, and consistent wallet size.
        </p>
        <div className="rounded-xl border border-zinc-200 bg-white/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">What the score means</p>
          <ul className="mt-2 space-y-1.5 text-sm text-zinc-700">
            <li>
              <strong className="text-zinc-900">70+</strong>: included in Pro alerts
            </li>
            <li>
              <strong className="text-zinc-900">80+</strong>: top 1% whales, Elite-only
            </li>
            <li>
              <strong className="text-zinc-900">90+</strong>: rare, highest-conviction prints
            </li>
          </ul>
        </div>
        <p className="text-zinc-700">
          It’s <strong className="text-zinc-900">not a guarantee</strong>. It’s a filter that removes noise so you can act
          with better timing and context.
        </p>
      </div>
    ),
  },
  {
    id: 'volume',
    question: 'How many alerts will I receive?',
    body: (
      <div className="space-y-3 text-sm leading-relaxed text-zinc-600">
        <p>
          Usually <strong className="text-zinc-900">dozens per day</strong>.
        </p>
        <p>
          It depends on market activity, but we monitor <strong className="text-zinc-900">all active Polymarket markets</strong>{' '}
          continuously.
        </p>
      </div>
    ),
  },
  {
    id: 'compliance',
    question: 'Is this legal / compliant? Is it trading advice?',
    body: (
      <div className="space-y-3 text-sm leading-relaxed text-zinc-600">
        <p>
          SightWhale is a <strong className="text-zinc-900">data and alert service</strong> — not financial, legal, or betting advice.
        </p>
        <p className="text-zinc-700">
          We report observable wallet activity and deliver notifications. How you use that information is entirely up to you,
          and prediction markets carry real risk.
        </p>
        <p className="text-zinc-700">
          If you have a specific compliance question for your jurisdiction, contact us and we’ll point you to our disclosures.
        </p>
        <a
          href={SUPPORT_MAIL}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-white transition-colors"
        >
          Email support
        </a>
      </div>
    ),
  },
  {
    id: 'trading-advice',
    question: 'Do alerts guarantee profitable trades?',
    body: (
      <div className="space-y-3 text-sm leading-relaxed text-zinc-600">
        <p className="font-medium text-zinc-900">No.</p>
        <p>Prediction markets are volatile and risky.</p>
        <p>
          Whale alerts are <strong className="text-zinc-900">market intelligence</strong>, not guarantees.
        </p>
        <p className="text-zinc-700">Many traders use alerts to:</p>
        <ul className="list-disc space-y-1.5 pl-5 text-zinc-700">
          <li>discover markets earlier</li>
          <li>avoid late entries</li>
          <li>understand market sentiment</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'cancel',
    question: 'Can I cancel anytime?',
    body: (
      <div className="space-y-3 text-sm leading-relaxed text-zinc-600">
        <p className="font-medium text-zinc-900">Yes.</p>
        <p>You can cancel your subscription anytime. No contracts.</p>
      </div>
    ),
  },
];

export function PolymarketAlertsPostPricingFaqAndGuarantee({ compact = false }: { compact?: boolean }) {
  const faqPad = compact ? 'p-5 md:p-6' : 'p-8 md:p-12';
  const faqList = compact ? 'mt-5 space-y-2' : 'mt-8 space-y-3';
  const faqArt = compact ? 'p-4' : 'p-5 md:p-6';
  const guaranteeShell = compact ? 'mt-5 p-4 md:mt-6 md:p-5' : 'mt-8 p-5 md:p-6';

  return (
    <>
      <section
        className={`relative overflow-hidden rounded-3xl border border-white/10 bg-[#0f1210]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${faqPad}`}
        aria-labelledby="post-pricing-faq-heading"
      >
        <div className="pointer-events-none absolute inset-0 rounded-3xl opacity-[0.04] [background-image:radial-gradient(circle_at_30%_0%,#fff,transparent_50%)]" />
        <h2
          id="post-pricing-faq-heading"
          className="relative font-display text-2xl font-bold tracking-tight text-white md:text-3xl"
        >
          Still have questions?
        </h2>
        <p className="relative mt-2 max-w-2xl text-sm text-gray-400">
          Straight answers on advice, risk, speed, delivery, volume, and cancellation—before you subscribe.
        </p>

        {/* 7-day guarantee — must be first, bold, highlighted */}
        <div
          className={`relative overflow-hidden rounded-2xl border border-amber-200/30 bg-gradient-to-br from-amber-200/15 via-white/5 to-transparent ${guaranteeShell}`}
          aria-label="7-day no-questions-asked refund"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-200/10 blur-[60px]" />
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/80">
            7-day risk-free promise
          </p>
          <p className="mt-2 text-base font-bold text-white md:text-lg">
            7-Day No-Questions-Asked Refund
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-200/90">
            If you don&apos;t find the alerts useful within 7 days,{' '}
            <a
              href={SUPPORT_MAIL}
              className="font-semibold text-white underline decoration-white/25 underline-offset-4 hover:decoration-white/60"
            >
              email us
            </a>{' '}
            and we&apos;ll refund you. No fine print. No hoops.
          </p>
        </div>

        <div className={`relative ${faqList}`}>
          {faqEntries.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border border-white/[0.08] bg-black/40 transition-colors hover:border-cyan-400/25 hover:bg-black/50 ${faqArt}`}
            >
              <h3 className="font-display text-base font-semibold text-white md:text-lg">{item.question}</h3>
              <div className="mt-4 border-t border-white/5 pt-4">{item.body}</div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export function PolymarketAlertsClosingCta({ compact = false }: { compact?: boolean }) {
  const shell = compact ? 'p-6 text-center md:p-8' : 'p-10 text-center md:p-14';

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-lime-400/25 bg-[#080a07] ${shell}`}
      aria-labelledby="closing-cta-heading"
    >
      <div className="pointer-events-none absolute -left-1/4 top-0 h-64 w-1/2 rounded-full bg-lime-400/15 blur-[100px]" />
      <div className="pointer-events-none absolute -right-1/4 bottom-0 h-64 w-1/2 rounded-full bg-cyan-500/10 blur-[100px]" />

      <h2
        id="closing-cta-heading"
        className="font-display relative text-3xl font-black tracking-tight text-white md:text-5xl"
      >
        Stop trading blind.
      </h2>
      <p className="relative mx-auto mt-4 max-w-md text-lg text-gray-400 md:text-xl">Know when large money moves.</p>
      <Link
        href="/subscribe?plan=pro"
        className="relative mt-8 inline-flex items-center gap-2 rounded-xl bg-lime-400 px-8 py-3.5 text-sm font-bold text-zinc-950 shadow-[0_0_40px_-8px_rgba(163,230,53,0.55)] transition-transform hover:scale-[1.02] hover:bg-lime-300 active:scale-[0.99]"
      >
        Get whale alerts
        <span aria-hidden className="font-mono text-base">
          →
        </span>
      </Link>
    </section>
  );
}
