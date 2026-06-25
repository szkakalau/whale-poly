import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import TagFilter from './TagFilter';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

const COLS = 'slug, title, excerpt, author, read_time, tags, published_at, language, group_slug';

type Props = {
  params: Promise<{ language: string }>;
  searchParams: Promise<{ page?: string; tag?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { language } = await params;
  const langLabel = language === 'zh' ? '博客' : 'Blog';
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
      url: `https://www.sightwhale.com/blog/${language}`,
      siteName: 'SightWhale.com',
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
      canonical: `/blog/${language}`,
      languages: {
        en: '/blog/en',
        zh: '/blog/zh',
      },
    },
  };
}

export default async function BlogListPage({ params, searchParams }: Props) {
  const { language } = await params;
  if (language !== 'en' && language !== 'zh') notFound();

  const { page: pageStr, tag } = await searchParams;
  const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);

  const offset = (page - 1) * 12;
  const tagWhere = tag ? `and '${tag}' = any(tags)` : '';
  let postsData = { posts: [] as any[], total: 0 };
  let allTags: { tag: string; count: number }[] = [];
  try {
    [postsData, allTags] = await Promise.all([
      Promise.all([
        prisma.$queryRawUnsafe<any[]>(
          `select ${COLS} from blog_posts where status = 'published' and language = '${language}' ${tagWhere} order by published_at desc limit 12 offset ${offset}`
        ),
        prisma.$queryRawUnsafe<[{ count: number }]>(
          `select count(*) as count from blog_posts where status = 'published' and language = '${language}' ${tagWhere}`
        ),
      ]).then(([posts, countResult]) => ({ posts, total: Number(countResult[0]?.count ?? 0) })),
      prisma.$queryRawUnsafe<{ tag: string; count: number }[]>(
        `select unnest(tags) as tag, count(*)::int as count from blog_posts where status = 'published' and language = '${language}' group by tag order by count desc, tag`
      ),
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

  return (
    <div className="py-12 sm:py-20">
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
              className="group block bg-surface border border-border rounded-2xl p-5 hover:border-accent/30 transition-all duration-200"
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
