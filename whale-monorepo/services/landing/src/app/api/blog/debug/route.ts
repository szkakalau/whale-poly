import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

function getPostsDirectory() {
  return path.join(process.cwd(), 'src/content/posts');
}

async function resolveBlogPostsSchema(): Promise<string | null> {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  if (!hasDatabaseUrl) {
    return null;
  }
  const rows = await prisma.$queryRaw<{ table_schema: string }[]>(
    Prisma.sql`select table_schema from information_schema.tables where table_name = 'blog_posts'`,
  );
  const schema = rows?.[0]?.table_schema ?? null;
  if (!schema) {
    return null;
  }
  if (!/^[A-Za-z0-9_]+$/.test(schema)) {
    return null;
  }
  return schema;
}

export async function GET() {
  const postsDir = getPostsDirectory();
  const fileExists = fs.existsSync(postsDir);
  const mdFiles = fileExists ? fs.readdirSync(postsDir).filter((f) => f.endsWith('.md')) : [];
  const fileSlugs = mdFiles.map((f) => f.replace(/\.md$/, ''));

  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  let dbCount: number | null = null;
  let dbSlugs: string[] = [];
  let dbSchema: string | null = null;

  if (hasDatabaseUrl) {
    try {
      dbSchema = await resolveBlogPostsSchema();
      if (dbSchema) {
        const rows = await prisma.$queryRaw<{ slug: string }[]>(
          Prisma.sql`select slug from ${Prisma.raw(`${dbSchema}.blog_posts`)} order by published_at desc limit 50`,
        );
        dbSlugs = rows.map((r) => r.slug);
        const cntRows = await prisma.$queryRaw<{ count: bigint }[]>(
          Prisma.sql`select count(*)::bigint as count from ${Prisma.raw(`${dbSchema}.blog_posts`)}`,
        );
        dbCount = Number(cntRows?.[0]?.count ?? 0);
      }
    } catch {
      dbCount = null;
      dbSlugs = [];
    }
  }

  return NextResponse.json({
    cwd: process.cwd(),
    postsDir,
    fileExists,
    fileCount: mdFiles.length,
    fileSlugs: fileSlugs.slice(0, 50),
    hasDatabaseUrl,
    dbSchema,
    dbCount,
    dbSlugs,
  });
}
