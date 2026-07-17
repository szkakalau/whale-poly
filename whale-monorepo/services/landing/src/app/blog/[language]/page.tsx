import Link from 'next/link';
import { notFound } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import TagFilter from './TagFilter';
import type { Metadata } from 'next';

export const revalidate = 3600; // ISR at runtime, no build-time DB access needed (PF-H7)

const API_BASE = process.env.TRADE_INGEST_API_URL || 'https://sightwhale.onrender.com';

const getCachedBlogData = unstable_cache(
  async (language: string, page: number, tag?: string) => {
    const params = new URLSearchParams({ language, page: String(page), limit: '12' });
    if (tag) params.set('tag', tag);
    const res = await fetch(`${API_BASE}/blog/posts?${params}`);
    if (!res.ok) throw new Error(`Blog API ${res.status}`);
    return res.json() as Promise<{ posts: any[]; total: number }>;
  },
  ['blog-list-data-v2'],
  { revalidate: 120 },
);

const getCachedBlogTags = unstable_cache(
  async (language: string) => {
    const res = await fetch(`${API_BASE}/blog/tags?language=${language}`);
    if (!res.ok) throw new Error(`Blog tags API ${res.status}`);
    const data = await res.json() as { tags: { tag: string; count: number }[] };
    return data.tags;
  },
  ['blog-list-tags-v2'],
  { revalidate: 300 },
);

