import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Terms — Sight Whale',
  description: 'Terms of service for Sight Whale.',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Terms — Sight Whale',
    description: 'Terms of service for Sight Whale.',
    type: 'website',
    url: 'https://www.sightwhale.com/terms',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function TermsPage() {
  const effectiveDate = '2026-03-03';

  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-12%] w-[45%] h-[45%] bg-violet-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[45%] h-[45%] bg-cyan-500/10 rounded-full blur-[140px]" />
      </div>

      <Header />

      <main className="mx-auto max-w-4xl px-6 pt-32 pb-24 relative space-y-10">
        <section className="space-y-3">
          <p className="text-xs font-bold text-gray-400 tracking-[0.35em] uppercase">
            Terms
          </p>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            Terms of Service
          </h1>
          <p className="text-sm text-gray-400">
            Effective date: {effectiveDate}
          </p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6 text-sm text-gray-300 leading-relaxed">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Service description</h2>
            <p>
              Sight Whale provides informational tools for tracking publicly observable prediction market
              activity and delivering alerts. We do not execute trades, custody assets, or provide brokerage
              services.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">No investment advice</h2>
            <p>
              Content and alerts are provided for informational purposes only and do not constitute
              financial, legal, or investment advice. You are solely responsible for your decisions.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Subscriptions</h2>
            <p>
              Paid plans may renew automatically unless canceled. Plan features and limits may change over
              time as the product evolves. We may suspend or terminate accounts for abuse or violations of
              these terms.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Availability and accuracy</h2>
            <p>
              We aim to provide timely and accurate data, but we do not guarantee completeness, accuracy, or
              availability. Upstream data sources can be delayed or incomplete.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Contact</h2>
            <p>
              Questions about these terms? Email{' '}
              <a className="text-violet-300 hover:text-violet-200 underline underline-offset-4" href="mailto:support@sightwhale.com">
                support@sightwhale.com
              </a>
              .
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

