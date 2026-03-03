import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prisma } from '@prisma/client';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getAllFilePosts, getAllPosts, getPostBySlug } from '@/lib/blog';
import { prisma } from '@/lib/prisma';

interface Props {
  params: Promise<{ slug: string }>;
}

export const revalidate = 3600;

export async function generateStaticParams() {
  let posts = getAllFilePosts();
  try {
    posts = await getAllPosts();
  } catch {
    posts = getAllFilePosts();
  }
  return posts.slice(0, 200).map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  
  if (!post) {
    return {
      title: 'Post Not Found - Polymarket Whale Intelligence',
    };
  }

  return {
    title: `${post.title} - Polymarket Whale Intelligence`,
    description: post.excerpt,
    keywords: post.tags,
    authors: [{ name: post.author || 'Whale Team' }],
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
      tags: post.tags,
      url: `https://www.sightwhale.com/blog/${slug}`,
      images: [
        {
          url: '/images/whale-alert-biden.svg',
          width: 1200,
          height: 630,
          alt: post.title
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: ['/images/whale-alert-biden.svg']
    },
    alternates: {
      canonical: `/blog/${slug}`,
    },
  };
}

type SpotlightSection = {
  title: string;
  lines: string[];
};

type SpotlightData = {
  windowLine: string | null;
  sections: SpotlightSection[];
};

const SPOTLIGHT_TITLES = new Set([
  'Big Spender',
  'Contrarian Signal',
  'High Win-Rate Sniper',
  'Market Read',
  'Disclaimer',
]);

function parseDailySpotlight(raw: string): SpotlightData {
  const lines = raw.split(/\r?\n/).map((line) => line.trim());
  const sections: SpotlightSection[] = [];
  let windowLine: string | null = null;
  let current: SpotlightSection | null = null;
  for (const line of lines) {
    if (!line) {
      continue;
    }
    if (line.startsWith('Window:')) {
      windowLine = line.replace(/^Window:\s*/, '');
      continue;
    }
    const normalizedTitle = line.replace(/^#{1,6}\s*/, '');
    if (SPOTLIGHT_TITLES.has(line) || SPOTLIGHT_TITLES.has(normalizedTitle)) {
      if (current) {
        sections.push(current);
      }
      current = { title: SPOTLIGHT_TITLES.has(normalizedTitle) ? normalizedTitle : line, lines: [] };
      continue;
    }
    if (!current) {
      continue;
    }
    current.lines.push(line);
  }
  if (current) {
    sections.push(current);
  }
  return { windowLine, sections };
}

function extractKeyValues(lines: string[]) {
  const kv: Array<{ label: string; value: string }> = [];
  const rest: string[] = [];
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const label = line
        .slice(0, idx)
        .trim()
        .replace(/^[-*]\s+/, '')
        .replace(/^#{1,6}\s*/, '');
      const value = line.slice(idx + 1).trim();
      if (label && value) {
        kv.push({ label, value });
        continue;
      }
    }
    rest.push(line);
  }
  return { kv, rest };
}

function extractWallets(spotlight: SpotlightData): string[] {
  const found = new Set<string>();
  const re = /0x[a-fA-F0-9]{40}/g;
  for (const section of spotlight.sections) {
    for (const line of section.lines) {
      const matches = line.match(re);
      if (matches) {
        for (const m of matches) {
          found.add(m.toLowerCase());
        }
      }
    }
    const { kv } = extractKeyValues(section.lines);
    for (const item of kv) {
      const matches = item.value.match(re);
      if (matches) {
        for (const m of matches) {
          found.add(m.toLowerCase());
        }
      }
    }
  }
  return Array.from(found);
}

function extractActors(spotlight: SpotlightData): string[] {
  const found = new Set<string>();
  for (const section of spotlight.sections) {
    const { kv } = extractKeyValues(section.lines);
    for (const item of kv) {
      if (item.label.toLowerCase() !== 'actor') continue;
      const v = item.value.trim();
      if (!v) continue;
      found.add(v);
    }
  }
  return Array.from(found);
}

function parseBeijingWindow(windowLine: string | null): { start: Date; end: Date } | null {
  if (!windowLine) return null;
  const m = windowLine.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
  if (!m) return null;
  const date = m[1];
  const time = m[2];
  const [y, mo, d] = date.split('-').map((v) => Number(v));
  const [hh, mm] = time.split(':').map((v) => Number(v));
  if (![y, mo, d, hh, mm].every((n) => Number.isFinite(n))) return null;
  const end = new Date(Date.UTC(y, mo - 1, d, hh - 8, mm, 0));
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { start, end };
}

function parseCents(value: string): number | null {
  const v = value.trim().replace(/[,$]/g, '');
  const m = v.match(/(-?\d+(\.\d+)?)\s*¢/);
  if (!m) return null;
  const cents = Number(m[1]);
  if (!Number.isFinite(cents)) return null;
  return cents / 100;
}

function parseUsd(value: string): number | null {
  const v = value.trim().replace(/[$,]/g, '');
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseActorWalletHint(actor: string): { prefix: string; suffix: string } | null {
  const raw = actor.trim();
  if (!raw.toLowerCase().startsWith('0x')) return null;
  const normalized = raw.replace('…', '...').replace(/\s+/g, '');
  const m = normalized.match(/^(0x[a-fA-F0-9]{3,10})\.\.\.([a-fA-F0-9]{3,10})$/);
  if (!m) return null;
  return { prefix: m[1].toLowerCase(), suffix: m[2].toLowerCase() };
}

function safeUrlHost(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return '';
  }
}

function isFullWallet(value: string): boolean {
  return /^0x[a-f0-9]{40}$/.test((value || '').trim().toLowerCase());
}

async function resolveOutcomeFromDb(params: {
  windowLine: string | null;
  market: string | null;
  actor: string | null;
  wallet: string | null;
  direction: string | null;
  notionalText: string | null;
  priceText: string | null;
}): Promise<{ wallet: string | null; outcome: string | null } | null> {
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
    return null;
  }
  const window = parseBeijingWindow(params.windowLine);
  if (!window) return null;
  const market = (params.market || '').trim();
  const direction = (params.direction || '').trim().toLowerCase();
  const side = direction === 'buy' || direction === 'sell' ? direction : null;
  const notional = params.notionalText ? parseUsd(params.notionalText) : null;
  const price = params.priceText ? parseCents(params.priceText) : null;

  let walletExact: string | null = null;
  const walletRaw = (params.wallet || '').trim().toLowerCase();
  if (/^0x[a-f0-9]{40}$/.test(walletRaw)) walletExact = walletRaw;

  let walletFromUsername: string | null = null;
  const actor = (params.actor || '').trim();
  const actorHint = actor ? parseActorWalletHint(actor) : null;
  if (!walletExact && actor && !actorHint) {
    const rows = await prisma.$queryRaw<{ wallet_address: string }[]>(
      Prisma.sql`
        SELECT wallet_address
        FROM wallet_names
        WHERE lower(polymarket_username) = lower(${actor})
        LIMIT 1
      `,
    );
    walletFromUsername = rows[0]?.wallet_address ? String(rows[0].wallet_address).toLowerCase() : null;
  }

  const whereParts: Prisma.Sql[] = [
    Prisma.sql`timestamp >= ${window.start}`,
    Prisma.sql`timestamp < ${window.end}`,
    Prisma.sql`coalesce(market_id, '') not ilike '%health%'`,
    Prisma.sql`coalesce(trade_id, '') not ilike 'health-test-%'`,
    Prisma.sql`coalesce(market_title, '') not ilike '%health%'`,
  ];

  if (side) whereParts.push(Prisma.sql`lower(side) = ${side}`);
  if (market) {
    const marketNeedle = market.length > 80 ? market.slice(0, 80) : market;
    whereParts.push(Prisma.sql`coalesce(market_title, '') ilike ${`%${marketNeedle}%`}`);
  }

  if (walletExact) {
    whereParts.push(Prisma.sql`lower(wallet) = ${walletExact}`);
  } else if (walletFromUsername) {
    whereParts.push(Prisma.sql`lower(wallet) = ${walletFromUsername}`);
  } else if (actorHint) {
    whereParts.push(Prisma.sql`lower(wallet) like ${`${actorHint.prefix}%`}`);
    whereParts.push(Prisma.sql`lower(wallet) like ${`%${actorHint.suffix}`}`);
  }

  const whereSql = Prisma.join(whereParts, ' AND ');

  const rows = await prisma.$queryRaw<
    { wallet: string; outcome: string | null; score: number }[]
  >(
    Prisma.sql`
      SELECT
        wallet,
        outcome,
        (
          ${notional === null ? Prisma.sql`0` : Prisma.sql`abs((amount * price)::float - ${notional})`} +
          ${price === null ? Prisma.sql`0` : Prisma.sql`abs(price::float - ${price})`}
        ) AS score
      FROM trades_raw
      WHERE ${whereSql}
      ORDER BY score ASC, timestamp DESC
      LIMIT 1
    `,
  );

  const row = rows[0];
  if (!row) return null;
  return {
    wallet: row.wallet ? String(row.wallet).toLowerCase() : null,
    outcome: row.outcome ? String(row.outcome) : null,
  };
}

