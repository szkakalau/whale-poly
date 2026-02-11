import { NextResponse } from 'next/server';
import { getDbPostBySlug, getFilePostBySlug, hasBlogPostsTable } from '@/lib/blog';
import { prisma } from '@/lib/prisma';

interface Context {
  params: Promise<{ slug: string }>;
}

export async function GET(_: Request, context: Context) {
  const { slug } = await context.params;
  const rawUrl = process.env.DATABASE_URL ?? '';
  let dbInfo: { host: string; database: string; sslmode: string | null } | null = null;
  try {
    const parsed = new URL(rawUrl);
    dbInfo = {
      host: parsed.host,
      database: parsed.pathname.replace(/^\//, ''),
      sslmode: parsed.searchParams.get('sslmode'),
    };
  } catch {
    dbInfo = null;
  }

  const [dbPost, filePost, hasTable] = await Promise.all([
    getDbPostBySlug(slug),
    Promise.resolve(getFilePostBySlug(slug)),
    hasBlogPostsTable(),
  ]);

  let dbCount: number | null = null;
  if (hasTable) {
    try {
      const rows = await prisma.$queryRaw<{ count: number }[]>`select count(*)::int as count from blog_posts`;
      dbCount = rows?.[0]?.count ?? null;
    } catch {
      dbCount = null;
    }
  }

  return NextResponse.json({
    slug,
    dbInfo,
    hasTable,
    dbCount,
    db: dbPost
      ? {
          slug: dbPost.slug,
          title: dbPost.title,
          date: dbPost.date,
        }
      : null,
    file: filePost
      ? {
          slug: filePost.slug,
          title: filePost.title,
          date: filePost.date,
        }
      : null,
  });
}
