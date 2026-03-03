"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { BlogPost } from "@/lib/blog";

type Props = {
  posts: BlogPost[];
};

export default function BlogIndexClient({ posts }: Props) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("All");

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const post of posts) {
      for (const tag of post.tags || []) {
        if (tag) set.add(tag);
      }
    }
    return ["All", ...Array.from(set.values()).sort()];
  }, [posts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (activeTag !== "All" && !post.tags?.includes(activeTag)) {
        return false;
      }
      if (!q) return true;
      const hay = `${post.title}\n${post.excerpt}\n${(post.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [posts, query, activeTag]);

  const spotlight = filtered.filter((post) => post.slug.startsWith("daily-spotlight-"));
  const deepDives = filtered.filter((post) => !post.slug.startsWith("daily-spotlight-"));

  return (
    <div className="space-y-12">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Discover</p>
            <h2 className="text-lg font-semibold text-white">Find signals fast</h2>
          </div>
          <div className="text-xs text-gray-400">
            {filtered.length} posts • {spotlight.length} spotlight
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[1.2fr,1fr]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search markets, themes, or tags"
            className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-violet-500/60 transition-all"
          />
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(tag)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  activeTag === tag
                    ? "border-violet-500/60 bg-violet-500/15 text-violet-100"
                    : "border-white/10 bg-white/5 text-gray-400 hover:text-white"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {spotlight.length > 0 ? (
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Daily spotlight</p>
              <h3 className="text-xl font-semibold text-white">Recent whale signals</h3>
            </div>
            <div className="text-xs text-gray-400">{spotlight.length} entries</div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {spotlight.slice(0, 6).map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group rounded-2xl border border-white/10 bg-black/40 p-5 transition-all hover:border-violet-500/40 hover:bg-white/5"
              >
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <time dateTime={post.date}>
                    {new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </time>
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em]">
                    Spotlight
                  </span>
                </div>
                <h4 className="mt-3 text-base font-semibold text-white group-hover:text-violet-200">
                  {post.title}
                </h4>
                <p className="mt-2 text-sm text-gray-400 line-clamp-2">{post.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Deep dives</p>
            <h3 className="text-xl font-semibold text-white">Analysis and research</h3>
          </div>
          <div className="text-xs text-gray-400">{deepDives.length} entries</div>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          {deepDives.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group relative flex flex-col bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:bg-white/10 hover:border-violet-500/30 transition-all duration-300"
            >
              <div className="p-8 flex-1 flex flex-col">
                <div className="flex items-center gap-3 text-sm text-gray-400 mb-4">
                  <time dateTime={post.date}>
                    {new Date(post.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </time>
                  <span>•</span>
                  <div className="flex gap-2">
                    {post.tags?.map((tag) => (
                      <span key={tag} className="px-2 py-1 rounded-md bg-white/5 text-xs text-gray-400 border border-white/5">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <h4 className="text-2xl font-bold text-white mb-3 group-hover:text-violet-300 transition-colors">
                  {post.title}
                </h4>

                <p className="text-gray-400 mb-6 flex-1">{post.excerpt}</p>

                <div className="flex items-center text-sm font-medium text-violet-400 group-hover:translate-x-1 transition-transform">
                  Read Article →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
