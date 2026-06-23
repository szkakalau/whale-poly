# Blog Channel Design — SightWhale

**Date**: 2026-06-23  
**Status**: Approved  
**Author**: Claude (with user direction)

---

## 1. Problem & Goals

SightWhale currently has 138 markdown blog posts in `services/landing/src/content/posts/` that are **completely invisible** — all `/blog` routes redirect to `/`, there is no rendering code, and the posts are not indexed. The platform needs a content channel to:

1. **SEO/GEO**: Drive organic search traffic and LLM-indexed discovery (Google, Bing, ChatGPT, Perplexity)
2. **User value**: Provide genuinely useful deep-dive articles on Polymarket and whale trading
3. **Automation**: Publish one in-depth article daily with zero manual effort

## 2. Approach Decision

**Chosen: Database-driven + ISR (Incremental Static Regeneration)**

Articles stored in PostgreSQL `blog_posts` table, rendered by Next.js App Router with ISR (`revalidate: 86400`). A Celery Beat task generates one bilingual (EN + ZH) article per day via DeepSeek V4 Pro LLM.

**Why not SSG (markdown files + git commit)?**
- Daily auto-publish requires git commit + redeploy — fragile automation
- Bilingual posts double file count
- 138 existing posts already in this pattern and completely disconnected

**Why not Headless CMS?**
- External dependency and cost
- Overkill for a single automated daily article

## 3. Architecture

```
Celery Beat (20:00 BJT)
    │
    ▼
blog_generator.py
    │ 1. query 24h whale trades, hot markets, top performers
    │ 2. pick topic (6 rotating types)
    │ 3. call DeepSeek V4 Pro → EN article (1500-2500w)
    │ 4. call DeepSeek V4 Pro → ZH article (localized, not direct translation)
    │ 5. validate quality (word count, data points, AI phrase check)
    │ 6. INSERT into blog_posts (status='published')
    │
    ▼
PostgreSQL blog_posts table
    │
    ▼
Next.js /blog (ISR, revalidate 86400s)
    ├── /blog                          → listing page (paginated, 12/page)
    ├── /blog/[language]               → language-filtered listing
    ├── /blog/[language]/[slug]        → article detail (prose-rendered markdown)
    └── /blog/feed.xml                → RSS feed (last 20 posts)
```

## 4. Database Schema

### Existing columns (already in `blog_posts` table)

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | UUID |
| `slug` | text | unique per article, e.g. `whale-strategy-101` |
| `title` | text | |
| `excerpt` | text | SEO meta description |
| `content` | text | Markdown body |
| `author` | text | "SightWhale" |
| `read_time` | text | "8 min" |
| `cover_image` | text | nullable, default null (use CSS gradient fallback) |
| `tags` | text[] | e.g. `{whale-trading,polymarket,strategy}` |
| `published_at` | timestamptz | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### New columns (migration)

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `language` | text | `'en'` | `'en'` or `'zh'` |
| `group_slug` | text | nullable | Shared key linking EN+ZH versions of the same article |
| `status` | text | `'published'` | `'published'` or `'draft'` |
| `generation_prompt` | text | nullable | Audit trail — the prompt used to generate the article |

### Uniqueness

Change from `slug UNIQUE` to `(slug, language) UNIQUE`. Two articles in different languages share the same `group_slug` but have different `slug` values (e.g., `whale-strategy-101-en` vs `whale-strategy-101-zh`).

### Migration approach

Since `blog_posts` is created by raw SQL (not Alembic), the `_ensure_blog_posts_table` function is enhanced to use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for each new column. This is idempotent and safe for both fresh deployments and existing databases that already have the old schema.

## 5. Backend: Blog Generator

**New file**: `services/trade_ingest/blog_generator.py`

### 5.1 Data Fetching (`fetch_context`)

Queries the last 24 hours from existing Postgres tables:

- **Top 5 whale trades**: `TradeRaw` joined with `WhaleStats`, ordered by `amount * price DESC`
- **3 most active markets**: `TradeRaw` grouped by `market_id`, count + volume
- **Best performing whales**: `WhaleStats` ordered by `realized_pnl DESC` or `win_rate DESC`, limit 3
- **Trending topics**: Cluster market titles, extract keywords

