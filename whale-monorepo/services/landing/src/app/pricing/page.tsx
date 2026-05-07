import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Pricing — SightWhale',
  description: 'Real-time Polymarket whale signals. Full refund if the product does not meet expectations.',
  alternates: {
    canonical: '/pricing',
  },
};

const PLANS = [
  {
    tier: 'pro' as const,
    name: 'Pro',
    monthly: 29,
    yearly: 290,
    kicker: 'Best for most traders',
    description: 'Real-time signals in the app plus optional Telegram.',
    features: [
      'All real-time signals (in-app)',
      'All 70+ Whale Score signals',
      'Optional Telegram (~30s)',
      'Higher follow & collection limits vs Free',
    ],
    href: '/subscribe?plan=pro',
    highlighted: true,
  },
  {
    tier: 'elite' as const,
    name: 'Elite',
    monthly: 59,
    yearly: 590,
    kicker: 'Priority for active traders',
    description: 'Stricter filtering and faster optional Telegram.',
    features: [
      'Everything in Pro',
      '80+ high-conviction signals where applicable',
      'Optional Telegram (~10s priority)',
      'Largest follow & collection limits',
    ],
    href: '/subscribe?plan=elite',
    highlighted: false,
  },
];

const FAQ = [
  {
    q: 'How does the refund work?',
    a: 'If SightWhale is not profitable for you in your first month, email support@sightwhale.com and we will refund your subscription in full. No forms, no arguing.',
  },
  {
    q: 'What do I get before paying?',
    a: 'You can review the full historical signal table through end of yesterday UTC on the History page. Today’s live feed unlocks after checkout.',
  },
  {
    q: 'Do I need Telegram?',
    a: 'No. Telegram is optional. Paid plans include the live signal list in the product; Telegram is an extra delivery channel.',
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen text-foreground selection:bg-[#5B8CFF]/25 overflow-hidden">
      <div className="fixed inset-0 z-[-1] bg-background" />
      <Header />

      <main className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-14 sm:pt-24 pb-16">
        <header className="mb-10 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-violet-400 mb-4">Pricing</p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground mb-4">
            Pay only if it makes sense
          </h1>
          <p className="text-muted text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Verify performance on History first. Upgrade when you want today&apos;s real-time stream.
          </p>
        </header>

        <div className="mb-10 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-4 text-center">
          <p className="text-sm sm:text-base font-semibold text-emerald-100">
            Money-back guarantee: not satisfied this month? Email{' '}
            <a href="mailto:support@sightwhale.com" className="underline decoration-emerald-500/40 underline-offset-4">
              support@sightwhale.com
            </a>{' '}
            for a full refund.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mb-16">
          {PLANS.map((plan) => (
            <div
              key={plan.tier}
              className={`rounded-[2rem] border p-8 flex flex-col ${
                plan.highlighted
                  ? 'border-violet-500/45 bg-violet-500/[0.06] shadow-[0_0_40px_rgba(139,92,246,0.12)]'
                  : 'border-border bg-surface/40'
              }`}
            >
              {plan.highlighted ? (
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-400 mb-3">Most popular</div>
              ) : null}
              <h2 className="text-xl font-black text-foreground">{plan.name}</h2>
              <p className="text-xs text-muted mt-1">{plan.kicker}</p>
              <div className="mt-6 flex flex-wrap items-baseline gap-2">
                <span className="text-4xl font-black tabular-nums">${plan.monthly}</span>
                <span className="text-muted text-sm">/mo</span>
                <span className="text-subtle text-xs ml-2">or ${plan.yearly}/yr</span>
              </div>
              <p className="mt-4 text-sm text-muted leading-relaxed">{plan.description}</p>
              <ul className="mt-6 space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-3 text-sm text-foreground/90">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-8 inline-flex justify-center rounded-xl py-3.5 text-sm font-black text-center transition-colors ${
                  plan.highlighted
                    ? 'bg-violet-600 text-white hover:bg-violet-500'
                    : 'border border-border bg-surface hover:bg-surface-hover text-foreground'
                }`}
              >
                Continue to checkout
              </Link>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-border-muted bg-surface/30 p-6 sm:p-10 mb-12">
          <h2 className="text-lg font-black text-foreground mb-6">Common questions</h2>
          <div className="space-y-6">
            {FAQ.map((item) => (
              <div key={item.q}>
                <h3 className="text-sm font-bold text-foreground mb-2">{item.q}</h3>
                <p className="text-sm text-muted leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="text-center rounded-2xl border border-border bg-surface/50 px-6 py-12">
          <p className="text-lg font-black text-foreground mb-2">Ready for real-time signals?</p>
          <p className="text-sm text-muted mb-6 max-w-md mx-auto">
            Checkout runs on a secure page. You can review plans again before paying.
          </p>
          <Link href="/subscribe?plan=pro" className="btn-primary inline-flex px-8 py-3.5 text-sm font-black rounded-xl">
            Start checkout
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
