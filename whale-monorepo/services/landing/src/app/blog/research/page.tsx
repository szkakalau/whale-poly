import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getAllPosts } from '@/lib/blog';

export const metadata = {
  title: 'Research Series - Polymarket Whale Intelligence',
  description: 'A structured research library on whale signals, timing, and market behavior.',
  alternates: {
    canonical: '/blog/research',
  },
};

type Pillar = {
  id: string;
  title: string;
  description: string;
  keywords: string[];
};

const PILLARS: Pillar[] = [
  {
    id: 'signal-timing',
    title: 'Signal Timing & Decay',
    description: 'How fast whale signals decay and when they are still actionable.',
    keywords: ['signal', 'timing', 'half-life', 'decay', 'conviction'],
  },
  {
    id: 'market-microstructure',
    title: 'Market Microstructure',
    description: 'Volume vs conviction, liquidity dynamics, and how price reacts to whales.',
    keywords: ['volume', 'liquidity', 'market', 'microstructure', 'conviction'],
  },
  {
    id: 'risk-portfolio',
    title: 'Risk & Portfolio',
    description: 'Position sizing, portfolio construction, and strategy risk controls.',
    keywords: ['risk', 'portfolio', 'strategy', 'management', 'hedge'],
  },
  {
    id: 'whale-behavior',
    title: 'Whale Behavior',
    description: 'How top wallets behave across categories and market conditions.',
    keywords: ['whale', 'behavior', 'smart money', 'performance'],
  },
];

function matchesKeywords(post: { title: string; tags?: string[] }, keywords: string[]) {
  const hay = `${post.title} ${(post.tags || []).join(' ')}`.toLowerCase();
  return keywords.some((k) => hay.includes(k));
}

export default async function ResearchSeriesPage() {
  const posts = await getAllPosts();
  const researchPosts = posts.filter((post) =>
    (post.tags || []).some((tag) => ['research', 'analysis'].includes(tag.toLowerCase())),
  );
  const latestResearch = researchPosts.slice(0, 6);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Whale Intelligence Library',
    description: 'A structured research library on whale signals, timing, and market behavior.',
    url: 'https://www.sightwhale.com/blog/research',
    hasPart: [
      ...PILLARS.map((pillar, index) => ({
        '@type': 'CreativeWork',
        position: index + 1,
        name: pillar.title,
        description: pillar.description,
      })),
      ...latestResearch.map((post, index) => ({
        '@type': 'Article',
        position: PILLARS.length + index + 1,
        headline: post.title,
        url: `https://www.sightwhale.com/blog/${post.slug}`,
        datePublished: post.date,
        keywords: post.tags?.join(', '),
      })),
    ],
  };

  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/5 rounded-full blur-[120px]"></div>
      </div>

      <Header />

      <main className="mx-auto max-w-6xl px-6 py-32 relative space-y-10">
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <section className="text-center space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Research Series</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white">Whale Intelligence Library</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            A structured collection of research on whale timing, market mechanics, and strategy design.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-gray-400">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Updated weekly</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Curated by SightWhale Research</span>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {PILLARS.map((pillar) => {
            const pillarPosts = researchPosts.filter((post) => matchesKeywords(post, pillar.keywords)).slice(0, 4);
            return (
              <div key={pillar.id} className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">{pillar.title}</h2>
                  <p className="text-xs text-gray-400 mt-2">{pillar.description}</p>
                </div>
                <div className="space-y-2">
                  {pillarPosts.length === 0 ? (
                    <div className="text-xs text-gray-500">New research drops soon.</div>
                  ) : (
                    pillarPosts.map((post) => (
                      <Link
                        key={post.slug}
                        href={`/blog/${post.slug}`}
                        className="block text-sm text-violet-200 hover:text-violet-100"
                      >
                        {post.title}
                      </Link>
                    ))
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {pillarPosts.length} articles
                </div>
              </div>
            );
          })}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Latest research</h2>
            <Link href="/blog" className="text-xs text-gray-400 hover:text-white">
              View all posts
            </Link>
          </div>
          {latestResearch.length === 0 ? (
            <div className="text-sm text-gray-400">Research articles are publishing soon.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {latestResearch.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="rounded-xl border border-white/10 bg-black/30 p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="text-xs text-gray-500">
                    {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div className="text-base font-semibold text-white mt-2">{post.title}</div>
                  <div className="text-xs text-gray-400 mt-2 line-clamp-2">{post.excerpt}</div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 via-transparent to-cyan-500/10 p-6 text-center">
          <h2 className="text-lg font-semibold text-white mb-2">Turn research into live alerts</h2>
          <p className="text-xs text-gray-400 mb-4">
            Subscribe to Smart Collections and receive real-time whale signals on Telegram.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/smart-collections"
              className="inline-flex items-center rounded-full border border-violet-500/60 bg-violet-500/10 px-4 py-2 text-xs font-medium text-violet-100 hover:bg-violet-500/20"
            >
              Explore Smart Collections
            </Link>
            <Link
              href="/subscribe"
              className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-gray-100 hover:bg-white/10"
            >
              Upgrade
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
