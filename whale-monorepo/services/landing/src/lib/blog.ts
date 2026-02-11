import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

const postsDirectory = path.join(process.cwd(), 'src/content/posts');

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  content: string;
  author: string;
  readTime: string;
  coverImage?: string;
  tags?: string[];
}

function normalizePostDate(value: string): string {
  const now = new Date();
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return now.toISOString();
  }
  if (parsed.getTime() > now.getTime()) {
    return now.toISOString();
  }
  return parsed.toISOString();
}

function normalizePost(post: BlogPost): BlogPost {
  return {
    ...post,
    date: normalizePostDate(post.date),
  };
}

export function getAllFilePosts(): BlogPost[] {
  if (!fs.existsSync(postsDirectory)) {
    return [];
  }

  const fileNames = fs.readdirSync(postsDirectory);
  const allPosts = fileNames
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => {
      const slug = fileName.replace(/\.md$/, '');
      const fullPath = path.join(postsDirectory, fileName);
      const fileContents = fs.readFileSync(fullPath, 'utf8');
      const { data, content } = matter(fileContents);

      return normalizePost({
        slug,
        title: data.title,
        date: data.date,
        excerpt: data.excerpt,
        content,
        author: data.author,
        readTime: data.readTime,
        coverImage: data.coverImage,
        tags: data.tags,
      } as BlogPost);
    });

  return allPosts.sort((a, b) => (a.date > b.date ? -1 : 1));
}

export function getFilePostBySlug(slug: string): BlogPost | null {
  const fullPath = path.join(postsDirectory, `${slug}.md`);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(fileContents);

  return normalizePost({
    slug,
    title: data.title,
    date: data.date,
    excerpt: data.excerpt,
    content,
    author: data.author,
    readTime: data.readTime,
    coverImage: data.coverImage,
    tags: data.tags,
  } as BlogPost);
}

type DbBlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  read_time: string;
  cover_image: string | null;
  tags: string[] | null;
  published_at: Date;
};

export async function hasBlogPostsTable(): Promise<boolean> {
  try {
    const schema = await resolveBlogPostsSchema();
    return Boolean(schema);
  } catch {
    return false;
  }
}

async function resolveBlogPostsSchema(): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ table_schema: string }[]>(
    Prisma.sql`select table_schema from information_schema.tables where table_name = 'blog_posts'`
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

async function getAllDbPosts(): Promise<BlogPost[]> {
  const schema = await resolveBlogPostsSchema();
  if (!schema) {
    return [];
  }
  const rows = await prisma.$queryRaw<DbBlogPost[]>(
    Prisma.sql`select slug, title, excerpt, content, author, read_time, cover_image, tags, published_at
               from ${Prisma.raw(`${schema}.blog_posts`)}
               order by published_at desc`
  );
  return rows.map((row) =>
    normalizePost({
      slug: row.slug,
      title: row.title,
      date: row.published_at.toISOString(),
      excerpt: row.excerpt,
      content: row.content,
      author: row.author,
      readTime: row.read_time,
      coverImage: row.cover_image ?? undefined,
      tags: row.tags ?? undefined,
    })
  );
}

export async function getDbPostBySlug(slug: string): Promise<BlogPost | null> {
  const schema = await resolveBlogPostsSchema();
  if (!schema) {
    return null;
  }
  const rows = await prisma.$queryRaw<DbBlogPost[]>(
    Prisma.sql`select slug, title, excerpt, content, author, read_time, cover_image, tags, published_at
               from ${Prisma.raw(`${schema}.blog_posts`)}
               where slug = ${slug}
               limit 1`
  );
  const row = rows?.[0];
  if (!row) {
    return null;
  }
  return normalizePost({
    slug: row.slug,
    title: row.title,
    date: row.published_at.toISOString(),
    excerpt: row.excerpt,
    content: row.content,
    author: row.author,
    readTime: row.read_time,
    coverImage: row.cover_image ?? undefined,
    tags: row.tags ?? undefined,
  });
}

export async function getAllPosts(): Promise<BlogPost[]> {
  const [dbPosts, filePosts] = await Promise.all([getAllDbPosts(), Promise.resolve(getAllFilePosts())]);
  const merged = new Map<string, BlogPost>();
  for (const post of dbPosts) {
    merged.set(post.slug, post);
  }
  for (const post of filePosts) {
    if (!merged.has(post.slug)) {
      merged.set(post.slug, post);
    }
  }
  return Array.from(merged.values())
    .map((post) => normalizePost(post))
    .sort((a, b) => (a.date > b.date ? -1 : 1));
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const dbPost = await getDbPostBySlug(slug);
  if (dbPost) {
    return normalizePost(dbPost);
  }
  const filePost = getFilePostBySlug(slug);
  if (!filePost) {
    return null;
  }
  return normalizePost(filePost);
}
