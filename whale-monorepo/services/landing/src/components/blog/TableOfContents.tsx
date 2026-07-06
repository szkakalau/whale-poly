'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { List, ChevronRight, ChevronDown } from 'lucide-react';
import type { HeadingItem } from '@/lib/markdown-utils';

type Props = {
  headings: HeadingItem[];
  labels: { tocHeading: string };
};

/**
 * Table of Contents for blog articles.
 *
 * Desktop (lg+): sticky sidebar with IntersectionObserver scroll-spy.
 * Mobile (<lg): collapsible accordion placed above article content by the parent.
 */
export default function TableOfContents({ headings, labels }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ---- Scroll spy (desktop) ----

  const setupObserver = useCallback(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    observerRef.current?.disconnect();

    const ids = headings.map((h) => h.id);
    if (ids.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the first heading that's currently intersecting (near the top)
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => {
            const aEl = a.target as HTMLElement;
            const bEl = b.target as HTMLElement;
            return aEl.getBoundingClientRect().top - bEl.getBoundingClientRect().top;
          });

        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: '-80px 0px -75% 0px',
        threshold: 0,
      },
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observerRef.current.observe(el);
    }
  }, [headings]);

  useEffect(() => {
    // Small delay so the DOM has rendered headings
    const timer = setTimeout(setupObserver, 150);
    return () => {
      clearTimeout(timer);
      observerRef.current?.disconnect();
    };
  }, [setupObserver]);

  // ---- Render ----

  if (headings.length === 0) return null;

  const tocContent = (
    <ul className="space-y-1">
      {headings.map((h) => (
        <li key={h.id}>
          <a
            href={`#${h.id}`}
            onClick={() => setExpanded(false)}
            className={`
              block text-sm leading-relaxed py-0.5 transition-colors duration-150
              ${h.level === 3 ? 'ml-3' : ''}
              ${activeId === h.id
                ? 'text-accent font-medium'
                : 'text-muted hover:text-foreground'
              }
            `}
          >
            {h.text}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* ── Mobile: collapsible accordion (hidden on lg+) ── */}
      <div className="lg:hidden">
        <div className="bg-surface card-shadow rounded-lg">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center justify-between w-full px-4 py-3 text-left"
            aria-expanded={expanded}
          >
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-subtle">
              <List className="w-3.5 h-3.5" aria-hidden />
              {labels.tocHeading}
            </span>
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted" aria-hidden />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted" aria-hidden />
            )}
          </button>
          {expanded && <div className="px-4 pb-4">{tocContent}</div>}
        </div>
      </div>

      {/* ── Desktop: sticky sidebar (hidden below lg) ── */}
      <nav className="hidden lg:block" aria-label="Table of contents">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-subtle mb-3">
          <List className="w-3.5 h-3.5" aria-hidden />
          {labels.tocHeading}
        </p>
        {tocContent}
      </nav>
    </>
  );
}
