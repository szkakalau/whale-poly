import BlogIndexShell from '@/components/BlogIndexShell';
import { getAllFilePosts } from '@/lib/blog';
import BlogIndexClient from './BlogIndexClient';
import { Suspense } from 'react';

export const metadata = {
  title: 'Blog - Polymarket Whale Intelligence',
  description: 'Insights, updates, and educational content about prediction market analysis and whale tracking.',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'Blog - Polymarket Whale Intelligence',
    description: 'Insights, updates, and educational content about prediction market analysis and whale tracking.',
    type: 'website',
    url: 'https://www.sightwhale.com/blog',
    images: [
      {
        url: '/images/whale-alert-biden.svg',
        width: 1200,
        height: 630,
        alt: 'Polymarket Whale Intelligence Blog'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blog - Polymarket Whale Intelligence',
    description: 'Insights, updates, and educational content about prediction market analysis and whale tracking.',
    images: ['/images/whale-alert-biden.svg']
  },
  alternates: {
    canonical: 'https://www.sightwhale.com/blog',
  },
};

// ISR: blog listing content changes slowly, but we still want freshness.
export const revalidate = 3600;
// Prefer static HTML from the CDN (lower TTFB) + periodic revalidation.
export const dynamic = 'force-static';

function BlogIndexSkeleton() {
  return (
    <BlogIndexShell>
      <div className="space-y-8">
        <div className="h-16 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        <div className="grid gap-8 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[340px] animate-pulse rounded-2xl border border-white/10 bg-white/5"
            />
          ))}
        </div>
      </div>
    </BlogIndexShell>
  );
}

async function BlogIndexClientWithData() {
  // Yield once so the parent shell can flush quickly.
  await new Promise((r) => setTimeout(r, 0));
  const posts = (await getAllFilePosts()).slice(0, 60);
  return (
    <BlogIndexShell>
      <BlogIndexClient posts={posts} />
    </BlogIndexShell>
  );
}

export default function BlogIndexPage() {
  return (
    <Suspense fallback={<BlogIndexSkeleton />}>
      <BlogIndexClientWithData />
    </Suspense>
  );
}
