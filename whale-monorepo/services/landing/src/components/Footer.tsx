import Link from 'next/link';
import { WhaleLogo } from './WhaleLogo';

const SUPPORT_EMAIL = 'castro.liu@me.com';

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background py-12 sm:py-16 relative z-10 pb-safe">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-8">
          <div className="flex items-center gap-3">
            <WhaleLogo className="h-9 w-9 text-accent" />
            <span className="font-semibold text-foreground text-lg tracking-tight font-display">SightWhale</span>
          </div>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            {SUPPORT_EMAIL}
          </a>
        </div>

        <div className="mt-10 pt-8 border-t border-border-muted flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="text-subtle text-xs">
            © <time dateTime={new Date().getFullYear().toString()}>{new Date().getFullYear()}</time> SightWhale. All rights reserved.
          </div>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-8 gap-y-3">
            <Link href="/" className="text-subtle hover:text-muted text-xs transition-colors">
              Home
            </Link>
            <Link href="/about" className="text-subtle hover:text-muted text-xs transition-colors">
              About
            </Link>
            <Link href="/analyze" className="text-subtle hover:text-muted text-xs transition-colors">
              Analyze
            </Link>
            <Link href="/history" className="text-subtle hover:text-muted text-xs transition-colors">
              History
            </Link>
            <Link href="/methodology" className="text-subtle hover:text-muted text-xs transition-colors">
              Methodology
            </Link>
            <Link href="/blog" className="text-subtle hover:text-muted text-xs transition-colors">
              Blog
            </Link>
            <Link href="/pricing" className="text-subtle hover:text-muted text-xs transition-colors">
              Pricing
            </Link>
            <Link href="/terms" className="text-subtle hover:text-muted text-xs transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="text-subtle hover:text-muted text-xs transition-colors">
              Privacy
            </Link>
            <a
              href="https://twitter.com/SightWhale"
              target="_blank"
              rel="noopener noreferrer"
              className="text-subtle hover:text-muted text-xs transition-colors"
            >
              X/Twitter
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
