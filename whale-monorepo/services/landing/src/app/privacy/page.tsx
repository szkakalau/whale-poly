import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Privacy — SightWhale.com',
  description: 'Privacy policy for SightWhale.com.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Privacy — SightWhale.com',
    description: 'Privacy policy for SightWhale.com.',
    type: 'website',
    url: 'https://www.sightwhale.com/privacy',
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

export default function PrivacyPage() {
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
            Privacy
          </p>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-400">
            Effective date: {effectiveDate}
          </p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6 text-sm text-gray-300 leading-relaxed">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">What we collect</h2>
            <ul className="space-y-2">
              <li>Account identifiers you provide (e.g., email, Telegram ID) when you sign in or connect services.</li>
              <li>Usage data needed to operate the site (e.g., request logs, error logs) for security and reliability.</li>
              <li>Payment-related metadata when you subscribe (handled by our payment provider; we do not store full card details).</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">How we use data</h2>
            <ul className="space-y-2">
              <li>To provide the service (alerts, subscriptions, settings, dashboards).</li>
              <li>To secure the platform and prevent abuse.</li>
              <li>To improve product performance and user experience.</li>
              <li>To communicate important service updates.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Data sharing</h2>
            <p>
              We may share limited data with service providers strictly to operate the product (hosting,
              payments, analytics). We do not sell personal data.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Your choices</h2>
            <ul className="space-y-2">
              <li>You can request access, correction, or deletion of your account data.</li>
              <li>You can disconnect Telegram or stop subscriptions at any time.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Contact</h2>
            <p>
              Questions about privacy? Email{' '}
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

