import { prisma } from '@/lib/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

// One-shot endpoint: insert the VW Analysis blog post into blog_posts.
// Hit once, then delete this file.

export async function GET() {
  try {
    const filePath = join(
      process.cwd(),
      'src/content/posts/polymarket-volume-weighted-price-analysis.md',
    );
    const raw = readFileSync(filePath, 'utf-8');
    const parts = raw.split('---');
    if (parts.length < 3) {
      return Response.json({ error: 'bad frontmatter' }, { status: 500 });
    }

    const body = parts.slice(2).join('---').trim();

    // Parse frontmatter
    const meta: Record<string, any> = {};
    for (const line of parts[1].trim().split('\n')) {
      const m = line.match(/^(\w[\w\s]*):\s*(.+)$/);
      if (!m) continue;
      const key = m[1].trim();
      let val: any = m[2].trim().replace(/^["']|["']$/g, '');
      if (val.startsWith('[') && val.endsWith(']')) {
        val = val
          .slice(1, -1)
          .split(',')
          .map((s: string) => s.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean);
      }
      meta[key] = val;
    }

    const tags = Array.isArray(meta.tags) ? meta.tags : [];
    const now = new Date('2026-06-30T00:00:00Z');

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS blog_posts (
        id text PRIMARY KEY,
        slug text NOT NULL,
        title text NOT NULL,
        excerpt text NOT NULL,
        content text NOT NULL,
        author text NOT NULL,
        read_time text NOT NULL,
        cover_image text,
        tags text[] DEFAULT '{}',
        published_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        language text NOT NULL DEFAULT 'en',
        group_slug text,
        status text NOT NULL DEFAULT 'published'
      )`,
    );

    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_language_idx ON blog_posts (slug, language)`,
    );

    await prisma.$executeRawUnsafe(
      `INSERT INTO blog_posts (id, slug, title, excerpt, content, author, read_time, tags, published_at, created_at, updated_at, language, group_slug, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (slug, language) DO UPDATE SET
         title=excluded.title, excerpt=excluded.excerpt, content=excluded.content,
         author=excluded.author, read_time=excluded.read_time, tags=excluded.tags,
         updated_at=excluded.updated_at`,
      crypto.randomUUID(),
      'polymarket-volume-weighted-price-analysis',
      meta.title,
      meta.excerpt,
      body,
      meta.author || 'Whale Team',
      '6 min',
      tags,
      now,
      now,
      now,
      'en',
      'polymarket-volume-weighted-analysis',
      'published',
    );

    return Response.json({ ok: true, slug: 'polymarket-volume-weighted-price-analysis' });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
