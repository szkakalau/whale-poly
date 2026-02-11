import { NextResponse } from 'next/server';
import { getDbPostBySlug, getFilePostBySlug } from '@/lib/blog';

interface Context {
  params: Promise<{ slug: string }>;
}

export async function GET(_: Request, context: Context) {
  const { slug } = await context.params;
  const [dbPost, filePost] = await Promise.all([getDbPostBySlug(slug), Promise.resolve(getFilePostBySlug(slug))]);
  return NextResponse.json({
    slug,
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
