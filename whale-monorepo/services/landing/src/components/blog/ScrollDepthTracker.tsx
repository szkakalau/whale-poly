'use client';

import { useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';

type ScrollDepthTrackerProps = {
  /** Slug or identifier for the page being tracked */
  pageKey: string;
  /** Language of the page */
  language: string;
};

const MILESTONES = [25, 50, 75, 100] as const;

/**
 * Tracks scroll depth milestones on blog pages.
 * Fires at most once per milestone per page load.
 * Helps distinguish human readers (scroll) from bots (no scroll).
 */
export default function ScrollDepthTracker({ pageKey, language }: ScrollDepthTrackerProps) {
  const fired = useRef(new Set<number>());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Reset on re-mount (e.g. SPA navigation between blog posts)
    fired.current = new Set();

    const handleScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;

      const scrolled = Math.round((window.scrollY / docHeight) * 100);

      for (const milestone of MILESTONES) {
        if (scrolled >= milestone && !fired.current.has(milestone)) {
          fired.current.add(milestone);
          trackEvent('scroll_depth', { page: pageKey, language, depth: milestone });
        }
      }
    };

    // throttle to ~4 fps — more than enough for scroll depth
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // fire once on mount in case the page is already scrolled
    handleScroll();

    return () => window.removeEventListener('scroll', onScroll);
  }, [pageKey, language]);

  return null;
}
