import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getPostBySlug, getAllPosts } from '@/lib/blog';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  
  if (!post) {
    return {
      title: 'Post Not Found - Whale Intelligence',
    };
  }

  return {
    title: `${post.title} - Whale Intelligence`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
      tags: post.tags,
    },
  };
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      {/* Background Effects */}
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/5 rounded-full blur-[120px]"></div>
      </div>

      <Header />

      <main className="mx-auto max-w-3xl px-6 py-32 relative">
        <Link href="/blog" className="inline-flex items-center text-sm text-gray-400 hover:text-white mb-8 transition-colors">
          ← Back to Intelligence Log
        </Link>

        <article>
          <header className="mb-12 text-center">
            <div className="flex flex-wrap justify-center items-center gap-3 text-sm text-gray-400 mb-6">
              <time dateTime={post.date}>{new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
              <span>•</span>
              <div className="flex gap-2">
                {post.tags?.map(tag => (
                  <span key={tag} className="px-3 py-1 rounded-full bg-white/5 text-sm text-gray-300 border border-white/10">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
            
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
              {post.title}
            </h1>
            
            <p className="text-xl text-gray-300 leading-relaxed max-w-2xl mx-auto">
              {post.excerpt}
            </p>
          </header>

          <div className="prose prose-invert prose-lg max-w-none prose-headings:font-bold prose-headings:text-white prose-a:text-violet-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-white prose-code:text-violet-200 prose-code:bg-violet-900/30 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[#1a1a1a] prose-pre:border prose-pre:border-white/10 prose-blockquote:border-l-violet-500 prose-blockquote:bg-white/5 prose-blockquote:py-2 prose-blockquote:pr-4 prose-li:marker:text-violet-500">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {post.content}
            </ReactMarkdown>
          </div>
        </article>

        {/* Share/CTA Section */}
        <div className="mt-20 pt-10 border-t border-white/10 text-center">
          <h3 className="text-xl font-bold text-white mb-4">Want real-time whale alerts?</h3>
          <p className="text-gray-400 mb-8">Get notified when smart money moves.</p>
          <Link href="/" className="btn-primary px-8 py-3">
            Start Tracking →
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
