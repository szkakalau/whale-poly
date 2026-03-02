import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getAllFilePosts, getAllPosts, getPostBySlug } from '@/lib/blog';

interface Props {
  params: Promise<{ slug: string }>;
}

export const revalidate = 3600;

export async function generateStaticParams() {
  let posts = getAllFilePosts();
  try {
    posts = await getAllPosts();
  } catch {
    posts = getAllFilePosts();
  }
  return posts.slice(0, 200).map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  
  if (!post) {
    return {
      title: 'Post Not Found - Polymarket Whale Intelligence',
    };
  }

  return {
    title: `${post.title} - Polymarket Whale Intelligence`,
    description: post.excerpt,
    keywords: post.tags,
    authors: [{ name: post.author || 'Whale Team' }],
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
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
      tags: post.tags,
      url: `https://www.sightwhale.com/blog/${slug}`,
      images: [
        {
          url: '/images/whale-alert-biden.svg',
          width: 1200,
          height: 630,
          alt: post.title
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: ['/images/whale-alert-biden.svg']
    },
    alternates: {
      canonical: `/blog/${slug}`,
    },
  };
}

type SpotlightSection = {
  title: string;
  lines: string[];
};

type SpotlightData = {
  windowLine: string | null;
  sections: SpotlightSection[];
};

const SPOTLIGHT_TITLES = new Set([
  'Big Spender',
  'Contrarian Signal',
  'High Win-Rate Sniper',
  'Market Read',
  'Disclaimer',
]);

function parseDailySpotlight(raw: string): SpotlightData {
  const lines = raw.split(/\r?\n/).map((line) => line.trim());
  const sections: SpotlightSection[] = [];
  let windowLine: string | null = null;
  let current: SpotlightSection | null = null;
  for (const line of lines) {
    if (!line) {
      continue;
    }
    if (line.startsWith('Window:')) {
      windowLine = line.replace(/^Window:\s*/, '');
      continue;
    }
    const normalizedTitle = line.replace(/^#{1,6}\s*/, '');
    if (SPOTLIGHT_TITLES.has(line) || SPOTLIGHT_TITLES.has(normalizedTitle)) {
      if (current) {
        sections.push(current);
      }
      current = { title: SPOTLIGHT_TITLES.has(normalizedTitle) ? normalizedTitle : line, lines: [] };
      continue;
    }
    if (!current) {
      continue;
    }
    current.lines.push(line);
  }
  if (current) {
    sections.push(current);
  }
  return { windowLine, sections };
}

function extractKeyValues(lines: string[]) {
  const kv: Array<{ label: string; value: string }> = [];
  const rest: string[] = [];
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const label = line
        .slice(0, idx)
        .trim()
        .replace(/^[-*]\s+/, '')
        .replace(/^#{1,6}\s*/, '');
      const value = line.slice(idx + 1).trim();
      if (label && value) {
        kv.push({ label, value });
        continue;
      }
    }
    rest.push(line);
  }
  return { kv, rest };
}

function extractWallets(spotlight: SpotlightData): string[] {
  const found = new Set<string>();
  const re = /0x[a-fA-F0-9]{40}/g;
  for (const section of spotlight.sections) {
    for (const line of section.lines) {
      const matches = line.match(re);
      if (matches) {
        for (const m of matches) {
          found.add(m.toLowerCase());
        }
      }
    }
    const { kv } = extractKeyValues(section.lines);
    for (const item of kv) {
      const matches = item.value.match(re);
      if (matches) {
        for (const m of matches) {
          found.add(m.toLowerCase());
        }
      }
    }
  }
  return Array.from(found);
}

function extractMarkets(spotlight: SpotlightData): Array<{ label: string; url: string }> {
  const candidates: string[] = [];
  const allowLabel = /market|question|event/i;
  const urlRe = /^https?:\/\//i;

  for (const section of spotlight.sections) {
    const { kv, rest } = extractKeyValues(section.lines);

    for (const item of kv) {
      if (!allowLabel.test(item.label)) continue;
      const v = item.value.trim();
      if (!v) continue;
      candidates.push(v);
    }

    for (const line of rest) {
      const m = line.match(/^(Market|Question|Event)\s*:\s*(.+)$/i);
      if (!m) continue;
      const v = String(m[2] || '').trim();
      if (!v) continue;
      candidates.push(v);
    }
  }

  const seen = new Set<string>();
  const out: Array<{ label: string; url: string }> = [];
  for (const raw of candidates) {
    const v = raw.replace(/\s+/g, ' ').trim();
    if (v.length < 8) continue;
    if (v.length > 180) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    if (urlRe.test(v)) {
      out.push({ label: v, url: v });
      continue;
    }

    const url = `https://polymarket.com/search?q=${encodeURIComponent(v)}`;
    out.push({ label: v, url });
  }

  return out.slice(0, 4);
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const safePost = post as NonNullable<typeof post>;
  const isDailySpotlight = safePost.slug.startsWith('daily-spotlight-');
  const spotlight = isDailySpotlight ? parseDailySpotlight(safePost.content) : null;
  const allSpotlightWallets = spotlight ? extractWallets(spotlight) : [];
  const spotlightWallets = allSpotlightWallets.slice(0, 4);
  const spotlightMarkets = spotlight ? extractMarkets(spotlight) : [];
  const polymarketSearchUrl = `https://polymarket.com/search?q=${encodeURIComponent(
    spotlightMarkets[0]?.label || safePost.title,
  )}`;
  const spotlightSignalsCount = spotlight
    ? spotlight.sections.filter((section) => section.title !== 'Market Read' && section.title !== 'Disclaimer').length
    : 0;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: safePost.title,
    description: safePost.excerpt,
    datePublished: safePost.date,
    dateModified: safePost.date,
    author: [
      {
        "@type": "Organization",
        name: safePost.author || "Whale Team"
      }
    ],
    publisher: {
      "@type": "Organization",
      name: "Sight Whale",
      url: "https://www.sightwhale.com",
      logo: {
        "@type": "ImageObject",
        url: "https://www.sightwhale.com/images/og-image.png"
      }
    },
    isPartOf: {
      "@type": "Blog",
      "@id": "https://www.sightwhale.com/blog"
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://www.sightwhale.com/blog/${slug}`
    },
    image: [
      "https://www.sightwhale.com/images/whale-alert-biden.svg"
    ],
    inLanguage: "en-US",
    keywords: safePost.tags?.join(", ")
  };

  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      {/* Background Effects */}
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/5 rounded-full blur-[120px]"></div>
      </div>

      <Header />

      <main className="mx-auto max-w-3xl px-6 py-32 relative">
        <Link href="/blog" className="inline-flex items-center text-sm text-gray-400 hover:text-white mb-8 transition-colors">
          ← Back to Intelligence Log
        </Link>

        <article>
          <script
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
          />
          <header className="mb-12 text-center">
            <div className="flex flex-wrap justify-center items-center gap-3 text-sm text-gray-400 mb-6">
              <time dateTime={safePost.date}>{new Date(safePost.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
              <span>•</span>
              <div className="flex gap-2">
                {safePost.tags?.map(tag => (
                  <span key={tag} className="px-3 py-1 rounded-full bg-white/5 text-sm text-gray-300 border border-white/10">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
            
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
              {safePost.title}
            </h1>
            
            <p className="text-xl text-gray-300 leading-relaxed max-w-2xl mx-auto">
              {safePost.excerpt}
            </p>
          </header>

          {isDailySpotlight && spotlight ? (
            <div className="space-y-10">
              <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-gray-400">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 uppercase tracking-[0.2em] text-[11px] text-violet-300">
                  Daily Spotlight
                </span>
                {spotlight.windowLine ? (
                  <span className="text-gray-400">{spotlight.windowLine}</span>
                ) : null}
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6">
                <div className="flex flex-col gap-2">
                  <p className="text-sm uppercase tracking-[0.2em] text-gray-400">Today at a glance</p>
                  <div className="text-sm text-gray-300">
                    Verification-friendly summary extracted from today’s spotlight.
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Time window</p>
                        <p className="mt-2 font-semibold text-white">
                          {spotlight.windowLine || 'Not provided'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-gray-200">
                          Signals: {spotlightSignalsCount}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-gray-200">
                          Wallets: {allSpotlightWallets.length}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-gray-200">
                          Markets: {spotlightMarkets.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {spotlightMarkets.length > 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Markets</p>
                      <div className="mt-2 space-y-2">
                        {spotlightMarkets.slice(0, 3).map((m) => (
                          <a
                            key={m.url}
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sm text-violet-300 hover:text-violet-200 underline underline-offset-4"
                          >
                            {m.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {spotlightWallets.length > 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Wallets</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {spotlightWallets.map((w) => (
                          <Link
                            key={w}
                            href={`/whales/${encodeURIComponent(w)}`}
                            className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-mono text-violet-200 hover:bg-white/10"
                          >
                            {w.slice(0, 6)}…{w.slice(-4)}
                          </Link>
                        ))}
                      </div>
                      {allSpotlightWallets.length > spotlightWallets.length ? (
                        <div className="mt-3 text-xs text-gray-500">
                          Showing {spotlightWallets.length} of {allSpotlightWallets.length}. Use the leaderboard for more.
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Verify</p>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <a
                        href={polymarketSearchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-gray-200 hover:bg-white/10 transition-colors"
                      >
                        <div className="font-semibold text-white">Polymarket search</div>
                        <div className="mt-1 text-xs text-gray-400">Open the closest market context we can infer.</div>
                      </a>
                      <a
                        href="https://clob.polymarket.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-gray-200 hover:bg-white/10 transition-colors"
                      >
                        <div className="font-semibold text-white">CLOB API</div>
                        <div className="mt-1 text-xs text-gray-400">Validate order book and recent moves.</div>
                      </a>
                      <Link
                        href="/methodology"
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-gray-200 hover:bg-white/10 transition-colors"
                      >
                        <div className="font-semibold text-white">Methodology</div>
                        <div className="mt-1 text-xs text-gray-400">How alerts and scoring are generated.</div>
                      </Link>
                      <Link
                        href="/smart-money"
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-gray-200 hover:bg-white/10 transition-colors"
                      >
                        <div className="font-semibold text-white">Leaderboard</div>
                        <div className="mt-1 text-xs text-gray-400">Explore wallets with track records.</div>
                      </Link>
                    </div>
                    {spotlightMarkets.length === 0 && spotlightWallets.length === 0 ? (
                      <div className="mt-4 text-xs text-gray-500 leading-relaxed">
                        This post may not include explicit wallet addresses or market titles. The summary still provides the time window and spotlight signals below, plus verification links above.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                {spotlight.sections
                  .filter((section) => section.title !== 'Market Read' && section.title !== 'Disclaimer')
                  .map((section) => {
                    const { kv, rest } = extractKeyValues(section.lines);
                    return (
                      <div
                        key={section.title}
                        className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
                      >
                        <p className="text-sm uppercase tracking-[0.2em] text-gray-400">{section.title}</p>
                        <div className="mt-4 space-y-3 text-sm">
                          {kv.map((item) => (
                            <div key={`${section.title}-${item.label}`} className="flex items-start justify-between gap-4">
                              <span className="text-gray-400">{item.label}</span>
                              <span className="text-right font-semibold text-white">{item.value}</span>
                            </div>
                          ))}
                          {rest.map((line) => (
                            <p key={`${section.title}-${line}`} className="text-gray-300">
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {spotlight.sections
                .filter((section) => section.title === 'Market Read')
                .map((section) => (
                  <div key={section.title} className="rounded-3xl border border-white/10 bg-white/5 p-8">
                    <p className="text-sm uppercase tracking-[0.2em] text-gray-400">{section.title}</p>
                    <ul className="mt-4 space-y-3 text-gray-200">
                      {section.lines.map((line) => (
                        <li key={line} className="flex items-start gap-3">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-400"></span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

              {spotlight.sections
                .filter((section) => section.title === 'Disclaimer')
                .map((section) => (
                  <div key={section.title} className="text-xs text-gray-500">
                    {section.lines.join(' ')}
                  </div>
                ))}

              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-gray-400">Sources</p>
                  <div className="mt-3 space-y-2 text-sm text-gray-200">
                    <a
                      href="https://polymarket.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-300 hover:text-violet-200 underline underline-offset-4"
                    >
                      Polymarket (markets and prices)
                    </a>
                    <div className="text-xs text-gray-500">
                      Public market metadata and pricing context.
                    </div>
                    <a
                      href="https://clob.polymarket.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-300 hover:text-violet-200 underline underline-offset-4"
                    >
                      Polymarket CLOB API
                    </a>
                    <div className="text-xs text-gray-500">
                      Public order book endpoints used for best-effort verification.
                    </div>
                    {spotlightMarkets.length > 0 ? (
                      <div className="pt-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Market links</div>
                        <div className="mt-2 space-y-2">
                          {spotlightMarkets.slice(0, 3).map((m) => (
                            <a
                              key={m.url}
                              href={m.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-violet-300 hover:text-violet-200 underline underline-offset-4"
                            >
                              {m.url.startsWith('https://polymarket.com/search') ? `Polymarket search: ${m.label}` : m.label}
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-gray-400">Use this signal</p>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Link
                      href="/smart-money"
                      className="rounded-2xl border border-white/10 bg-black/30 p-4 hover:bg-white/5 transition-colors"
                    >
                      <div className="text-sm font-semibold text-white">Smart Money Leaderboard</div>
                      <div className="mt-1 text-xs text-gray-400">Discover top wallets and recent performance.</div>
                    </Link>
                    <Link
                      href="/smart-collections"
                      className="rounded-2xl border border-white/10 bg-black/30 p-4 hover:bg-white/5 transition-colors"
                    >
                      <div className="text-sm font-semibold text-white">Smart Collections</div>
                      <div className="mt-1 text-xs text-gray-400">Subscribe to strategy bundles for higher signal density.</div>
                    </Link>
                    <Link
                      href="/follow"
                      className="rounded-2xl border border-white/10 bg-black/30 p-4 hover:bg-white/5 transition-colors"
                    >
                      <div className="text-sm font-semibold text-white">Set up alerts</div>
                      <div className="mt-1 text-xs text-gray-400">Follow wallets and receive Telegram alerts.</div>
                    </Link>
                    <Link
                      href="/subscribe"
                      className="rounded-2xl border border-violet-500/40 bg-violet-500/10 p-4 hover:bg-violet-500/15 transition-colors"
                    >
                      <div className="text-sm font-semibold text-white">Upgrade</div>
                      <div className="mt-1 text-xs text-gray-400">Unlock higher limits and premium signals.</div>
                    </Link>
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  Methodology: <Link className="text-gray-300 hover:text-white underline underline-offset-4" href="/methodology">how we generate alerts</Link>. Editorial policy: <Link className="text-gray-300 hover:text-white underline underline-offset-4" href="/editorial-policy">how we publish</Link>.
                </div>
              </div>
            </div>
          ) : (
            <div className="prose prose-invert prose-lg max-w-none prose-headings:font-bold prose-headings:text-white prose-a:text-violet-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-white prose-code:text-violet-200 prose-code:bg-violet-900/30 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[#1a1a1a] prose-pre:border prose-pre:border-white/10 prose-blockquote:border-l-violet-500 prose-blockquote:bg-white/5 prose-blockquote:py-2 prose-blockquote:pr-4 prose-li:marker:text-violet-500">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {safePost.content}
              </ReactMarkdown>
            </div>
          )}
        </article>

        {/* Share/CTA Section */}
        <div className="mt-20 pt-10 border-t border-white/10 text-center">
          <h3 className="text-xl font-bold text-white mb-4">Want real-time whale alerts?</h3>
          <p className="text-gray-400 mb-8">Get notified when smart money moves.</p>
          <Link href="/" className="btn-primary px-8 py-3">
            Start Tracking →
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
