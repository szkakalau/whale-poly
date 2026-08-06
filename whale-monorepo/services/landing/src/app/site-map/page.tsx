import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import type { Metadata } from 'next';

export const revalidate = 3600;

const API_BASE = process.env.TRADE_INGEST_API_URL || 'https://sightwhale.onrender.com';

const getCachedPosts = unstable_cache(
  async () => {
    try {
      const [enRes, zhRes] = await Promise.all([
        fetch(`${API_BASE}/blog/posts?language=en&limit=100`),
        fetch(`${API_BASE}/blog/posts?language=zh&limit=100`),
      ]);
      const [enData, zhData] = await Promise.all([
        enRes.ok ? enRes.json() : { posts: [] },
        zhRes.ok ? zhRes.json() : { posts: [] },
      ]);
      return {
        en: (enData.posts || []).map((p: any) => ({ slug: p.slug, title: p.title })),
        zh: (zhData.posts || []).map((p: any) => ({ slug: p.slug, title: p.title })),
      };
    } catch {
      return { en: [], zh: [] };
    }
  },
  ['html-sitemap-posts-v1'],
  { revalidate: 3600 },
);

export const metadata: Metadata = {
  title: 'Site Map — SightWhale',
  description: 'Complete list of all pages on SightWhale.com',
  robots: { index: true, follow: true },
};

export default async function SiteMapPage() {
  const posts = await getCachedPosts();

  return (
    <div className="py-12 sm:py-20 max-w-3xl mx-auto px-4">
      <h1 className="text-3xl sm:text-4xl font-bold font-display tracking-tight mb-2">Site Map</h1>
      <p className="text-muted mb-12">Complete list of pages on SightWhale.com</p>

      {/* Main pages */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold font-display mb-4">Main Pages</h2>
        <ul className="space-y-2">
          {[
            { href: '/', label: 'Home' },
            { href: '/about', label: 'About' },
            { href: '/history', label: 'History' },
            { href: '/methodology', label: 'Methodology' },
            { href: '/pricing', label: 'Pricing' },
            { href: '/polymarket-alerts-tl', label: 'Polymarket Alerts TL' },
            { href: '/volume-analysis', label: 'Volume Analysis' },
            { href: '/terms', label: 'Terms of Service' },
            { href: '/privacy', label: 'Privacy Policy' },
          ].map(({ href, label }) => (
            <li key={href}>
              <Link href={href} className="text-accent hover:text-accent-hover underline underline-offset-2 transition-colors">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* EN Blog posts */}
      {posts.en.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold font-display mb-4">Blog (English)</h2>
          <ul className="space-y-1.5">
            {posts.en.map((post: { slug: string; title: string }) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/en/${post.slug}`}
                  className="text-accent hover:text-accent-hover underline underline-offset-2 transition-colors text-sm"
                >
                  {post.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ZH Blog posts */}
      {posts.zh.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold font-display mb-4">博客 (中文)</h2>
          <ul className="space-y-1.5">
            {posts.zh.map((post: { slug: string; title: string }) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/zh/${post.slug}`}
                  className="text-accent hover:text-accent-hover underline underline-offset-2 transition-colors text-sm"
                >
                  {post.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
