import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  read_time: string;
  cover_image: string | null;
  tags: string[];
  published_at: string;
  created_at: string;
  updated_at: string;
  language: string;
  group_slug: string | null;
  status: string;
  sibling?: { slug: string; language: string } | null;
};

export type BlogPostCard = Pick<
  BlogPost,
  'slug' | 'title' | 'excerpt' | 'author' | 'read_time' | 'tags' | 'published_at' | 'language' | 'group_slug'
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseTags(tags: unknown): string[] {
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

function mapPostCard(row: any): BlogPostCard {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    author: row.author,
    read_time: row.read_time,
    tags: parseTags(row.tags),
    published_at: row.published_at instanceof Date ? row.published_at.toISOString() : String(row.published_at),
    language: row.language,
    group_slug: row.group_slug,
  };
}

// ---------------------------------------------------------------------------
// Queries — use $queryRawUnsafe (Prisma.sql returns 0 rows on Vercel runtime)
// ---------------------------------------------------------------------------

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
  const tagWhere = tag ? `and '${tag.replace(/'/g, "''")}' = any(tags)` : '';

  const [posts, countResult] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(
      `select slug, title, excerpt, author, read_time, tags, published_at, language, group_slug
       from blog_posts
       where status = 'published' and language = '${language.replace(/'/g, "''")}'
       ${tagWhere}
       order by published_at desc
       limit ${limit} offset ${offset}`,
    ),
    prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `select count(*) as count
       from blog_posts
       where status = 'published' and language = '${language.replace(/'/g, "''")}'
       ${tagWhere}`,
    ),
  ]);

  return {
    posts: posts.map(mapPostCard),
    total: Number(countResult[0]?.count ?? 0),
  };
}

/**
 * Get a single post by slug and language (with full content).
 */
export async function getPost(slug: string, language: string): Promise<BlogPost | null> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `select * from blog_posts
     where slug = '${slug.replace(/'/g, "''")}' and language = '${language.replace(/'/g, "''")}' and status = 'published'
     limit 1`,
  );
  if (!rows.length) return null;

  const row = rows[0];
  const post: BlogPost = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    author: row.author,
    read_time: row.read_time,
    cover_image: row.cover_image,
    tags: parseTags(row.tags),
    published_at: row.published_at instanceof Date ? row.published_at.toISOString() : String(row.published_at),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    language: row.language,
    group_slug: row.group_slug,
    status: row.status,
  };

  // Fetch sibling (same group_slug, different language) — inline
  if (post.group_slug) {
    const sibRows = await prisma.$queryRawUnsafe<{ slug: string; language: string }[]>(
      `select slug, language from blog_posts
       where group_slug = '${post.group_slug.replace(/'/g, "''")}' and language != '${language.replace(/'/g, "''")}' and status = 'published'
       limit 1`,
    );
    if (sibRows.length > 0) {
      post.sibling = { slug: sibRows[0].slug, language: sibRows[0].language };
    }
  }

  return post;
}

/**
 * Get the sibling article (kept for existing callers).
 */
export async function getSiblingPost(
  groupSlug: string | null,
  language: string,
): Promise<{ slug: string; language: string } | null> {
  if (!groupSlug) return null;
  const rows = await prisma.$queryRawUnsafe<{ slug: string; language: string }[]>(
    `select slug, language from blog_posts
     where group_slug = '${groupSlug.replace(/'/g, "''")}' and language != '${language.replace(/'/g, "''")}' and status = 'published'
     limit 1`,
  );
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
  const tagList = tags.map((t) => `'${t.replace(/'/g, "''")}'`).join(',');
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `select slug, title, excerpt, author, read_time, tags, published_at, language, group_slug
     from blog_posts
     where status = 'published'
       and language = '${language.replace(/'/g, "''")}'
       and slug != '${slug.replace(/'/g, "''")}'
       and tags && array[${tagList}]::text[]
     order by published_at desc
     limit ${limit}`,
  );
  return rows.map(mapPostCard);
}

/**
 * Get all published slugs for sitemap / RSS generation.
 */
export async function getAllPublishedSlugs(): Promise<{ slug: string; language: string; updated_at: string }[]> {
  const rows = await prisma.$queryRawUnsafe<{ slug: string; language: string; updated_at: string }[]>(
    `select slug, language, updated_at::text as updated_at
     from blog_posts
     where status = 'published'
     order by published_at desc`,
  );
  return rows;
}

/**
 * Get latest posts for RSS feed.
 */
export async function getLatestPosts(limit: number = 20, language?: string): Promise<BlogPostCard[]> {
  const langWhere = language ? `and language = '${language.replace(/'/g, "''")}'` : '';
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `select slug, title, excerpt, author, read_time, tags, published_at, language, group_slug
     from blog_posts
     where status = 'published' ${langWhere}
     order by published_at desc
     limit ${limit}`,
  );
  return rows.map(mapPostCard);
}

export type TagWithCount = { tag: string; count: number };

/**
 * Get all tags with article counts for a language.
 */
export async function getAllTags(language: string): Promise<TagWithCount[]> {
  const rows = await prisma.$queryRawUnsafe<TagWithCount[]>(
    `select unnest(tags) as tag, count(*)::int as count
     from blog_posts
     where status = 'published' and language = '${language.replace(/'/g, "''")}'
     group by tag
     order by count desc, tag`,
  );
  return rows;
}
