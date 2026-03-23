import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getAllPosts } from '@/lib/blog';
import BlogIndexClient from './BlogIndexClient';

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

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function BlogIndexPage() {
  const posts = await getAllPosts();

  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      {/* Background Effects */}
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/5 rounded-full blur-[120px]"></div>
      </div>

      <Header />

      <main className="mx-auto max-w-5xl px-6 py-32 relative">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Intelligence Log
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Deep dives into market mechanics, signal analysis, and platform updates.
          </p>
        </div>

        <BlogIndexClient posts={posts} />
      </main>

      <Footer />
    </div>
  );
}
