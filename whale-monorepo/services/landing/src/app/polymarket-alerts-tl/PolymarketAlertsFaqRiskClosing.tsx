import Link from 'next/link';

const SUPPORT_MAIL = 'mailto:support@sightwhale.com';

const faqEntries = [
  {
    id: 'trading-advice',
    question: 'Is this trading advice?',
    body: (
      <div className="space-y-3 text-sm leading-relaxed text-zinc-600">
        <p className="font-medium text-zinc-900">No.</p>
        <p>
          SightWhale is a <strong className="text-zinc-900">data and alert service</strong>.
        </p>
        <p>
          We track large wallet activity on Polymarket and deliver real-time notifications. How you use this
          information is entirely up to you.
        </p>
      </div>
    ),
  },
  {
    id: 'guarantee-profits',
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
  const guaranteeShell = compact ? 'px-6 py-6 md:px-8 md:py-8' : 'px-8 py-10 md:px-12 md:py-12';

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
          Answers about delivery, speed, refunds, and cancellation.
        </p>

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

      <section
        className={`relative overflow-hidden rounded-3xl border border-zinc-300/50 bg-gradient-to-br from-[#f4f1ea] via-[#ebe6dc] to-[#e2ddd3] text-zinc-900 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.45)] ${guaranteeShell}`}
        aria-labelledby="risk-free-guarantee-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.12'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Refund policy</p>
          <h2 id="risk-free-guarantee-heading" className="font-display mt-3 text-2xl font-black tracking-tight md:text-3xl">
            Try it for 7 days. Risk-free.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-700 md:text-lg">
            If you don&apos;t find the alerts useful,{' '}
            <a href={SUPPORT_MAIL} className="font-semibold text-zinc-900 underline decoration-zinc-400 underline-offset-4 hover:decoration-zinc-800">
              email us
            </a>{' '}
            within 7 days and we&apos;ll refund you.
          </p>
          <p className="mt-3 text-sm font-medium text-zinc-800">No complicated process.</p>
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
