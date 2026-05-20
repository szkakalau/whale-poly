import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
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
    a: 'You can review the full historical signal table through end of yesterday UTC on the History page. Today’s live feed unlocks after checkout.',
  },
  {
    q: 'Do I need Telegram?',
    a: 'No. Telegram is optional. Paid plans include the live signal list in the product; Telegram is an extra delivery channel.',
  },
];

export default function PricingPage() {
  const [firstPlan, secondPlan] = PRICING_PLAN_CARDS;

  return (
    <div className="min-h-screen text-foreground selection:bg-accent-primary/25 overflow-hidden">
      <div className="fixed inset-0 z-[-1] bg-background" />
      <Header />

      <main className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-14 sm:pt-24 pb-16 layout-diagonal-band">
        <header className="mb-12 max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-accent-sharp mb-4">Pricing</p>
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-foreground mb-4">
            Pay only if it makes sense
          </h1>
          <p className="text-muted text-sm sm:text-base max-w-xl leading-relaxed">
            Verify performance on History first. Upgrade when you want today&apos;s real-time stream.
          </p>
        </header>

        <div className="mb-10 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-4 max-w-3xl">
          <p className="text-sm sm:text-base font-semibold text-emerald-100">
            Money-back guarantee: not satisfied this month? Email{' '}
            <a href="mailto:support@sightwhale.com" className="underline decoration-emerald-500/40 underline-offset-4">
              support@sightwhale.com
            </a>{' '}
            for a full refund.
          </p>
        </div>

        <div className="layout-pricing-offset mb-16">
          {[firstPlan, secondPlan].map((plan) => (
            <div
              key={plan.tier}
              className={`rounded-[2rem] border p-8 flex flex-col relative ${
                plan.highlighted
                  ? 'border-accent-primary/45 bg-accent-primary/[0.07] shadow-[0_0_48px_oklch(0.62_0.17_220_/_0.15)] z-10'
                  : 'border-border bg-surface/40'
              }`}
            >
              {plan.highlighted ? (
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-accent-sharp mb-3">
                  <Sparkles className="w-3.5 h-3.5" aria-hidden />
                  Most popular
                </div>
              ) : null}
              <h2 className="font-display text-xl font-black text-foreground">{plan.name}</h2>
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
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-sharp" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-8 inline-flex justify-center rounded-xl py-3.5 text-sm font-black text-center transition-colors ${
                  plan.highlighted
                    ? 'bg-accent-primary text-white hover:bg-accent-hover'
                    : 'border border-border bg-surface hover:bg-surface-hover text-foreground'
                }`}
              >
                Continue to checkout
              </Link>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-border-muted bg-surface/30 p-6 sm:p-10 mb-12 max-w-3xl ml-0 sm:ml-[8%]">
          <h2 className="font-display text-lg font-black text-foreground mb-6">Common questions</h2>
          <div className="space-y-6">
            {FAQ.map((item) => (
              <div key={item.q}>
                <h3 className="text-sm font-bold text-foreground mb-2">{item.q}</h3>
                <p className="text-sm text-muted leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="text-center sm:text-left rounded-2xl border border-border bg-surface/50 px-6 py-12 max-w-xl sm:translate-x-[14%]">
          <p className="font-display text-lg font-black text-foreground mb-2">Ready for real-time signals?</p>
          <p className="text-sm text-muted mb-6 max-w-md">
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
