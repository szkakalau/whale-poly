import { NextResponse } from 'next/server';
import { getDailySpotlightPostsMerged } from '@/lib/blog';

/**
 * Fresh daily spotlight list for the blog index client (polls every few minutes).
 * Same merge rules as getAllPosts (DB `blog_posts` + optional markdown files).
 */
export async function GET() {
  try {
    const posts = await getDailySpotlightPostsMerged();
    const slim = posts.map(({ slug, title, date, excerpt, author, readTime, tags }) => ({
      slug,
      title,
      date,
      excerpt,
      author,
      readTime,
      tags,
      content: '',
    }));
    const res = NextResponse.json({
      posts: slim,
      updatedAt: new Date().toISOString(),
    });
    res.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return res;
  } catch {
    return NextResponse.json(
      { posts: [], updatedAt: new Date().toISOString(), error: 'daily_spotlight_fetch_failed' },
      { status: 200 },
    );
  }
}