### 5.2 Topic Selection (`pick_topic`)

Six article types, rotated to avoid 3 consecutive repeats:

1. **Whale Behavior Analysis** — Analyze patterns in recent whale moves
2. **Strategy Tutorial** — How-to on a prediction market technique
3. **Market Deep Dive** — In-depth analysis of a hot Polymarket market
4. **Methodology/Framework** — Conceptual frameworks for thinking about prediction markets
5. **Data Insights Report** — Numbers-driven report from SightWhale data
6. **Tools & Tips** — Practical tips for using Polymarket or SightWhale

### 5.3 LLM Generation (`generate_article`)

**API**: DeepSeek V4 Pro via OpenAI-compatible SDK  
**Base URL**: `https://api.deepseek.com/v1`  
**Model**: `deepseek-chat`

**System prompt**: Structured for SEO writing expertise — SightWhale brand voice, Polymarket domain knowledge, anti-AI-detection rules from `scripts/BLOG_GENERATION_RULES.md`.

**Input context**: Real on-chain data JSON (trades, markets, whale stats).

**Two-pass generation**:
1. Generate English article (1500-2500 words, markdown)
2. Generate Chinese version — localized adaptation, NOT direct translation. Must feel native to Chinese readers.

**Output**: Structured JSON with `{title, excerpt, content_md, tags, read_time, language}` for each language.

### 5.4 Quality Validation (`validate`)

- Word count ≥ 1500 per language
- At least 3 concrete data points/numbers
- No banned AI-sounding phrases (from `BLOG_GENERATION_RULES.md`)
- On failure: retry once with adjusted prompt

### 5.5 Configuration

New env vars in `shared/config.py`:

| Variable | Default | Notes |
|----------|---------|-------|
| `BLOG_LLM_API_KEY` | — | DeepSeek API key (required) |
| `BLOG_LLM_BASE_URL` | `https://api.deepseek.com/v1` | OpenAI-compatible endpoint |
| `BLOG_LLM_MODEL` | `deepseek-chat` | |
| `BLOG_DAILY_ENABLED` | `true` | Feature flag to disable generation |

### 5.6 Celery Task

Replace existing `daily-spotlight` task (line 50 in worker.py) with `generate-daily-article`, same schedule: `crontab(hour=20, minute=0)` Beijing time.

The existing `daily-spotlight` Telegram alert message (the "Alpha Spotlight" summary) is **preserved** — it still sends the short Telegram digest. The new task adds the blog article generation on top.

## 6. Frontend: Next.js Pages

### 6.1 Route Structure

```
src/app/blog/
├── layout.tsx                    # Shared layout (breadcrumb container)
├── page.tsx                      # /blog — main listing (detects Accept-Language)
├── [language]/
│   ├── page.tsx                  # /blog/en — language-filtered listing
│   └── [slug]/
│       └── page.tsx              # /blog/en/whale-strategy-101 — article detail
└── feed.xml/
    └── route.tsx                 # RSS feed endpoint
```

### 6.2 Listing Page (`/blog`)

- **Language detection**: Read `Accept-Language` header → default to `en`, show `EN | 中文` toggle
- **Card grid**: 3 cols desktop / 2 cols tablet / 1 col mobile
- **Card content**: Tags → Title → Excerpt (2-line clamp) → Date + Read time
- **Pagination**: 12 articles/page, `?page=2` query param
- **Tag filter**: Clickable tag chips at top, filter by tag
- **Data fetching**: `SELECT * FROM blog_posts WHERE status='published' AND language=$lang ORDER BY published_at DESC OFFSET $n LIMIT 12`

### 6.3 Article Detail (`/blog/[language]/[slug]`)

- **Rendering**: `react-markdown` + `remark-gfm` + Tailwind `prose` class
- **Top matter**: Tags → Title → Author + Date + Read time
- **hreflang**: `<link rel="alternate" hreflang="en/zh">` pointing to sibling article via `group_slug`
- **Related articles**: 3 articles sharing at least 1 tag, same language
- **Breadcrumb**: Home > Blog > Article Title
- **ISR**: Detail pages `revalidate: 86400` (24h). Listing pages `revalidate: 3600` (1h) — new articles publish daily but the listing should reflect new posts without a full day delay.

