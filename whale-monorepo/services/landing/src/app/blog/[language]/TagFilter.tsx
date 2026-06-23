'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import type { TagWithCount } from '@/lib/blog';

export default function TagFilter({
  tags,
  language,
  activeTag,
  allLabel,
}: {
  tags: TagWithCount[];
  language: string;
  activeTag?: string;
  allLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(tags.length);

  // Compute how many tags fit in 2 rows
  useEffect(() => {
    if (!containerRef.current) return;
    // Approximate: each tag chip is ~80-120px wide + 8px gap
    // Container width / 100 ≈ tags per row, then × 2 rows
    const containerWidth = containerRef.current.offsetWidth;
    const perRow = Math.max(4, Math.floor(containerWidth / 110));
    setVisibleCount(perRow * 2);
  }, []);

  if (tags.length === 0) return null;

  const visibleTags = expanded ? tags : tags.slice(0, visibleCount);
  const hasMore = tags.length > visibleCount;

  return (
    <div ref={containerRef} className="flex flex-wrap items-center gap-2 mb-10">
      <Link
        href={`/blog/${language}`}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
          !activeTag
            ? 'bg-accent text-white'
            : 'bg-surface border border-border text-muted hover:text-foreground hover:bg-surface-hover'
        }`}
      >
        {allLabel}
      </Link>

      {visibleTags.map(({ tag, count }) => (
        <Link
          key={tag}
          href={`/blog/${language}?tag=${encodeURIComponent(tag)}`}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeTag === tag
              ? 'bg-accent text-white'
              : 'bg-surface border border-border text-muted hover:text-foreground hover:bg-surface-hover'
          }`}
        >
          {tag}
          <span className="ml-1 opacity-50">{count}</span>
        </Link>
      ))}

      {hasMore && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="px-3 py-1.5 rounded-full text-xs font-medium text-accent hover:text-accent-hover bg-surface border border-border hover:bg-surface-hover transition-colors"
        >
          {expanded ? '收起 ▲' : `+${tags.length - visibleCount} 更多`}
        </button>
      )}
    </div>
  );
}