function extractMarkets(spotlight: SpotlightData): Array<{ label: string; url: string }> {
  const candidates: string[] = [];
  const allowLabel = /market|question|event/i;
  const urlRe = /^https?:\/\//i;

  for (const section of spotlight.sections) {
    const { kv, rest } = extractKeyValues(section.lines);

    for (const item of kv) {
      if (!allowLabel.test(item.label)) continue;
      const v = item.value.trim();
      if (!v) continue;
      candidates.push(v);
    }

    for (const line of rest) {
      const m = line.match(/^(Market|Question|Event)\s*:\s*(.+)$/i);
      if (!m) continue;
      const v = String(m[2] || '').trim();
      if (!v) continue;
      candidates.push(v);
    }
  }

  const seen = new Set<string>();
  const out: Array<{ label: string; url: string }> = [];
  for (const raw of candidates) {
    const v = raw.replace(/\s+/g, ' ').trim();
    if (v.length < 8) continue;
    if (v.length > 180) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    if (urlRe.test(v)) {
      out.push({ label: v, url: v });
      continue;
    }

    const url = `https://polymarket.com/search?q=${encodeURIComponent(v)}`;
    out.push({ label: v, url });
  }

  return out.slice(0, 4);
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const safePost = post as NonNullable<typeof post>;
  const isDailySpotlight = safePost.slug.startsWith('daily-spotlight-');
  const spotlight = isDailySpotlight ? parseDailySpotlight(safePost.content) : null;
  const allSpotlightWallets = spotlight ? extractWallets(spotlight) : [];
  const allSpotlightActors = spotlight ? extractActors(spotlight) : [];
  const spotlightWallets = allSpotlightWallets.slice(0, 4);
  const spotlightMarkets = spotlight ? extractMarkets(spotlight) : [];
  const polymarketSearchUrl = `https://polymarket.com/search?q=${encodeURIComponent(
    spotlightMarkets[0]?.label || safePost.title,
  )}`;
  const spotlightSignalsCount = spotlight
    ? spotlight.sections.filter((section) => section.title !== 'Market Read' && section.title !== 'Disclaimer').length
    : 0;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: safePost.title,
    description: safePost.excerpt,
    datePublished: safePost.date,
    dateModified: safePost.date,
    author: [
      {
        "@type": "Organization",
        name: safePost.author || "Whale Team"
      }
    ],
    publisher: {
      "@type": "Organization",
      name: "Sight Whale",
      url: "https://www.sightwhale.com",
      logo: {
        "@type": "ImageObject",
        url: "https://www.sightwhale.com/images/og-image.png"
      }
    },
    isPartOf: {
      "@type": "Blog",
      "@id": "https://www.sightwhale.com/blog"
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://www.sightwhale.com/blog/${slug}`
    },
    image: [
      "https://www.sightwhale.com/images/whale-alert-biden.svg"
    ],
    inLanguage: "en-US",
    keywords: safePost.tags?.join(", ")
  };

  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      {/* Background Effects */}
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/5 rounded-full blur-[120px]"></div>
      </div>

      <Header />

      <main className="mx-auto max-w-3xl px-6 py-32 relative">
        <Link href="/blog" className="inline-flex items-center text-sm text-gray-400 hover:text-white mb-8 transition-colors">
          ← Back to Intelligence Log
        </Link>

        <article>
          <script
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
          />
          <header className="mb-12 text-center">
            <div className="flex flex-wrap justify-center items-center gap-3 text-sm text-gray-400 mb-6">
              <time dateTime={safePost.date}>{new Date(safePost.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
              <span>•</span>
              <div className="flex gap-2">
                {safePost.tags?.map(tag => (
                  <span key={tag} className="px-3 py-1 rounded-full bg-white/5 text-sm text-gray-300 border border-white/10">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
            
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
              {safePost.title}
            </h1>
            
            <p className="text-xl text-gray-300 leading-relaxed max-w-2xl mx-auto">
              {safePost.excerpt}
            </p>
          </header>

          {isDailySpotlight && spotlight ? (
            <div className="space-y-10">
              <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-gray-400">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 uppercase tracking-[0.2em] text-[11px] text-violet-300">
                  Daily Spotlight
                </span>
                {spotlight.windowLine ? (
                  <span className="text-gray-400">{spotlight.windowLine}</span>
                ) : null}
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6">
                <div className="flex flex-col gap-2">
                  <p className="text-sm uppercase tracking-[0.2em] text-gray-400">Today at a glance</p>
                  <div className="text-sm text-gray-300">
                    Verification-friendly summary extracted from today’s spotlight.
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Time window</p>
                        <p className="mt-2 font-semibold text-white">
                          {spotlight.windowLine || 'Not provided'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-gray-200">
                          Signals: {spotlightSignalsCount}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-gray-200">
                          Actors: {allSpotlightActors.length}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-gray-200">
                          Wallets: {allSpotlightWallets.length}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-gray-200">
                          Markets: {spotlightMarkets.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {spotlightMarkets.length > 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Markets</p>
                      <div className="mt-2 space-y-2">
                        {spotlightMarkets.slice(0, 3).map((m) => (
                          <a
                            key={m.url}
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sm text-violet-300 hover:text-violet-200 underline underline-offset-4"
                          >
                            {m.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {spotlightWallets.length > 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Wallets</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {spotlightWallets.map((w) => (
                          <Link
                            key={w}
                            href={`/whales/${encodeURIComponent(w)}`}
                            className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-mono text-violet-200 hover:bg-white/10"
                          >
                            {w.slice(0, 6)}…{w.slice(-4)}
                          </Link>
                        ))}
                      </div>
                      {allSpotlightWallets.length > spotlightWallets.length ? (
                        <div className="mt-3 text-xs text-gray-500">
                          Showing {spotlightWallets.length} of {allSpotlightWallets.length}. Use the leaderboard for more.
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {spotlightWallets.length === 0 && allSpotlightActors.length > 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Actors</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {allSpotlightActors.slice(0, 6).map((a) => (
                          <span
                            key={a}
                            className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-gray-200"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                      {allSpotlightActors.length > 6 ? (
                        <div className="mt-3 text-xs text-gray-500">
                          Showing 6 of {allSpotlightActors.length}. Use the cards below for full details.
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Verify</p>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <a
                        href={polymarketSearchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-gray-200 hover:bg-white/10 transition-colors"
                      >
                        <div className="font-semibold text-white">Polymarket search</div>
                        <div className="mt-1 text-xs text-gray-400">Open the closest market context we can infer.</div>
                      </a>
                      <a
                        href="https://clob.polymarket.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-gray-200 hover:bg-white/10 transition-colors"
                      >
                        <div className="font-semibold text-white">CLOB API</div>
                        <div className="mt-1 text-xs text-gray-400">Validate order book and recent moves.</div>
                      </a>
                      <Link
                        href="/methodology"
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-gray-200 hover:bg-white/10 transition-colors"
                      >
                        <div className="font-semibold text-white">Methodology</div>
                        <div className="mt-1 text-xs text-gray-400">How alerts and scoring are generated.</div>
                      </Link>
                      <Link
                        href="/smart-money"
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-gray-200 hover:bg-white/10 transition-colors"
                      >
                        <div className="font-semibold text-white">Leaderboard</div>
                        <div className="mt-1 text-xs text-gray-400">Explore wallets with track records.</div>
                      </Link>
                    </div>
                    {spotlightMarkets.length === 0 && allSpotlightWallets.length === 0 && allSpotlightActors.length === 0 ? (
                      <div className="mt-4 text-xs text-gray-500 leading-relaxed">
                        This post may not include explicit wallet addresses or market titles. The summary still provides the time window and spotlight signals below, plus verification links above.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                {(await Promise.all(
                  spotlight.sections
                    .filter((section) => section.title !== 'Market Read' && section.title !== 'Disclaimer')
                    .map(async (section) => {
                    const { kv, rest } = extractKeyValues(section.lines);
                    const kvMap = new Map<string, string>();
                    for (const item of kv) {
                      const k = item.label.trim();
                      if (!k) continue;
                      if (!kvMap.has(k)) kvMap.set(k, item.value);
                    }
                    const marketValue = kvMap.get('Market') || '';
                    if (!kvMap.has('Outcome') || kvMap.get('Outcome') === 'unknown') {
                      const resolved = await resolveOutcomeFromDb({
                        windowLine: spotlight.windowLine,
                        market: marketValue || null,
                        actor: kvMap.get('Actor') || null,
                        wallet: kvMap.get('Wallet') || null,
                        direction: kvMap.get('Direction') || null,
                        notionalText: kvMap.get('Notional') || null,
                        priceText: kvMap.get('Price') || null,
                      });
                      if (resolved?.outcome) kvMap.set('Outcome', resolved.outcome);
                      if (resolved?.wallet && !kvMap.has('Wallet')) kvMap.set('Wallet', resolved.wallet);
                      if (!kvMap.has('Outcome')) kvMap.set('Outcome', '—');
                    }
                    if (!kvMap.has('Market URL') && marketValue) {
                      kvMap.set('Market URL', `https://polymarket.com/search?q=${encodeURIComponent(marketValue)}`);
                    }

                    const actor = kvMap.get('Actor') || '—';
                    const wallet = kvMap.get('Wallet') || '';
                    const direction = (kvMap.get('Direction') || '').toUpperCase();
                    const market = kvMap.get('Market') || '—';
                    const outcome = kvMap.get('Outcome') || '—';
                    const notional = kvMap.get('Notional') || '';
                    const price = kvMap.get('Price') || '';
                    const winRate = kvMap.get('Win rate') || '';
                    const marketUrl = kvMap.get('Market URL') || '';
                    const tradeId = kvMap.get('Trade ID') || '';
                    const marketId = kvMap.get('Market ID') || '';
                    const host = marketUrl ? safeUrlHost(marketUrl) : '';
                    const isEmptyState = kvMap.size === 0 && rest.length > 0;

                    const directionTone =
                      direction === 'BUY'
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                        : direction === 'SELL'
                        ? 'border-rose-500/50 bg-rose-500/10 text-rose-200'
                        : 'border-white/15 bg-white/5 text-gray-200';

                    return (
                      <div
                        key={section.title}
                        className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] flex flex-col"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-xs uppercase tracking-[0.22em] text-gray-400">{section.title}</p>
                          {direction ? (
                            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide ${directionTone}`}>
                              {direction}
                            </span>
                          ) : null}
                        </div>

                        {isEmptyState ? (
                          <div className="mt-6 flex-1 rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-gray-300">
                            {rest.join(' ')}
                          </div>
                        ) : (
                          <>
                            <div className="mt-4">
                              <div className="text-xs uppercase tracking-wide text-gray-500">Market</div>
                              {marketUrl ? (
                                <a
                                  href={marketUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-2 block text-base font-semibold text-white leading-snug hover:text-violet-200 transition-colors"
                                >
                                  <span className="line-clamp-3">{market}</span>
                                </a>
                              ) : (
                                <div className="mt-2 text-base font-semibold text-white leading-snug line-clamp-3">
                                  {market}
                                </div>
                              )}
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-gray-200">
                                Outcome: <span className="ml-1 text-white">{outcome || '—'}</span>
                              </span>
                              {winRate ? (
                                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-gray-200">
                                  Win: <span className="ml-1 text-white">{winRate}</span>
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-5 grid grid-cols-2 gap-3">
                              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                                <div className="text-[11px] uppercase tracking-wide text-gray-500">Notional</div>
                                <div className="mt-1 text-sm font-semibold text-white">{notional || '—'}</div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                                <div className="text-[11px] uppercase tracking-wide text-gray-500">Price</div>
                                <div className="mt-1 text-sm font-semibold text-white">{price || '—'}</div>
                              </div>
                            </div>

                            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                {wallet && isFullWallet(wallet) ? (
                                  <Link
                                    href={`/whales/${encodeURIComponent(wallet)}`}
                                    className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-mono text-violet-200 hover:bg-white/10"
                                  >
                                    {wallet.slice(0, 6)}…{wallet.slice(-4)}
                                  </Link>
                                ) : (
                                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-gray-200">
                                    Actor: <span className="ml-1 font-mono text-white">{actor}</span>
                                  </span>
                                )}
                                {marketId ? (
                                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-mono text-gray-300">
                                    {marketId.length > 14 ? `${marketId.slice(0, 6)}…${marketId.slice(-6)}` : marketId}
                                  </span>
                                ) : null}
                              </div>

                              {marketUrl ? (
                                <a
                                  href={marketUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-100 hover:bg-violet-500/15"
                                >
                                  {host ? `Open (${host})` : 'Open market'}
                                </a>
                              ) : null}
                            </div>

                            {tradeId ? (
                              <div className="mt-4 text-[11px] text-gray-500 font-mono break-all">
                                Trade: {tradeId}
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    );
                  }),
                )).map((node) => node)}
              </div>

              {spotlight.sections
                .filter((section) => section.title === 'Market Read')
                .map((section) => (
                  <div key={section.title} className="rounded-3xl border border-white/10 bg-white/5 p-8">
                    <p className="text-sm uppercase tracking-[0.2em] text-gray-400">{section.title}</p>
                    <ul className="mt-4 space-y-3 text-gray-200">
                      {section.lines.map((line) => (
                        <li key={line} className="flex items-start gap-3">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-400"></span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

              {spotlight.sections
                .filter((section) => section.title === 'Disclaimer')
                .map((section) => (
                  <div key={section.title} className="text-xs text-gray-500">
                    {section.lines.join(' ')}
                  </div>
                ))}

              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-gray-400">Sources</p>
                  <div className="mt-3 space-y-2 text-sm text-gray-200">
                    <a
                      href="https://polymarket.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-300 hover:text-violet-200 underline underline-offset-4"
                    >
                      Polymarket (markets and prices)
                    </a>
                    <div className="text-xs text-gray-500">
                      Public market metadata and pricing context.
                    </div>
                    <a
                      href="https://clob.polymarket.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-300 hover:text-violet-200 underline underline-offset-4"
                    >
                      Polymarket CLOB API
                    </a>
                    <div className="text-xs text-gray-500">
                      Public order book endpoints used for best-effort verification.
                    </div>
                    {spotlightMarkets.length > 0 ? (
                      <div className="pt-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Market links</div>
                        <div className="mt-2 space-y-2">
                          {spotlightMarkets.slice(0, 3).map((m) => (
                            <a
                              key={m.url}
                              href={m.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-violet-300 hover:text-violet-200 underline underline-offset-4"
                            >
                              {m.url.startsWith('https://polymarket.com/search') ? `Polymarket search: ${m.label}` : m.label}
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-gray-400">Use this signal</p>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Link
                      href="/smart-money"
                      className="rounded-2xl border border-white/10 bg-black/30 p-4 hover:bg-white/5 transition-colors"
                    >
                      <div className="text-sm font-semibold text-white">Smart Money Leaderboard</div>
                      <div className="mt-1 text-xs text-gray-400">Discover top wallets and recent performance.</div>
                    </Link>
                    <Link
                      href="/smart-collections"
                      className="rounded-2xl border border-white/10 bg-black/30 p-4 hover:bg-white/5 transition-colors"
                    >
                      <div className="text-sm font-semibold text-white">Smart Collections</div>
                      <div className="mt-1 text-xs text-gray-400">Subscribe to strategy bundles for higher signal density.</div>
                    </Link>
                    <Link
                      href="/follow"
                      className="rounded-2xl border border-white/10 bg-black/30 p-4 hover:bg-white/5 transition-colors"
                    >
                      <div className="text-sm font-semibold text-white">Set up alerts</div>
                      <div className="mt-1 text-xs text-gray-400">Follow wallets and receive Telegram alerts.</div>
                    </Link>
                    <Link
                      href="/subscribe"
                      className="rounded-2xl border border-violet-500/40 bg-violet-500/10 p-4 hover:bg-violet-500/15 transition-colors"
                    >
                      <div className="text-sm font-semibold text-white">Upgrade</div>
                      <div className="mt-1 text-xs text-gray-400">Unlock higher limits and premium signals.</div>
                    </Link>
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  Methodology: <Link className="text-gray-300 hover:text-white underline underline-offset-4" href="/methodology">how we generate alerts</Link>. Editorial policy: <Link className="text-gray-300 hover:text-white underline underline-offset-4" href="/editorial-policy">how we publish</Link>.
                </div>
              </div>
            </div>
          ) : (
            <div className="prose prose-invert prose-lg max-w-none prose-headings:font-bold prose-headings:text-white prose-a:text-violet-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-white prose-code:text-violet-200 prose-code:bg-violet-900/30 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[#1a1a1a] prose-pre:border prose-pre:border-white/10 prose-blockquote:border-l-violet-500 prose-blockquote:bg-white/5 prose-blockquote:py-2 prose-blockquote:pr-4 prose-li:marker:text-violet-500">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {safePost.content}
              </ReactMarkdown>
            </div>
          )}
        </article>

        {/* Share/CTA Section */}
        <div className="mt-20 pt-10 border-t border-white/10 text-center">
          <h3 className="text-xl font-bold text-white mb-4">Want real-time whale alerts?</h3>
          <p className="text-gray-400 mb-8">Get notified when smart money moves.</p>
          <Link href="/" className="btn-primary px-8 py-3">
            Start Tracking →
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
