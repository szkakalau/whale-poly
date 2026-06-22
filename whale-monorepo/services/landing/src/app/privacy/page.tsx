import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Privacy — SightWhale.com' },
  description: 'Privacy policy for SightWhale.com.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Privacy — SightWhale.com',
    description: 'Privacy policy for SightWhale.com.',
    type: 'website',
    url: 'https://www.sightwhale.com/privacy',
  },
};

export default function PrivacyPage() {
  const effectiveDate = '2026-03-03';

  return (
    <div className="min-h-screen selection:bg-accent selection:text-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-28 sm:pt-36 pb-24 sm:pb-32">
        {/* ── Hero ── */}
        <p className="eyebrow mb-4">Privacy</p>
        <h1 className="text-balance mb-3">Privacy Policy</h1>
        <p className="text-sm text-subtle mb-10">Effective date: {effectiveDate}</p>

        {/* ── Content ── */}
        <div className="rounded-lg border border-border bg-surface p-6 sm:p-8 space-y-8 text-sm text-muted leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">What we collect</h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>Account identifiers you provide (e.g., email, Telegram ID) when you sign in or connect services.</li>
              <li>Usage data needed to operate the site (e.g., request logs, error logs) for security and reliability.</li>
              <li>Payment-related metadata when you subscribe (handled by our payment provider; we do not store full card details).</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">How we use data</h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>To provide the service (alerts, subscriptions, settings, dashboards).</li>
              <li>To secure the platform and prevent abuse.</li>
              <li>To improve product performance and user experience.</li>
              <li>To communicate important service updates.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Data sharing</h2>
            <p>
              We may share limited data with service providers strictly to operate the product (hosting,
              payments, analytics). We do not sell personal data.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Your choices</h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>You can request access, correction, or deletion of your account data.</li>
              <li>You can disconnect Telegram or stop subscriptions at any time.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Contact</h2>
            <p>
              Questions about privacy? Email{' '}
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
