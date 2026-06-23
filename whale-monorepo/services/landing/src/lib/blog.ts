import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;          // markdown
  author: string;
  read_time: string;
  cover_image: string | null;
  tags: string[];
  published_at: string;
  created_at: string;
  updated_at: string;
  language: string;          // 'en' | 'zh'
  group_slug: string | null;
  status: string;
};

export type BlogPostCard = Pick<
  BlogPost,
  'slug' | 'title' | 'excerpt' | 'author' | 'read_time' | 'tags' | 'published_at' | 'language' | 'group_slug'
>;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const POST_CARD_SELECT = Prisma.sql`
  slug, title, excerpt, author, read_time, tags, published_at, language, group_slug
`;

/**
 * Get paginated published posts for a given language.
 */
export async function getPosts(
  language: string,
  page: number = 1,
  limit: number = 12,
  tag?: string,
): Promise<{ posts: BlogPostCard[]; total: number }> {
  const offset = (page - 1) * limit;

  const tagFilter = tag
    ? Prisma.sql`and ${tag} = any(tags)`
    : Prisma.empty;

  const [posts, countResult] = await Promise.all([
    prisma.$queryRaw<BlogPostCard[]>(Prisma.sql`
      select ${POST_CARD_SELECT}
      from blog_posts
      where status = 'published' and language = ${language}
      ${tagFilter}
      order by published_at desc
      limit ${limit} offset ${offset}
    `),
    prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
      select count(*) as count
      from blog_posts
      where status = 'published' and language = ${language}
      ${tagFilter}
    `),
  ]);

  return {
    posts: posts.map((p) => ({ ...p, tags: _parseTags(p.tags) })),
    total: Number(countResult[0]?.count ?? 0),
  };
}

/**
 * Get a single post by slug and language.
 */
export async function getPost(slug: string, language: string): Promise<BlogPost | null> {
  const rows = await prisma.$queryRaw<BlogPost[]>(Prisma.sql`
    select * from blog_posts
    where slug = ${slug} and language = ${language} and status = 'published'
    limit 1
  `);
  if (!rows.length) return null;
  const post = rows[0];
  post.tags = _parseTags(post.tags);
  return post;
}

/**
 * Get the sibling article (same group_slug, different language).
 */
export async function getSiblingPost(groupSlug: string | null, language: string): Promise<{ slug: string; language: string } | null> {
  if (!groupSlug) return null;
  const rows = await prisma.$queryRaw<{ slug: string; language: string }[]>(Prisma.sql`
    select slug, language from blog_posts
    where group_slug = ${groupSlug} and language != ${language} and status = 'published'
    limit 1
  `);
  return rows[0] ?? null;
}

/**
 * Get related posts (same language, shares at least one tag).
 */
export async function getRelatedPosts(
  slug: string,
  language: string,
  tags: string[],
  limit: number = 3,
): Promise<BlogPostCard[]> {
  if (!tags.length) return [];
  const rows = await prisma.$queryRaw<BlogPostCard[]>(Prisma.sql`
    select ${POST_CARD_SELECT}
    from blog_posts
    where status = 'published'
      and language = ${language}
      and slug != ${slug}
      and tags && ${tags}::text[]
    order by published_at desc
    limit ${limit}
  `);
  return rows.map((p) => ({ ...p, tags: _parseTags(p.tags) }));
}

/**
 * Get all published slugs for sitemap generation.
 */
export async function getAllPublishedSlugs(): Promise<{ slug: string; language: string; updated_at: string }[]> {
  const rows = await prisma.$queryRaw<{ slug: string; language: string; updated_at: string }[]>(Prisma.sql`
    select slug, language, updated_at::text as updated_at
    from blog_posts
    where status = 'published'
    order by published_at desc
  `);
  return rows;
}

/**
 * Get latest posts for RSS feed, optionally filtered by language.
 */
export async function getLatestPosts(limit: number = 20, language?: string): Promise<BlogPostCard[]> {
  const langFilter = language
    ? Prisma.sql`and language = ${language}`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<BlogPostCard[]>(Prisma.sql`
    select ${POST_CARD_SELECT}
    from blog_posts
    where status = 'published' ${langFilter}
    order by published_at desc
    limit ${limit}
  `);
  return rows.map((p) => ({ ...p, tags: _parseTags(p.tags) }));
}

export type TagWithCount = { tag: string; count: number };

/**
 * Get all tags with article counts for a language, sorted by count descending.
 */
export async function getAllTags(language: string): Promise<TagWithCount[]> {
  const rows = await prisma.$queryRaw<TagWithCount[]>(Prisma.sql`
    select unnest(tags) as tag, count(*)::int as count
    from blog_posts
    where status = 'published' and language = ${language}
    group by tag
    order by count desc, tag
  `);
  return rows;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _parseTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.map(String);
  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}
