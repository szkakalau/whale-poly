import Link from 'next/link';
import { PRICING_PLAN_CARDS } from '@/lib/pricing-plans';
import { Check, Sparkles } from 'lucide-react';

export const metadata = {
  title: 'Pricing — SightWhale',
  description: 'Real-time Polymarket whale signals. Full refund if the product does not meet expectations.',
  alternates: {
    canonical: '/pricing',
  },
};

const FAQ = [
  {
    q: 'How does the refund work?',
    a: 'If SightWhale is not profitable for you in your first month, email support@sightwhale.com and we will refund your subscription in full. No forms, no arguing.',
  },
  {
    q: 'What do I get before paying?',
    a: 'You can review the full historical signal table through end of yesterday UTC on the History page. Today\'s live feed unlocks after checkout.',
  },
  {
    q: 'Do I need Telegram?',
    a: 'No. Telegram is optional. Paid plans include the live signal list in the product; Telegram is an extra delivery channel.',
  },
];

export default function PricingPage() {
  const [firstPlan, secondPlan] = PRICING_PLAN_CARDS;

  return (
    <div className="min-h-screen text-foreground selection:bg-accent selection:text-white overflow-hidden">
      <main className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-28 sm:pt-36 pb-16">
        <header className="mb-12 max-w-2xl">
          <p className="eyebrow mb-4">Pricing</p>
          <h1 className="text-balance mb-4">
            Pay only if it makes sense
          </h1>
          <p className="text-muted text-sm sm:text-base max-w-xl leading-relaxed">
            Verify performance on History first. Upgrade when you want today&apos;s real-time stream.
          </p>
        </header>

        {/* Money-back guarantee banner */}
        <div className="mb-10 rounded-lg border border-accent/20 bg-accent/5 px-5 py-4">
          <p className="text-sm font-medium text-foreground">
            Money-back guarantee: not satisfied this month? Email{' '}
            <a href="mailto:support@sightwhale.com" className="underline decoration-accent/30 underline-offset-4 text-accent font-semibold">
              support@sightwhale.com
            </a>{' '}
            for a full refund.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid gap-6 lg:grid-cols-2 mb-16">
          {[firstPlan, secondPlan].map((plan) => (
            <div
              key={plan.tier}
              className={`rounded-lg border p-8 flex flex-col ${
                plan.highlighted
                  ? 'border-accent/30 bg-accent/[0.04]'
                  : 'border-border bg-surface'
              }`}
            >
              {plan.highlighted ? (
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent mb-3">
                  <Sparkles className="w-3.5 h-3.5" aria-hidden />
                  Most popular
                </div>
              ) : null}
              <h2 className="font-display text-xl font-semibold text-foreground">{plan.name}</h2>
              <p className="text-xs text-muted mt-1">{plan.kicker}</p>
              <div className="mt-6 flex flex-wrap items-baseline gap-2">
                <span className="text-4xl font-semibold tabular-nums">${plan.monthly}</span>
                <span className="text-muted text-sm">/mo</span>
                <span className="text-subtle text-xs ml-2">or ${plan.yearly}/yr</span>
              </div>
              <p className="mt-4 text-sm text-muted leading-relaxed">{plan.description}</p>
              <ul className="mt-6 space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-3 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-8 inline-flex justify-center rounded-lg py-3.5 text-sm font-semibold text-center transition-colors ${
                  plan.highlighted
                    ? 'btn-primary'
                    : 'btn-secondary'
                }`}
              >
                Continue to checkout
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <section className="mb-16">
          <h2 className="font-display text-lg font-semibold text-foreground mb-6">Common questions</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {FAQ.map((item) => (
              <div key={item.q} className="rounded-lg border border-border bg-surface px-6 py-5">
                <h3 className="text-sm font-semibold text-foreground mb-2">{item.q}</h3>
                <p className="text-sm text-muted leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="rounded-lg border border-border bg-surface px-8 py-12 text-center">
          <p className="font-display text-xl font-semibold text-foreground mb-2">Ready for real-time signals?</p>
          <p className="text-sm text-muted mb-6 max-w-md mx-auto">
            Secure checkout with Stripe. Cancel anytime.
          </p>
          <Link href="/subscribe?plan=pro" className="btn-primary inline-flex px-10 py-3.5 text-sm font-semibold">
            Start checkout
          </Link>
        </div>
      </main>
    </div>
  );
}
