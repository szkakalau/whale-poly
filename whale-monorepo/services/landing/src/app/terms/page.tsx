import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Terms — SightWhale.com' },
  description: 'Terms of service for SightWhale.com.',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Terms — SightWhale.com',
    description: 'Terms of service for SightWhale.com.',
    type: 'website',
    url: 'https://www.sightwhale.com/terms',
  },
};

export default function TermsPage() {
  const effectiveDate = '2026-03-03';

  return (
    <div className="min-h-screen selection:bg-accent selection:text-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-28 sm:pt-36 pb-24 sm:pb-32">
        {/* ── Hero ── */}
        <p className="eyebrow mb-4">Terms</p>
        <h1 className="text-balance mb-3">Terms of Service</h1>
        <p className="text-sm text-subtle mb-10">Effective date: {effectiveDate}</p>

        {/* ── Content ── */}
        <div className="rounded-lg border border-border bg-surface p-6 sm:p-8 space-y-8 text-sm text-muted leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Service description</h2>
            <p>
              SightWhale.com provides informational tools for tracking publicly observable prediction market
              activity and delivering alerts. We do not execute trades, custody assets, or provide brokerage
              services.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">No investment advice</h2>
            <p>
              Content and alerts are provided for informational purposes only and do not constitute
              financial, legal, or investment advice. You are solely responsible for your decisions.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Subscriptions</h2>
            <p>
              Paid plans may renew automatically unless canceled. Plan features and limits may change over
              time as the product evolves. We may suspend or terminate accounts for abuse or violations of
              these terms.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Availability and accuracy</h2>
            <p>
              We aim to provide timely and accurate data, but we do not guarantee completeness, accuracy, or
              availability. Upstream data sources can be delayed or incomplete.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Contact</h2>
            <p>
              Questions about these terms? Email{' '}
              <a className="text-accent hover:text-accent-hover underline underline-offset-2 font-medium" href="mailto:castro.liu@me.com">
                castro.liu@me.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