type Props = {
  params: Promise<{ language: string }>;
  searchParams: Promise<{ page?: string; tag?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { language } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
  return {
    title:
      language === 'zh'
        ? '博客 — Polymarket 预测市场洞察与鲸鱼交易策略'
        : 'Blog — Polymarket Insights & Whale Trading Strategies',
    description:
      language === 'zh'
        ? 'SightWhale 博客 — 深度解析 Polymarket 预测市场、鲸鱼交易策略与数据洞察。每日更新。'
        : 'SightWhale Blog — deep dives into Polymarket prediction markets, whale trading strategies, and data insights. Updated daily.',
    openGraph: {
      title:
        language === 'zh'
          ? 'SightWhale 博客 — Polymarket 预测市场与鲸鱼策略'
          : 'SightWhale Blog — Polymarket Insights & Whale Trading Strategies',
      description:
        language === 'zh'
          ? '深度解析 Polymarket 预测市场、鲸鱼交易策略与数据洞察。每日更新。'
          : 'Deep dives into Polymarket prediction markets, whale trading strategies, and data insights. Updated daily.',
      type: 'website',
      url: `https://www.sightwhale.com/blog/${language}${page > 1 ? `?page=${page}` : ''}`,
      siteName: 'SightWhale.com',
      locale: language === 'zh' ? 'zh_CN' : 'en_US',
      images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title:
        language === 'zh'
          ? 'SightWhale 博客 — Polymarket 预测市场与鲸鱼策略'
          : 'SightWhale Blog — Polymarket Insights',
      description:
        language === 'zh'
          ? '深度解析 Polymarket 预测市场、鲸鱼交易策略与数据洞察。每日更新。'
          : 'Deep dives into Polymarket prediction markets, whale trading strategies, and data insights.',
      images: ['/opengraph-image'],
    },
    alternates: {
      canonical: page > 1 ? `/blog/${language}?page=${page}` : `/blog/${language}`,
      languages: {
        en: '/blog/en',
        zh: '/blog/zh',
        'x-default': '/blog/en',
      },
    },
  };
}

export default async function BlogListPage({ params, searchParams }: Props) {
  const { language } = await params;
  if (language !== 'en' && language !== 'zh') notFound();

  const { page: pageStr, tag } = await searchParams;
  const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);

  let postsData = { posts: [] as any[], total: 0 };
  let allTags: { tag: string; count: number }[] = [];
  try {
    [postsData, allTags] = await Promise.all([
      getCachedBlogData(language, page, tag),
      getCachedBlogTags(language),
    ]);
  } catch (e) {
    console.error('BlogListPage error:', e);
  }
  const { posts, total } = postsData;
  const totalPages = Math.max(1, Math.ceil(total / 12));

  const LABELS =
    language === 'zh'
      ? {
          hero: 'SightWhale 博客',
          subtitle: '深度解析 Polymarket 预测市场、鲸鱼策略与数据洞察。每日更新。',
          all: '全部',
          prev: '上一页',
          next: '下一页',
          langSwitch: 'Read in English',
          langHref: '/blog/en',
          noPosts: '暂无文章，即将上线。',
        }
      : {
          hero: 'SightWhale Blog',
          subtitle: 'Deep dives into Polymarket prediction markets, whale strategies, and data insights. Updated daily.',
          all: 'All',
          prev: 'Previous',
          next: 'Next',
          langSwitch: '阅读中文',
          langHref: '/blog/zh',
          noPosts: 'No articles yet. Check back soon.',
        };

  const listJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: posts.length,
    itemListElement: posts.map((post, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Article',
        url: `https://www.sightwhale.com/blog/${post.language}/${post.slug}`,
        name: post.title,
        headline: post.title,
        description: post.excerpt,
        datePublished: post.published_at,
        dateModified: post.updated_at || post.published_at,
        image: 'https://www.sightwhale.com/opengraph-image',
        author: {
          '@type': 'Person',
          name: post.author || 'SightWhale Team',
          url: 'https://www.sightwhale.com',
        },
        publisher: {
          '@type': 'Organization',
          name: 'SightWhale',
          url: 'https://www.sightwhale.com',
        },
      },
    })),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://www.sightwhale.com/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: language === 'zh' ? '博客' : 'Blog',
        item: `https://www.sightwhale.com/blog/${language}`,
      },
    ],
  };

  return (
    <div className="py-12 sm:py-20">
      {/* JSON-LD structured data — BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* JSON-LD structured data — ItemList (only when posts exist) */}
      {posts.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(listJsonLd) }}
        />
      )}
      {/* Hero */}
      <div className="mb-12 sm:mb-16">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-3">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight font-display">
            {LABELS.hero}
          </h1>
          <Link
            href={LABELS.langHref}
            className="text-sm font-medium text-accent hover:text-accent-hover transition-colors"
          >
            {LABELS.langSwitch}
          </Link>
        </div>
        <p className="text-lg text-muted max-w-2xl">{LABELS.subtitle}</p>
      </div>

      {/* Tag filter */}
      <TagFilter
        tags={allTags}
        language={language}
        activeTag={tag}
        allLabel={LABELS.all}
      />

      {/* Posts grid */}
      {posts.length === 0 ? (
        <div className="py-20 text-center text-muted">{LABELS.noPosts}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.language}/${post.slug}`}
              className="group block bg-surface card-shadow rounded-2xl p-5 hover:border-accent/30 transition-all duration-200"
            >
              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(post.tags || []).slice(0, 3).map((t: string) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-md bg-accent-subtle text-[11px] font-medium text-accent"
                  >
                    {t}
                  </span>
                ))}
              </div>
              {/* Title */}
              <h2 className="text-lg font-semibold font-display leading-snug mb-2 group-hover:text-accent transition-colors">
                {post.title}
              </h2>
              {/* Excerpt */}
              <p className="text-sm text-muted leading-relaxed line-clamp-2 mb-3">
                {post.excerpt}
              </p>
              {/* Meta */}
              <div className="flex items-center gap-3 text-xs text-subtle">
                <time dateTime={post.published_at}>
                  {new Date(post.published_at).toLocaleDateString(
                    language === 'zh' ? 'zh-CN' : 'en-US',
                    { year: 'numeric', month: 'short', day: 'numeric' },
                  )}
                </time>
                <span>·</span>
                <span>{post.read_time}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-12">
          {page > 1 && (
            <Link
              href={`/blog/${language}?page=${page - 1}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-border bg-surface hover:bg-surface-hover transition-colors"
            >
              ← {LABELS.prev}
            </Link>
          )}
          <span className="text-sm text-muted">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/blog/${language}?page=${page + 1}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-border bg-surface hover:bg-surface-hover transition-colors"
            >
              {LABELS.next} →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
