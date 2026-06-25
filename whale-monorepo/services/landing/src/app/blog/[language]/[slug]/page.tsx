import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getPost, getRelatedPosts } from '@/lib/blog';
import type { Metadata } from 'next';

type Props = {
  params: Promise<{ language: string; slug: string }>;
};

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
  const related = await getRelatedPosts(post.slug, post.language, post.tags, 3);

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
        }
      : {
          home: 'Home',
          blog: 'Blog',
          backToBlog: '← Back to Blog',
          readInZh: '阅读中文',
          readInEn: null as string | null,
          published: 'Published',
          related: 'Related Articles',
        };

  const dateStr = new Date(post.published_at).toLocaleDateString(
    language === 'zh' ? 'zh-CN' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' },
  );

  return (
    <article className="py-12 sm:py-20">
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
          {post.tags.map((t) => (
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
      </header>

      {/* Structured data — Article */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: post.title,
            description: post.excerpt,
            datePublished: post.published_at,
            dateModified: post.updated_at,
            author: { '@type': 'Organization', name: post.author },
            inLanguage: post.language,
            about: post.tags.map((t) => ({ '@type': 'Thing', name: t })),
          }),
        }}
      />
      {/* Structured data — BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
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

      {/* Content */}
      <div className="prose prose-stone lg:prose-lg max-w-none mx-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
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
                className="group block bg-surface border border-border rounded-xl p-4 hover:border-accent/30 transition-all duration-200"
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
  );
}
