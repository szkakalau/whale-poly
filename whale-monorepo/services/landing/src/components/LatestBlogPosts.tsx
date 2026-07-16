import Link from 'next/link';

type BlogPostCard = {
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  published_at: string;
  language: string;
  read_time: string;
};

const API_BASE = process.env.TRADE_INGEST_API_URL || 'https://sightwhale.onrender.com';

async function getLatestPosts(language: string, limit: number): Promise<BlogPostCard[]> {
  try {
    const res = await fetch(`${API_BASE}/blog/posts?language=${language}&limit=${limit}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.posts || []).slice(0, limit);
  } catch {
    return [];
  }
}

type Props = {
  language?: string;
  limit?: number;
};

export default async function LatestBlogPosts({ language = 'en', limit = 3 }: Props) {
  const posts = await getLatestPosts(language, limit);

  if (posts.length === 0) return null;

  const LABELS =
    language === 'zh'
      ? {
          eyebrow: '最新分析',
          heading: 'Polymarket 鲸鱼数据洞察',
          viewAll: '查看全部文章 →',
          blogHref: '/blog/zh',
        }
      : {
          eyebrow: 'Latest Analysis',
          heading: 'Polymarket Whale Data Insights',
          viewAll: 'View all articles →',
          blogHref: '/blog/en',
        };

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-24 sm:mb-32" aria-labelledby="blog-heading">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow mb-2">{LABELS.eyebrow}</p>
          <h2 id="blog-heading" className="text-balance">{LABELS.heading}</h2>
        </div>
        <Link
          href={LABELS.blogHref}
          className="text-sm font-medium text-accent hover:text-accent-hover transition-colors shrink-0"
        >
          {LABELS.viewAll}
        </Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.language}/${post.slug}`}
            className="group block bg-surface card-shadow rounded-xl p-5 hover:border-accent/30 transition-all duration-200"
          >
            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(post.tags || []).slice(0, 2).map((tag: string) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md bg-accent-subtle text-[11px] font-medium text-accent"
                >
                  {tag}
                </span>
              ))}
            </div>
            {/* Title */}
            <h3 className="text-sm font-semibold font-display leading-snug mb-2 group-hover:text-accent transition-colors line-clamp-2">
              {post.title}
            </h3>
            {/* Excerpt */}
            <p className="text-xs text-muted leading-relaxed line-clamp-2 mb-3">
              {post.excerpt}
            </p>
            {/* Meta */}
            <div className="flex items-center gap-2 text-[11px] text-subtle">
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
    </section>
  );
}
