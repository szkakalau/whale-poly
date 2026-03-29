import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'About — SightWhale.com',
  description: 'SightWhale.com helps you track smart money on Polymarket with real-time alerts and transparent methodology.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About — SightWhale.com',
    description: 'Track smart money on Polymarket with real-time alerts and transparent methodology.',
    type: 'website',
    url: 'https://www.sightwhale.com/about',
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

export default function AboutPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'SightWhale.com',
    url: 'https://www.sightwhale.com',
    logo: 'https://www.sightwhale.com/images/og-image.png',
    description:
      'SightWhale.com helps traders track smart money behavior on Polymarket and receive real-time alerts.',
    sameAs: ['https://t.me/sightwhale_bot'],
  };

  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-12%] w-[45%] h-[45%] bg-violet-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[45%] h-[45%] bg-cyan-500/10 rounded-full blur-[140px]" />
      </div>

      <Header />

      <main className="mx-auto max-w-4xl px-6 pt-32 pb-24 relative space-y-10">
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />

        <section className="space-y-4">
          <p className="text-xs font-bold text-violet-400 tracking-[0.35em] uppercase">
            About
          </p>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            Built for traders who follow the money.
          </h1>
          <p className="text-gray-400 leading-relaxed max-w-2xl">
            SightWhale.com is an intelligence layer for Polymarket. We identify historically profitable
            wallets, summarize high-conviction activity, and deliver real-time alerts so you can
            react faster with more context.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-wide text-gray-400">Focus</p>
            <p className="mt-3 text-sm text-gray-200 leading-relaxed">
              We prioritize signal density: large, timely trades from wallets with measurable
              performance history.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-wide text-gray-400">Transparency</p>
            <p className="mt-3 text-sm text-gray-200 leading-relaxed">
              Our product pages and blog include methodology notes and data snapshots so you can
              sanity-check what you see.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-wide text-gray-400">Speed</p>
            <p className="mt-3 text-sm text-gray-200 leading-relaxed">
              Alerts are designed for action: delivered to Telegram with the key numbers and links
              you need.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6">
          <h2 className="text-xl font-semibold text-white">What SightWhale.com is (and isn&apos;t)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-300">
            <div className="space-y-2">
              <p className="font-semibold text-white">We are</p>
              <ul className="space-y-2">
                <li>Real-time alerts for notable Polymarket trade flow</li>
                <li>Performance-aware wallet tracking and collections</li>
                <li>Educational analysis focused on market mechanics and signal interpretation</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-white">We are not</p>
              <ul className="space-y-2">
                <li>A broker, exchange, or wallet custody service</li>
                <li>Financial, legal, or investment advice</li>
                <li>Affiliated with Polymarket (unless explicitly stated)</li>
              </ul>
            </div>
          </div>
          <div className="text-xs text-gray-500 leading-relaxed">
            Risk disclosure: prediction markets are high risk. Past performance does not guarantee
            future results. You are responsible for your own decisions.
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-black/30 p-8 space-y-4">
          <h2 className="text-xl font-semibold text-white">Contact</h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            For product questions, partnerships, or press, reach us at{' '}
            <a className="text-violet-300 hover:text-violet-200 underline underline-offset-4" href="mailto:support@sightwhale.com">
              support@sightwhale.com
            </a>
            . You can also access the Telegram bot from the site footer.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}

