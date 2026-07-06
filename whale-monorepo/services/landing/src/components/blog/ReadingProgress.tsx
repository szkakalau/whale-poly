'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * Thin reading progress bar fixed below the site header.
 * Uses requestAnimationFrame to avoid layout thrashing on scroll.
 */
export default function ReadingProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (!barRef.current) return;
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
    barRef.current.style.width = `${progress}%`;
  }, []);

  useEffect(() => {
    let rafId: number;
    const onScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(handleScroll);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // Initial call
    handleScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [handleScroll]);

  return (
    <div
      className="fixed top-14 sm:top-16 left-0 right-0 h-1 z-40 bg-border"
      role="progressbar"
      aria-valuenow={0}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Reading progress"
    >
      <div
        ref={barRef}
        className="h-full bg-accent transition-[width] duration-100 ease-out"
        style={{ width: '0%' }}
      />
    </div>
  );
}