### 6.4 Metadata & Structured Data

Every article page exports dynamic metadata and JSON-LD:

- `title`: `{article.title} · SightWhale Blog`
- `description`: `{article.excerpt}`
- `alternates.canonical`: `/blog/{lang}/{slug}`
- `alternates.languages`: `{ en: '...', zh: '...' }`
- `openGraph.type`: `article`
- `openGraph.publishedTime`: `{article.published_at}`
- JSON-LD: `@type: Article` + `BreadcrumbList`

### 6.5 RSS Feed (`/blog/feed.xml`)

Standard RSS 2.0 XML. Last 20 published articles. Both languages, or separate feeds per language? **Decision**: single feed with both languages, `xml:lang` attribute per `<item>`.

### 6.6 Sitemap Enhancement

Modify `src/app/sitemap.ts` to dynamically include all `published` blog posts:

```typescript
// Current: 9 static routes
// New: static routes + dynamic blog post routes from DB
const posts = await db.query(`
  SELECT slug, language, updated_at FROM blog_posts
  WHERE status = 'published'
`)
```

### 6.7 Navigation

Add "Blog" link to `Header.tsx`, positioned between "History" and "Pricing".

### 6.8 Route Config

Remove from `next.config.ts`:
```typescript
{ source: "/blog", destination: "/" },
{ source: "/blog/:path*", destination: "/" },
```

## 7. Migration: 138 Existing Posts

**One-time script**: `scripts/migrate_blog_posts.py`

For each of the 138 markdown files in `src/content/posts/`:

1. Parse frontmatter with `gray-matter`
2. Call DeepSeek to score quality (1-10) on 4 dimensions: SEO title quality, content depth, data density, timeliness
3. Score ≥ 6: INSERT into `blog_posts` with `language='en'`, `status='published'`
4. Score ≥ 8: ALSO auto-translate to Chinese via DeepSeek, INSERT ZH version
5. Score < 6: Move file to `src/content/posts/_rejected/` (keep for reference)
6. Print summary: "Imported X, rejected Y, translated Z"

After migration: delete `src/content/posts/` directory. Keep `gray-matter` in package.json — small dependency, harmless, may be useful for future manual content imports.

## 8. File Change Summary

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `shared/config.py` | Edit | Add `BLOG_LLM_*` env vars |
| 2 | `services/trade_ingest/blog_generator.py` | **New** | LLM article generation logic |
| 3 | `services/trade_ingest/worker.py` | Edit | Replace `daily-spotlight` with `generate-daily-article`; enhance `_ensure_blog_posts_table` |
| 4 | `services/landing/src/lib/blog.ts` | **New** | DB query helpers, post formatting |
| 5 | `services/landing/src/app/blog/layout.tsx` | **New** | Blog shared layout |
| 6 | `services/landing/src/app/blog/page.tsx` | **New** | Blog listing |
| 7 | `services/landing/src/app/blog/[language]/page.tsx` | **New** | Language-filtered listing |
| 8 | `services/landing/src/app/blog/[language]/[slug]/page.tsx` | **New** | Article detail |
| 9 | `services/landing/src/app/blog/feed.xml/route.tsx` | **New** | RSS feed |
| 10 | `services/landing/src/app/sitemap.ts` | Edit | Include blog posts dynamically |
| 11 | `services/landing/src/components/Header.tsx` | Edit | Add Blog nav link |
| 12 | `services/landing/next.config.ts` | Edit | Remove blog redirects |
| 13 | `scripts/migrate_blog_posts.py` | **New** | One-time migration of 138 existing posts |

## 9. Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| LLM generates low-quality/incorrect content | Quality validation gate + single retry. Fails → skip day, log error, no bad content published |
| DeepSeek API outage | Task catches exception, logs error, retries next day. No crash. |
| Duplicate topics or repetitive content | Topic rotation with 3-day no-repeat rule + randomized angle selection |
| Old posts with SEO value lost in migration | _rejected directory kept as backup; scoring threshold can be adjusted |
| ISR cache serving stale content | 24h revalidate matches daily publish cadence; on-demand revalidation via `/api/revalidate` if needed |
