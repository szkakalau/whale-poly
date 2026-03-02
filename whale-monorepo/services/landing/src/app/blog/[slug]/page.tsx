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
    if (SPOTLIGHT_TITLES.has(line)) {
      if (current) {
        sections.push(current);
      }
      current = { title: line, lines: [] };
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
      const label = line.slice(0, idx).trim();
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

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const safePost = post as NonNullable<typeof post>;
  const isDailySpotlight = safePost.slug.startsWith('daily-spotlight-');
  const spotlight = isDailySpotlight ? parseDailySpotlight(safePost.content) : null;

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
