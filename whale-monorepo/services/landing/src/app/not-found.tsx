import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Not Found',
  description: 'The page you are looking for does not exist.',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <p className="text-8xl font-bold font-display text-accent/20 mb-4">404</p>
      <h1 className="text-2xl sm:text-3xl font-semibold font-display mb-3">
        Page not found
      </h1>
      <p className="text-muted max-w-md mb-8">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex gap-4">
        <Link href="/" className="btn-primary text-sm px-6 py-3">
          Go home
        </Link>
        <Link href="/blog" className="text-sm px-6 py-3 rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface-hover transition-colors">
          Read the blog
        </Link>
      </div>
    </div>
  );
}
