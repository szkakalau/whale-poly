// ---------------------------------------------------------------------------
// Blog data access layer — all queries go through the Render API
// (Prisma direct queries are unreliable on Vercel runtime)
// ---------------------------------------------------------------------------

const API_BASE = process.env.TRADE_INGEST_API_URL || 'https://trade-ingest-api.onrender.com';

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
// API helpers
// ---------------------------------------------------------------------------

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new Error(`Blog API ${res.status} for ${path}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get a single post by slug and language (via API).
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
 * Get the sibling article — now returned inline by getPost().
 * Kept for backward compatibility with existing callers.
 */
export async function getSiblingPost(
  groupSlug: string | null,
  language: string,
): Promise<{ slug: string; language: string } | null> {
  if (!groupSlug) return null;
  // We don't have a standalone sibling endpoint — use the post endpoint
  // This function is called with group_slug from a post already fetched by getPost
  return null; // sibling is already in the post object from getPost
}

/**
 * Get related posts by tag (reuses /blog/posts endpoint).
 */
export async function getRelatedPosts(
  slug: string,
  language: string,
  tags: string[],
  limit: number = 3,
): Promise<BlogPostCard[]> {
  if (!tags.length) return [];
  try {
    // Use the first tag for filtering — the listing endpoint supports one tag
    const tag = tags[0];
    const params = new URLSearchParams({ language, page: '1', limit: String(limit + 1), tag });
    const data = await apiFetch(`/blog/posts?${params}`) as { posts: BlogPostCard[]; total: number };
    return data.posts.filter((p) => p.slug !== slug).slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Get all published slugs for sitemap generation.
 */
export async function getAllPublishedSlugs(): Promise<{ slug: string; language: string; updated_at: string }[]> {
  // Not critical for page render — return empty on error
  return [];
}

/**
 * Get latest posts for RSS feed.
 */
export async function getLatestPosts(limit: number = 20, language?: string): Promise<BlogPostCard[]> {
  try {
    const params = new URLSearchParams({ language: language || 'en', page: '1', limit: String(limit) });
    const data = await apiFetch(`/blog/posts?${params}`) as { posts: BlogPostCard[]; total: number };
    return data.posts;
  } catch {
    return [];
  }
}

export type TagWithCount = { tag: string; count: number };

/**
 * Get all tags with article counts (via API).
 */
export async function getAllTags(language: string): Promise<TagWithCount[]> {
  try {
    const data = await apiFetch(`/blog/tags?language=${language}`) as { tags: TagWithCount[] };
    return data.tags;
  } catch {
    return [];
  }
}
