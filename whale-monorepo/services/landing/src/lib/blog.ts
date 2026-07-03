import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const API_BASE = process.env.TRADE_INGEST_API_URL || 'https://trade-ingest-api.onrender.com';

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
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`Blog API ${res.status} for ${path}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Queries — parameterized via Prisma.sql (no string interpolation)
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
}

/**
 * Get all published slugs for sitemap / RSS generation.
 */
export async function getAllPublishedSlugs(): Promise<{ slug: string; language: string; updated_at: string }[]> {
  const rows = await prisma.$queryRaw<{ slug: string; language: string; updated_at: string }[]>(
    Prisma.sql`SELECT slug, language, updated_at::text AS updated_at
    FROM blog_posts
    WHERE status = 'published'
    ORDER BY published_at DESC`,
  );
  return rows;
}

/**
 * Get latest posts for RSS feed.
 */
export async function getLatestPosts(limit: number = 20, language?: string): Promise<BlogPostCard[]> {
  const rows = await prisma.$queryRaw<any[]>(
    language
      ? Prisma.sql`SELECT slug, title, excerpt, author, read_time, tags, published_at, language, group_slug
        FROM blog_posts
        WHERE status = 'published' AND language = ${language}
        ORDER BY published_at DESC
        LIMIT ${limit}`
      : Prisma.sql`SELECT slug, title, excerpt, author, read_time, tags, published_at, language, group_slug
        FROM blog_posts
        WHERE status = 'published'
        ORDER BY published_at DESC
        LIMIT ${limit}`,
  );
  return rows.map(mapPostCard);
}
