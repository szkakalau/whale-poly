'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowUp } from 'lucide-react';

/**
 * Mobile-only back-to-top button. Appears after scrolling past the first
 * screenful, hidden on desktop (md+) where the TOC sidebar serves navigation.
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  const handleScroll = useCallback(() => {
    setVisible(window.scrollY > window.innerHeight);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={`
        fixed bottom-6 right-6 z-50
        w-10 h-10 rounded-full
        bg-accent shadow-lg
        flex items-center justify-center
        transition-all duration-200 ease-out
        hover:bg-accent-hover
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
        md:hidden
        ${visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}
      `}
      style={{ color: '#fff' }}
    >
      <ArrowUp className="w-4 h-4" aria-hidden />
    </button>
  );
}
