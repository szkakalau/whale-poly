"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { BlogPost } from "@/lib/blog";
import {
  isDailySpotlightSlug,
  newestSpotlightTimestampMs,
  sortDailySpotlightPosts,
} from "@/lib/blog-spotlight-utils";

type Props = {
  posts: BlogPost[];
};

type LiveSignal = {
  id: string;
  occurredAt: string;
  walletMasked: string;
  market: string;
  side: "BUY" | "SELL" | "UNKNOWN";
  sizeUsd: number;
  whaleScore?: number;
  href?: string;
};

const SPOTLIGHT_POLL_MS = 5 * 60 * 1000;

/** When collapsed, show at most this many tag pills (incl. “All”). Use “Show all” for the rest. */
const COLLAPSED_TAG_CAP = 12;

export default function BlogIndexClient({ posts }: Props) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("All");
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [liveSignals, setLiveSignals] = useState<LiveSignal[]>([]);
  /** null = use server `posts` until first successful API load */
  const [apiSpotlight, setApiSpotlight] = useState<BlogPost[] | null>(null);

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const post of posts) {
      for (const tag of post.tags || []) {
        if (tag) set.add(tag);
      }
    }
    return ["All", ...Array.from(set.values()).sort()];
  }, [posts]);

  const tagToggleVisible = tags.length > COLLAPSED_TAG_CAP;

  /** Collapsed mode lists a capped set so every chip stays clickable; current filter is always included. */
  const displayTags = useMemo(() => {
    if (!tagToggleVisible || tagsExpanded) return tags;
    if (tags.length <= COLLAPSED_TAG_CAP) return tags;
    const nonAll = tags.filter((t) => t !== "All");
    let base: string[] = ["All", ...nonAll.slice(0, COLLAPSED_TAG_CAP - 1)];
    if (!base.includes(activeTag)) {
      base = ["All", activeTag, ...nonAll.filter((t) => t !== activeTag).slice(0, COLLAPSED_TAG_CAP - 2)];
    }
    return base;
  }, [tags, tagToggleVisible, tagsExpanded, activeTag]);

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

  const spotlightPool = useMemo(() => {
    if (apiSpotlight !== null) return apiSpotlight;
    return posts.filter((p) => isDailySpotlightSlug(p.slug));
  }, [apiSpotlight, posts]);

  const spotlight = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortDailySpotlightPosts(
      spotlightPool.filter((post) => {
        if (activeTag !== "All" && !post.tags?.includes(activeTag)) {
          return false;
        }
        if (!q) return true;
        const hay = `${post.title}\n${post.excerpt}\n${(post.tags || []).join(" ")}`.toLowerCase();
        return hay.includes(q);
      }),
    );
  }, [spotlightPool, activeTag, query]);

  const deepDives = filtered.filter((post) => !isDailySpotlightSlug(post.slug));

  const spotlightNewestAt = useMemo(() => newestSpotlightTimestampMs(spotlight), [spotlight]);

  const spotlightStale = useMemo(() => {
    if (spotlight.length === 0) return true;
    if (spotlightNewestAt === null) return true;
    // Consider spotlight stale if the newest entry is older than 30 hours.
    return Date.now() - spotlightNewestAt > 30 * 60 * 60 * 1000;
  }, [spotlight.length, spotlightNewestAt]);

  useEffect(() => {
    let alive = true;
    const loadSpotlight = () => {
      fetch("/api/blog/daily-spotlight", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (!alive || !json || !Array.isArray(json.posts)) return;
          setApiSpotlight(json.posts as BlogPost[]);
        })
        .catch(() => {});
    };
    loadSpotlight();
    const interval = setInterval(loadSpotlight, SPOTLIGHT_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") loadSpotlight();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (!spotlightStale) return;
    let alive = true;
    fetch("/api/live-signals")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!alive) return;
        const list = json && Array.isArray(json.signals) ? (json.signals as LiveSignal[]) : [];
        setLiveSignals(list.slice(0, 8));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [spotlightStale]);

  return (
    <div className="space-y-12">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 via-white/5 to-cyan-500/10 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Research Series</p>
          <h2 className="text-lg font-semibold text-white mt-2">Whale Intelligence Library</h2>
          <p className="text-xs text-gray-400 mt-2">
            Start with curated research pillars and follow the internal links.
          </p>
        </div>
        <Link
          href="/blog/research"
          className="inline-flex items-center rounded-full border border-violet-500/60 bg-violet-500/10 px-4 py-2 text-xs font-medium text-violet-100 hover:bg-violet-500/20"
        >
          Open Research Series
        </Link>
      </div>
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
        <div className="flex flex-col gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search markets, themes, or tags"
            className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-violet-500/60 transition-all"
          />
          <div className="flex flex-col gap-2">
            <div className="relative flex flex-wrap gap-2">
              {displayTags.map((tag) => (
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
              {tagToggleVisible && !tagsExpanded ? (
                <span
                  className="inline-flex items-center rounded-full border border-dashed border-white/15 bg-black/20 px-3 py-1 text-[11px] text-gray-500"
                  title="More tags available — expand the list"
                >
                  +{tags.length - displayTags.length} more
                </span>
              ) : null}
            </div>
            {tagToggleVisible ? (
              <button
                type="button"
                onClick={() => setTagsExpanded((v) => !v)}
                aria-expanded={tagsExpanded}
                className="group inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-cyan-200/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500/50"
              >
                <span>
                  {tagsExpanded ? "Show fewer tags" : `Show all ${tags.length} tags`}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-cyan-400/80 transition-transform duration-300 ease-out group-hover:text-cyan-300 ${
                    tagsExpanded ? "rotate-180" : ""
                  }`}
                  strokeWidth={2.5}
                  aria-hidden
                />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {spotlight.length > 0 || (spotlightStale && liveSignals.length > 0) ? (
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Daily spotlight</p>
              <h3 className="text-xl font-semibold text-white">Recent whale signals</h3>
            </div>
            <div className="text-xs text-gray-400">
              {spotlight.length > 0 ? `${spotlight.length} entries` : "Live feed"}
            </div>
          </div>
          {spotlight.length > 0 ? (
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
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {liveSignals.slice(0, 6).map((s) => (
                <Link
                  key={s.id}
                  href={s.href || "/smart-money"}
                  className="group rounded-2xl border border-white/10 bg-black/40 p-5 transition-all hover:border-emerald-500/40 hover:bg-white/5"
                >
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <time dateTime={s.occurredAt}>
                      {new Date(s.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </time>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em]">
                      Live
                    </span>
                  </div>
                  <h4 className="mt-3 text-base font-semibold text-white group-hover:text-emerald-200 line-clamp-2">
                    {s.market}
                  </h4>
                  <p className="mt-2 text-sm text-gray-400 line-clamp-2">
                    {s.side} · {s.walletMasked}
                    {typeof s.whaleScore === "number" && Number.isFinite(s.whaleScore) ? ` · Score ${Math.round(s.whaleScore)}` : ""}
                  </p>
                </Link>
              ))}
            </div>
          )}
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
