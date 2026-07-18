import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getPost, getRelatedPosts, getAllPublishedSlugs } from '@/lib/blog';
import { extractHeadings, extractFaqItems, slugify } from '@/lib/markdown-utils';
import TableOfContents from '@/components/blog/TableOfContents';
import BackToTop from '@/components/blog/BackToTop';
import ReadingProgress from '@/components/blog/ReadingProgress';
import ShareButtons from '@/components/blog/ShareButtons';
import { safeJsonLd } from '@/components/BreadcrumbListScript';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const revalidate = 3600; // ISR: revalidate every hour (PF-H7)
export const dynamic = 'force-static'; // pre-render + ISR: static generation with background revalidation

type Props = {
  params: Promise<{ language: string; slug: string }>;
};

// ---------------------------------------------------------------------------
// Static params — pre-render recent posts at build time for fast crawler access
// ---------------------------------------------------------------------------

export async function generateStaticParams() {
  try {
    const posts = await getAllPublishedSlugs();
    // Pre-render the 20 most recent posts (by published_at DESC) at build time.
    // If >20 posts exist, the rest are rendered on-demand via ISR.
    return posts.slice(0, 20).map((post) => ({
      language: post.language,
      slug: post.slug,
    }));
  } catch {
    // DB unreachable at build time — all pages will be ISR'd on first request
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively extract plain text from React children (used for heading IDs).
 */
function getTextContent(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(getTextContent).join('');
  if (children && typeof children === 'object' && 'props' in children) {
    return getTextContent((children as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, language } = await params;
  const post = await getPost(slug, language);
  if (!post) return { title: 'Not Found' };

  const sibling = post.sibling ?? null;

  const alternates: { canonical: string; languages?: Record<string, string> } = {
    canonical: `/blog/${post.language}/${post.slug}`,
    ...(sibling
      ? { languages: { [post.language === 'en' ? 'zh' : 'en']: `/blog/${sibling.language}/${sibling.slug}` } }
      : {}),
  };

  return {
    title: post.title,
    description: post.excerpt,
    alternates: alternates as Metadata['alternates'],
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      url: `https://www.sightwhale.com/blog/${post.language}/${post.slug}`,
      siteName: 'SightWhale.com',
      locale: post.language === 'zh' ? 'zh_CN' : 'en_US',
      publishedTime: post.published_at,
      tags: post.tags,
      images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: ['/opengraph-image'],
    },
    robots: { index: true, follow: true },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function BlogPostPage({ params }: Props) {
  const { slug, language } = await params;

  if (language !== 'en' && language !== 'zh') notFound();

  const post = await getPost(slug, language);
  if (!post) notFound();

  const sibling = post.sibling ?? null;

  let related: Awaited<ReturnType<typeof getRelatedPosts>> = [];
  try {
    related = await getRelatedPosts(post.slug, post.language, post.tags, 3);
  } catch {
    // Prisma may be unreachable from Vercel runtime — non-critical
  }

  // Parse markdown for TOC + FAQ structured data
  const headings = extractHeadings(post.content);
  const faqItems = extractFaqItems(post.content);

  const LABELS =
    language === 'zh'
      ? {
          home: '首页',
          blog: '博客',
          backToBlog: '← 返回博客',
          readInEn: 'Read in English',
          readInZh: null as string | null,
          published: '发布于',
          related: '相关文章',
          tocHeading: '本页目录',
        }
      : {
          home: 'Home',
          blog: 'Blog',
          backToBlog: '← Back to Blog',
          readInZh: '阅读中文',
          readInEn: null as string | null,
          published: 'Published',
          related: 'Related Articles',
          tocHeading: 'On this page',
        };

  const dateStr = new Date(post.published_at).toLocaleDateString(
    language === 'zh' ? 'zh-CN' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' },
  );

  // -----------------------------------------------------------------------
  // Custom react-markdown components — adds IDs, responsive wrappers, link handling
  // -----------------------------------------------------------------------

  const markdownComponents = {
    h2: ({ children, ...props }: { children?: ReactNode }) => {
      const text = getTextContent(children);
      const id = slugify(text);
      return <h2 id={id} className="scroll-mt-20 sm:scroll-mt-24" {...props}>{children}</h2>;
    },
    h3: ({ children, ...props }: { children?: ReactNode }) => {
      const text = getTextContent(children);
      const id = slugify(text);
      return <h3 id={id} className="scroll-mt-20 sm:scroll-mt-24" {...props}>{children}</h3>;
    },
    table: ({ children, ...props }: { children?: ReactNode }) => (
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="min-w-[600px] sm:min-w-0" {...props}>
          {children}
        </table>
      </div>
    ),
    a: ({ href, children, ...props }: { href?: string; children?: ReactNode }) => {
      if (!href) return <a {...props}>{children}</a>;
      // Block dangerous URL protocols that could execute JavaScript
      const sanitized = href.trim().toLowerCase();
      if (sanitized.startsWith('javascript:') || sanitized.startsWith('data:text/html')) {
        return <span className="text-accent underline underline-offset-2" {...props}>{children}</span>;
      }
      const isInternal = href.startsWith('/') || href.includes('sightwhale.com');
      const className = 'text-accent hover:text-accent-hover underline underline-offset-2 transition-colors';
      if (isInternal) {
        // Strip origin for internal links so Next.js Link handles them
        const path = href.replace(/^https?:\/\/[^/]+/, '');
        return (
          <Link href={path} className={className} {...props}>
            {children}
          </Link>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className} {...props}>
          {children}
        </a>
      );
    },
    img: ({ src, alt, ...props }: { src?: string | Blob; alt?: string }) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={typeof src === 'string' ? src : undefined}
        alt={alt || post.title}
        loading="lazy"
        sizes="(max-width: 768px) 100vw, 720px"
        className="rounded-lg"
        {...props}
      />
    ),
  };

  return (
    <div className="relative">
      {/* Reading progress bar */}
      <ReadingProgress />

      <div className="flex gap-8 lg:gap-12">
        {/* ── Main content column ── */}
        <article className="flex-1 min-w-0 py-12 sm:py-20">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-subtle mb-8">
            <Link href="/" className="hover:text-foreground transition-colors">
              {LABELS.home}
            </Link>
            <span>/</span>
            <Link href={`/blog/${language}`} className="hover:text-foreground transition-colors">
              {LABELS.blog}
            </Link>
            <span>/</span>
            <span className="text-muted truncate max-w-[200px] sm:max-w-xs">{post.title}</span>
          </nav>

          {/* Back link */}
          <Link
            href={`/blog/${language}`}
            className="inline-flex items-center text-sm font-medium text-accent hover:text-accent-hover transition-colors mb-8"
          >
            {LABELS.backToBlog}
          </Link>

          {/* Header */}
          <header className="mb-10">
            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {(post.tags || []).map((t) => (
                <Link
                  key={t}
                  href={`/blog/${language}?tag=${encodeURIComponent(t)}`}
                  className="px-2.5 py-1 rounded-md bg-accent-subtle text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
                >
                  {t}
                </Link>
              ))}
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display tracking-tight leading-tight mb-4">
              {post.title}
            </h1>

            {/* Meta */}
            <div className="flex items-center gap-3 text-sm text-subtle">
              <span>{post.author}</span>
              <span>·</span>
              <time dateTime={post.published_at}>{dateStr}</time>
              <span>·</span>
              <span>{post.read_time}</span>
              {sibling && (
                <>
                  <span>·</span>
                  <Link
                    href={`/blog/${sibling.language}/${sibling.slug}`}
                    className="font-medium text-accent hover:text-accent-hover transition-colors"
                    hrefLang={sibling.language}
                  >
                    {sibling.language === 'en' ? LABELS.readInEn : LABELS.readInZh}
                  </Link>
                </>
              )}
            </div>

            {/* Share buttons */}
            <div className="mt-4">
              <ShareButtons title={post.title} slug={post.slug} language={post.language} />
            </div>
          </header>

          {/* Mobile TOC (hidden on lg+) */}
          <div className="lg:hidden mb-8">
            <TableOfContents headings={headings} labels={LABELS} />
          </div>

          {/* ── Structured data — Article ── */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: safeJsonLd({
                '@context': 'https://schema.org',
                '@type': 'Article',
                headline: post.title,
                description: post.excerpt,
                url: `https://www.sightwhale.com/blog/${post.language}/${post.slug}`,
                mainEntityOfPage: {
                  '@type': 'WebPage',
                  '@id': `https://www.sightwhale.com/blog/${post.language}/${post.slug}`,
                },
                image: 'https://www.sightwhale.com/opengraph-image',
                datePublished: post.published_at,
                dateModified: post.updated_at,
                author: { '@type': 'Person', name: post.author },
                publisher: {
                  '@type': 'Organization',
                  name: 'SightWhale',
                  url: 'https://www.sightwhale.com',
                },
                inLanguage: post.language,
                about: (post.tags || []).map((t) => ({ '@type': 'Thing', name: t })),
              }),
            }}
          />
          {/* ── Structured data — BreadcrumbList ── */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: safeJsonLd({
                '@context': 'https://schema.org',
                '@type': 'BreadcrumbList',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: LABELS.home, item: 'https://www.sightwhale.com/' },
                  { '@type': 'ListItem', position: 2, name: LABELS.blog, item: `https://www.sightwhale.com/blog/${language}` },
                  { '@type': 'ListItem', position: 3, name: post.title },
                ],
              }),
            }}
          />
          {/* ── Structured data — FAQPage (GEO: Google rich results + AI Overview extraction) ── */}
          {faqItems.length > 0 && (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  '@context': 'https://schema.org',
                  '@type': 'FAQPage',
                  mainEntity: faqItems.map(({ question, answer }) => ({
                    '@type': 'Question',
                    name: question,
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: answer,
                    },
                  })),
                }),
              }}
            />
          )}

          {/* Content */}
          <div className="prose prose-stone lg:prose-lg max-w-none mx-auto">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {post.content}
            </ReactMarkdown>
          </div>

          {/* Footer meta */}
          <div className="mt-16 pt-8 border-t border-border">
            <p className="text-sm text-subtle">
              {LABELS.published}: {dateStr} · {post.read_time} · {post.author}
            </p>
          </div>

          {/* Related */}
          {related.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-semibold font-display mb-6">{LABELS.related}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/blog/${r.language}/${r.slug}`}
                    className="group block bg-surface card-shadow rounded-xl p-4 hover:border-accent/30 transition-all duration-200"
                  >
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(r.tags || []).slice(0, 2).map((t: string) => (
                        <span key={t} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-subtle text-accent">
                          {t}
                        </span>
                      ))}
                    </div>
                    <h3 className="text-sm font-semibold font-display leading-snug group-hover:text-accent transition-colors line-clamp-2">
                      {r.title}
                    </h3>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>

        {/* ── Desktop TOC sidebar (hidden below lg) ── */}
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <div className="sticky top-24">
            <TableOfContents headings={headings} labels={LABELS} />
          </div>
        </aside>
      </div>

      {/* Mobile back-to-top button */}
      <BackToTop />
    </div>
  );
}
