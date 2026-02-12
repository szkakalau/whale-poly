import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getPostBySlug } from '@/lib/blog';

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  
  if (!post) {
    return {
      title: 'Post Not Found - Whale Intelligence',
    };
  }

  return {
    title: `${post.title} - Whale Intelligence`,
    description: post.excerpt,
    keywords: post.tags,
    authors: [{ name: post.author || 'Whale Team' }],
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
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
      tags: post.tags,
      url: `https://sightwhale.com/blog/${slug}`,
      images: [
        {
          url: '/images/whale-alert-biden.svg',
          width: 1200,
          height: 630,
          alt: post.title
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: ['/images/whale-alert-biden.svg']
    },
    alternates: {
      canonical: `/blog/${slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const safePost = post as NonNullable<typeof post>;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: safePost.title,
    description: safePost.excerpt,
    datePublished: safePost.date,
    dateModified: safePost.date,
    author: [
      {
        "@type": "Organization",
        name: safePost.author || "Whale Team"
      }
    ],
    publisher: {
      "@type": "Organization",
      name: "Sight Whale",
      url: "https://sightwhale.com"
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://sightwhale.com/blog/${slug}`
    },
    image: [
      "https://sightwhale.com/images/whale-alert-biden.svg"
    ],
    keywords: safePost.tags?.join(", ")
  };

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
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
          />
          <header className="mb-12 text-center">
            <div className="flex flex-wrap justify-center items-center gap-3 text-sm text-gray-400 mb-6">
              <time dateTime={safePost.date}>{new Date(safePost.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
              <span>•</span>
              <div className="flex gap-2">
                {safePost.tags?.map(tag => (
                  <span key={tag} className="px-3 py-1 rounded-full bg-white/5 text-sm text-gray-300 border border-white/10">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
            
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
              {safePost.title}
            </h1>
            
            <p className="text-xl text-gray-300 leading-relaxed max-w-2xl mx-auto">
              {safePost.excerpt}
            </p>
          </header>

          <div className="prose prose-invert prose-lg max-w-none prose-headings:font-bold prose-headings:text-white prose-a:text-violet-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-white prose-code:text-violet-200 prose-code:bg-violet-900/30 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[#1a1a1a] prose-pre:border prose-pre:border-white/10 prose-blockquote:border-l-violet-500 prose-blockquote:bg-white/5 prose-blockquote:py-2 prose-blockquote:pr-4 prose-li:marker:text-violet-500">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {safePost.content}
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
