import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const API_BASE = process.env.TRADE_INGEST_API_URL || 'https://sightwhale.onrender.com';

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

export type TagWithCount = { tag: string; count: number };

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

async function apiFetch(path: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout (Render cold starts can be slow)
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Blog API ${res.status} for ${path}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Queries — use HTTP API for Postgres-backed data (Prisma raw SQL unreliable from Vercel)
// ---------------------------------------------------------------------------

/**
 * Get a single post by slug and language (via API — includes sibling).
 */
export async function getPost(slug: string, language: string): Promise<BlogPost | null> {
  try {
    const data = await apiFetch(`/blog/post?slug=${encodeURIComponent(slug)}&language=${language}`);
    return data as BlogPost | null;
  } catch {
    return null;
  }
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
  try {
    const rows = await prisma.$queryRaw<any[]>(
      Prisma.sql`SELECT slug, title, excerpt, author, read_time, tags, published_at, language, group_slug
      FROM blog_posts
      WHERE status = 'published'
        AND language = ${language}
        AND slug != ${slug}
        AND tags && array[${Prisma.join(tags)}]::text[]
      ORDER BY published_at DESC
      LIMIT ${limit}`,
    );
    return rows.map(mapPostCard);
  } catch {
    return []; // Prisma may be unreachable from Vercel — non-critical
  }
}

/**
 * Get all published slugs for sitemap generation.
 * Uses the trade-ingest HTTP API (Prisma raw SQL is unreliable from Vercel).
 */
export async function getAllPublishedSlugs(): Promise<{ slug: string; language: string; updated_at: string }[]> {
  const results: { slug: string; language: string; updated_at: string }[] = [];
  for (const lang of ['en', 'zh']) {
    try {
      const data = await apiFetch(`/blog/posts?language=${lang}&limit=500`);
      for (const post of data.posts || []) {
        results.push({
          slug: post.slug,
          language: post.language,
          updated_at: post.published_at, // API returns published_at; used as sitemap lastModified
        });
      }
    } catch (err) {
      console.error(`[blog] Failed to fetch slugs for language=${lang}:`, err);
    }
  }
  return results;
}

/**
 * Get latest posts for RSS feed.
 * Uses the trade-ingest HTTP API (Prisma raw SQL is unreliable from Vercel).
 */
export async function getLatestPosts(limit: number = 20, language?: string): Promise<BlogPostCard[]> {
  if (language) {
    try {
      const data = await apiFetch(`/blog/posts?language=${encodeURIComponent(language)}&limit=${limit}`);
      return (data.posts || []).map(mapPostCard);
    } catch {
      return [];
    }
  }
  // Both languages
  try {
    const [enData, zhData] = await Promise.all([
      apiFetch(`/blog/posts?language=en&limit=${limit}`),
      apiFetch(`/blog/posts?language=zh&limit=${Math.ceil(limit / 3)}`),
    ]);
    return [...(enData.posts || []), ...(zhData.posts || [])]
      .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
      .slice(0, limit)
      .map(mapPostCard);
  } catch {
    return [];
  }
}
