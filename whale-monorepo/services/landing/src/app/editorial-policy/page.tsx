import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Editorial Policy — Sight Whale',
  description: 'How Sight Whale publishes analysis, uses automation, and handles corrections.',
  alternates: { canonical: '/editorial-policy' },
  openGraph: {
    title: 'Editorial Policy — Sight Whale',
    description: 'How Sight Whale publishes analysis, uses automation, and handles corrections.',
    type: 'website',
    url: 'https://www.sightwhale.com/editorial-policy',
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

export default function EditorialPolicyPage() {
  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-12%] w-[45%] h-[45%] bg-violet-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[45%] h-[45%] bg-cyan-500/10 rounded-full blur-[140px]" />
      </div>

      <Header />

      <main className="mx-auto max-w-4xl px-6 pt-32 pb-24 relative space-y-10">
        <section className="space-y-4">
          <p className="text-xs font-bold text-violet-400 tracking-[0.35em] uppercase">
            Editorial policy
          </p>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            Trust is a product feature.
          </h1>
          <p className="text-gray-400 leading-relaxed max-w-3xl">
            Sight Whale publishes content to help readers interpret prediction market signals. We
            aim to be clear about what we know, what we infer, and what we do not know.
          </p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6">
          <h2 className="text-xl font-semibold text-white">What we publish</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-300">
            <div className="space-y-2">
              <p className="font-semibold text-white">Product content</p>
              <ul className="space-y-2">
                <li>Real-time whale alerts and market summaries</li>
                <li>Wallet profiles, performance aggregates, and trade history</li>
                <li>Collections that group repeatable behaviors</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-white">Blog content</p>
              <ul className="space-y-2">
                <li>Data snapshots and high-level interpretation</li>
                <li>Educational explainers about market mechanics</li>
                <li>Methodology notes and limitations</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-black/30 p-8 space-y-6">
          <h2 className="text-xl font-semibold text-white">Automation & AI</h2>
          <div className="space-y-3 text-sm text-gray-300">
            <p>
              Some blog posts may be generated or assisted by automation, including language models.
              When we use automation, our goal is to present the underlying numbers clearly and
              consistently, not to fabricate facts.
            </p>
            <p>
              We do not claim certainty where none exists. We avoid sensational language and treat
              probabilistic markets as probabilistic.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6">
          <h2 className="text-xl font-semibold text-white">Corrections</h2>
          <div className="space-y-3 text-sm text-gray-300">
            <p>
              If you believe a post contains an error (data, attribution, or interpretation), please
              email{' '}
              <a className="text-violet-300 hover:text-violet-200 underline underline-offset-4" href="mailto:support@sightwhale.com">
                support@sightwhale.com
              </a>
              .
            </p>
            <p>
              When we confirm an issue, we update the content and, when appropriate, add a note to
              clarify what changed.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-4">
          <h2 className="text-xl font-semibold text-white">Disclosures</h2>
          <div className="space-y-3 text-sm text-gray-300">
            <p>
              We are not affiliated with Polymarket unless explicitly stated. Product names and
              trademarks belong to their respective owners.
            </p>
            <p>
              Sight Whale content is informational and not investment advice. Trading prediction
              markets involves risk.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

