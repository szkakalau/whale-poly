import { prisma } from '@/lib/prisma';

const BLOG = {
  slug: 'polymarket-volume-weighted-price-analysis',
  title: 'Polymarket Volume-Weighted Price Analysis: Read the Money, Not the Price',
  excerpt: "Price tells you where the market is. Volume tells you where it's going. SightWhale's new VW Analysis channel measures the divergence between money flow and market price to surface hidden sentiment before it prints.",
  author: 'Whale Team',
  readTime: '6 min',
  tags: ['VW Analysis', 'On-Chain Analysis', 'Data Science', 'Trading Strategy'],
  language: 'en',
  groupSlug: 'polymarket-volume-weighted-analysis',
  content:
    '# Why Price Alone Is a Losing Game\n\n' +
    'Every Polymarket trader looks at the same number: **the price**. But the price is a lagging indicator — it reflects the last trade, not the capital behind it.\n\n' +
    'A market trading at 65¢ looks bullish. But what if $2 million of smart money is quietly accumulating the 35¢ side? The price says one thing. **The money says another.**\n\n' +
    'This gap — between volume-weighted execution and market price — is where alpha lives. SightWhale\'s new **Volume-Weighted Analysis** channel quantifies this gap in real time.\n\n' +
    '---\n\n' +
    '## What Is Volume-Weighted Analysis?\n\n' +
    'Volume-Weighted Price (VW) answers one question: **what price did traders actually pay?**\n\n' +
    'Unlike a simple last-trade price, VW weights every trade by its dollar volume. A $50,000 trade moves the VW more than a $50 trade. This reveals where **informed capital** is positioning — not just where noise traders are clicking.\n\n' +
    'When VW diverges from market price, something interesting is happening.\n\n' +
    '---\n\n' +
    '## The VW Divergence Signal\n\n' +
    '**VW Divergence** = VW_YES share − Market Price_YES\n\n' +
    'A **positive divergence** means large traders are paying more for YES than the market price suggests. Money is betting the price will rise.\n\n' +
    'A **negative divergence** means large traders are paying more for NO. Money is betting the price will fall.\n\n' +
    '| Divergence | Direction | What It Means |\n' +
    '|---|---|---|\n' +
    '| > +10% | Bullish | Smart money accumulating YES above market |\n' +
    '| < −10% | Bearish | Smart money accumulating NO above market |\n' +
    '| −10% to +10% | Neutral | Money flow aligned with price |\n\n' +
    '---\n\n' +
    '## The Underdog Aversion Index (UAI)\n\n' +
    'One of the most persistent inefficiencies in prediction markets is **underdog aversion**: traders systematically undervalue low-probability outcomes.\n\n' +
    '- **UAI > 0.8**: Whales are actively buying the underdog. The market may be overconfident.\n' +
    '- **UAI < 0.3**: Whales are avoiding the underdog entirely.\n' +
    '- **0.3–0.8**: Normal range.\n\n' +
    '---\n\n' +
    '## How to Use SightWhale\'s VW Analysis Page\n\n' +
    'The [Volume Analysis](https://www.sightwhale.com/volume-analysis) page is free for all users:\n\n' +
    '1. **Market Rankings** — Sort by volume, divergence, or signal strength\n' +
    '2. **Signal Badges** — Bullish / Bearish / Neutral labels per market\n' +
    '3. **Trend Charts** — VW vs. Market Price over time in detail drawer\n' +
    '4. **Cross Signals** — VW signals vs. whale trading direction\n' +
    '5. **UAI Tracking** — Spot underdog opportunities\n\n' +
    '---\n\n' +
    '## Frequently Asked Questions\n\n' +
    '### What\'s the difference between VW price and market price?\n\n' +
    'Market price is the last trade. VW price is the dollar-weighted average of all trades. Only sustained large-volume buying moves the VW.\n\n' +
    '### How often does the data update?\n\n' +
    'Every 5 minutes, ingesting live Polymarket trade data.\n\n' +
    '### Is the Volume Analysis page free?\n\n' +
    'Yes — available to all visitors, no account required.\n\n' +
    '### Can VW Analysis predict market resolution?\n\n' +
    'No single indicator predicts resolution perfectly. VW Analysis measures capital flow sentiment — one input in a broader decision process.\n\n' +
    '---\n\n' +
    '**[Start using VW Analysis](https://www.sightwhale.com/volume-analysis)** — trade what the money trades, not what the price says.',
};

export async function GET() {
  try {
    const now = new Date('2026-06-30T00:00:00Z');

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS blog_posts (
        id text PRIMARY KEY,
        slug text NOT NULL,
        title text NOT NULL,
        excerpt text NOT NULL,
        content text NOT NULL,
        author text NOT NULL,
        read_time text NOT NULL,
        cover_image text,
        tags text[] DEFAULT '{}',
        published_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        language text NOT NULL DEFAULT 'en',
        group_slug text,
        status text NOT NULL DEFAULT 'published'
      )`,
    );

    try {
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_language_idx ON blog_posts (slug, language)`,
      );
    } catch {
      // ignore
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO blog_posts (id, slug, title, excerpt, content, author, read_time, tags, published_at, created_at, updated_at, language, group_slug, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (slug, language) DO UPDATE SET
         title=excluded.title, excerpt=excluded.excerpt, content=excluded.content,
         author=excluded.author, read_time=excluded.read_time, tags=excluded.tags,
         updated_at=excluded.updated_at`,
      crypto.randomUUID(),
      BLOG.slug,
      BLOG.title,
      BLOG.excerpt,
      BLOG.content,
      BLOG.author,
      BLOG.readTime,
      BLOG.tags,
      now,
      now,
      now,
      BLOG.language,
      BLOG.groupSlug,
      'published',
    );

    return Response.json({ ok: true, slug: BLOG.slug });
  } catch (e: any) {
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}
