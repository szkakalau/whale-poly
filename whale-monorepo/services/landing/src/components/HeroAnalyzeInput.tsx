'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight } from 'lucide-react';

export default function HeroAnalyzeInput() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/analyze?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={handleSubmit} role="search" aria-label="Analyze any market">
      <p className="text-xs font-semibold text-muted mb-2.5">
        Analyze any market — no sign-up required
      </p>
      <div className="flex gap-0 rounded-lg border border-border focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/20 transition-shadow duration-200">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle pointer-events-none" aria-hidden />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Paste Polymarket URL or type a keyword…"
            className="w-full bg-transparent pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-subtle focus:outline-none"
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          disabled={!query.trim()}
          className="btn-primary rounded-l-none !rounded-r-lg px-5 min-h-[44px] text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          Analyze
          <ArrowRight className="w-3.5 h-3.5" aria-hidden />
        </button>
      </div>
    </form>
  );
}
