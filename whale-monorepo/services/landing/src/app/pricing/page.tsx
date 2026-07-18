import { Suspense } from 'react';
import { unstable_cache } from 'next/cache';
import Link from 'next/link';
import { PRICING_PLAN_CARDS } from '@/lib/pricing-plans';
import { Check, Shield, Sparkles } from 'lucide-react';
import { BreadcrumbListScript } from '@/components/BreadcrumbListScript';

const API_BASE = process.env.TRADE_INGEST_API_URL || 'https://sightwhale.onrender.com';

const loadCachedPricingStats = unstable_cache(
  async () => {
    const res = await fetch(`${API_BASE}/stats/pricing`);
    if (!res.ok) throw new Error(`Pricing stats API ${res.status}`);
    return res.json() as Promise<{ total: number; avgSize: number | null }>;
  },
  ['pricing-stats-v2'],
  { revalidate: 300 },
);

export const metadata = {
  title: { absolute: 'SightWhale Pricing — Polymarket Whale Tracking Plans' },
  description:
    'Polymarket whale tracking plans starting at $29/mo. Real-time Telegram alerts, verified win rates, full PnL history. Full refund in your first month.',
  openGraph: {
    title: 'SightWhale Pricing — Polymarket Whale Tracking Plans',
    description:
      'Polymarket whale tracking plans starting at $29/mo. Real-time Telegram alerts, verified win rates, full PnL history. Full refund in your first month.',
    type: 'website',
    url: 'https://www.sightwhale.com/pricing',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SightWhale Pricing — Polymarket Whale Tracking Plans',
    description:
      'Polymarket whale tracking plans starting at $29/mo. Real-time Telegram alerts, verified win rates, full PnL history. Full refund in your first month.',
    images: ['/opengraph-image'],
  },
  alternates: {
    canonical: '/pricing',
  },
};

const FAQ = [
  {
    q: 'How does the refund work?',
    a: 'If SightWhale is not profitable for you in your first month, email castro.liu@me.com and we will refund your subscription in full. No forms, no arguing.',
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

const pricingJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Product',
      '@id': 'https://www.sightwhale.com/pricing#pro',
      name: 'SightWhale Pro',
      description:
        'Real-time Polymarket whale trade alerts with verified win rates and full PnL history. Everything in Free plus live signals and Telegram delivery.',
      image: 'https://www.sightwhale.com/opengraph-image',
      brand: { '@type': 'Brand', name: 'SightWhale' },
      category: 'Software',
      offers: {
        '@type': 'Offer',
        price: 29,
        priceCurrency: 'USD',
        priceValidUntil: '2027-12-31',
        availability: 'https://schema.org/InStock',
        url: 'https://www.sightwhale.com/subscribe?plan=pro',
      },
      dateModified: '2026-07-18',
    },
    {
      '@type': 'Product',
      '@id': 'https://www.sightwhale.com/pricing#elite',
      name: 'SightWhale Elite',
      description:
        'Everything in Pro plus Smart Collections, advanced wallet clustering, and priority delivery.',
      image: 'https://www.sightwhale.com/opengraph-image',
      brand: { '@type': 'Brand', name: 'SightWhale' },
      category: 'Software',
      offers: {
        '@type': 'Offer',
        price: 59,
        priceCurrency: 'USD',
        priceValidUntil: '2027-12-31',
        availability: 'https://schema.org/InStock',
        url: 'https://www.sightwhale.com/subscribe?plan=elite',
      },
      dateModified: '2026-07-18',
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQ.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
  ],
};

async function PricingValueAnchor() {
  try {
    const stats = await loadCachedPricingStats();
    return (
      <div className="grid gap-5 sm:grid-cols-2 mb-10">
        <div className="rounded-lg border border-border bg-surface px-5 py-4 text-center">
          <p className="text-2xl font-bold tabular-nums stat-number text-foreground">
            {stats.avgSize != null ? `$${(stats.avgSize / 1000).toFixed(0)}k` : '—'}
          </p>
          <p className="text-xs text-muted mt-1">Avg signal size</p>
        </div>
        <div className="rounded-lg border border-border bg-surface px-5 py-4 text-center">
          <p className="text-2xl font-bold tabular-nums stat-number text-foreground">{stats.total}</p>
          <p className="text-xs text-muted mt-1">Verified signals</p>
        </div>
      </div>
    );
  } catch {
    return null;
  }
}

export default function PricingPage() {
  const [firstPlan, secondPlan] = PRICING_PLAN_CARDS;

  return (
    <div className="min-h-screen text-foreground selection:bg-accent selection:text-white overflow-hidden">
      {/* JSON-LD structured data — Product + Offer + FAQPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />
      <BreadcrumbListScript items={[{ name: 'Pricing', url: '/pricing' }]} />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-28 sm:pt-36 pb-16">
        <header className="mb-12 max-w-2xl">
          <p className="eyebrow mb-4">Pricing</p>
          <h1 className="text-balance mb-4">
            SightWhale Pricing — Polymarket Whale Tracking Plans
          </h1>
          <p className="text-muted text-sm sm:text-base max-w-xl leading-relaxed">
            Verify performance on History first. Upgrade when you want today&apos;s real-time stream.
            Prices effective as of July 2026.
          </p>
        </header>

        <Suspense fallback={null}>
          <PricingValueAnchor />
        </Suspense>

        <div className="mb-10 rounded-lg bg-accent/[0.06] card-shadow px-6 py-5">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-accent shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Money-back guarantee — first month, full refund</p>
              <p className="text-sm text-muted leading-relaxed">
                Not satisfied? Email{' '}
                <a href="mailto:castro.liu@me.com" className="underline decoration-accent/30 underline-offset-4 text-accent font-semibold">castro.liu@me.com</a>
                {' '}within your first month. No forms, no arguing.
              </p>
            </div>
          </div>
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
      </div>
    </div>
  );
}
