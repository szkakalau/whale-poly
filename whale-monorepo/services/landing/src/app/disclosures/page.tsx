import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Disclosures — Sight Whale',
  description: 'Disclosures about affiliations, conflicts of interest, and how Sight Whale is funded.',
  alternates: { canonical: '/disclosures' },
  openGraph: {
    title: 'Disclosures — Sight Whale',
    description: 'Disclosures about affiliations, conflicts of interest, and how Sight Whale is funded.',
    type: 'website',
    url: 'https://www.sightwhale.com/disclosures',
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

export default function DisclosuresPage() {
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
            Disclosures
          </p>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            Disclosures and conflicts of interest
          </h1>
          <p className="text-sm text-gray-400">
            Effective date: {effectiveDate}
          </p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6 text-sm text-gray-300 leading-relaxed">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Not affiliated</h2>
            <p>
              Sight Whale is an independent product. We are not affiliated with Polymarket unless
              explicitly stated. “Polymarket” and related trademarks belong to their respective owners.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Conflicts of interest</h2>
            <ul className="space-y-2">
              <li>Sight Whale team members may hold positions in prediction markets.</li>
              <li>We may publish analysis on markets where we also trade.</li>
              <li>We do not guarantee that alerts reflect our own positions or views.</li>
            </ul>
            <p>
              We aim to present data-driven context. Treat all content as informational and do your own
              research.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">How we make money</h2>
            <p>
              Sight Whale may earn revenue from subscriptions and product upgrades. We do not accept
              payment to manipulate alerts or fabricate signals.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Sponsorships and advertising</h2>
            <p>
              If we run sponsored content or paid partnerships, we will label them clearly. We do not
              sell individual user data.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Contact</h2>
            <p>
              Questions about disclosures? Email{' '}
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

