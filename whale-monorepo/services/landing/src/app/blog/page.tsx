import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getAllPosts } from '@/lib/blog';

export const metadata = {
  title: 'Blog - Whale Intelligence',
  description: 'Insights, updates, and educational content about prediction market analysis and whale tracking.',
  openGraph: {
    title: 'Blog - Whale Intelligence',
    description: 'Insights, updates, and educational content about prediction market analysis and whale tracking.',
    type: 'website',
    url: 'https://sightwhale.com/blog',
    images: [
      {
        url: '/images/whale-alert-biden.svg',
        width: 1200,
        height: 630,
        alt: 'Whale Intelligence Blog'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blog - Whale Intelligence',
    description: 'Insights, updates, and educational content about prediction market analysis and whale tracking.',
    images: ['/images/whale-alert-biden.svg']
  },
  alternates: {
    canonical: '/blog',
  },
};

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

        <div className="grid md:grid-cols-2 gap-8">
          {posts.map((post) => (
            <Link 
              key={post.slug} 
              href={`/blog/${post.slug}`}
              className="group relative flex flex-col bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:bg-white/10 hover:border-violet-500/30 transition-all duration-300"
            >
              <div className="p-8 flex-1 flex flex-col">
                <div className="flex items-center gap-3 text-sm text-gray-400 mb-4">
                  <time dateTime={post.date}>{new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
                  <span>•</span>
                  <div className="flex gap-2">
                    {post.tags?.map(tag => (
                      <span key={tag} className="px-2 py-1 rounded-md bg-white/5 text-xs text-gray-400 border border-white/5">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-violet-300 transition-colors">
                  {post.title}
                </h2>
                
                <p className="text-gray-400 mb-6 flex-1">
                  {post.excerpt}
                </p>

                <div className="flex items-center text-sm font-medium text-violet-400 group-hover:translate-x-1 transition-transform">
                  Read Article →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
