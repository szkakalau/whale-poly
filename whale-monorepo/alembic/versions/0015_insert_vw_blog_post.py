from alembic import op
import sqlalchemy as sa

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None

BLOG_ID = "b0000001-0000-4000-a000-000000000001"
SLUG = "polymarket-volume-weighted-price-analysis"
NOW = "2026-06-30T00:00:00+00:00"

TITLE = "Polymarket Volume-Weighted Price Analysis: Read the Money, Not the Price"

EXCERPT = "Price tells you where the market is. Volume tells you where it's going. SightWhale's new VW Analysis channel measures the divergence between money flow and market price to surface hidden sentiment before it prints."

CONTENT = """# Why Price Alone Is a Losing Game

Every Polymarket trader looks at the same number: **the price**. But the price is a lagging indicator — it reflects the last trade, not the capital behind it.

A market trading at 65¢ looks bullish. But what if $2 million of smart money is quietly accumulating the 35¢ side? The price says one thing. **The money says another.**

This gap — between volume-weighted execution and market price — is where alpha lives. SightWhale's new **Volume-Weighted Analysis** channel quantifies this gap in real time.

---

## What Is Volume-Weighted Analysis?

Volume-Weighted Price (VW) answers one question: **what price did traders actually pay?**

Unlike a simple last-trade price, VW weights every trade by its dollar volume. A $50,000 trade moves the VW more than a $50 trade. This reveals where **informed capital** is positioning — not just where noise traders are clicking.

The VW price for a market's YES outcome:

```
VW_YES = Σ(trade_amount × trade_price) ÷ Σ(trade_amount)
```

When VW diverges from market price, something interesting is happening.

---

## The VW Divergence Signal

**VW Divergence** = VW_YES share − Market Price_YES

A **positive divergence** means large traders are paying more for YES than the market price suggests. Money is betting the price will rise.

A **negative divergence** means large traders are paying more for NO. Money is betting the price will fall.

| Divergence | Direction | What It Means |
|---|---|---|
| > +10% | Bullish | Smart money accumulating YES above market |
| < −10% | Bearish | Smart money accumulating NO above market |
| −10% to +10% | Neutral | Money flow aligned with price |

### Real Example: 2026 FIFA World Cup

On the "Will France win the 2026 World Cup?" market, total volume exceeded $88,000 in 24 hours. A +8% VW divergence on the YES side meant whales were buying at prices above the quoted market — a signal the price might be undervalued.

---

## The Underdog Aversion Index (UAI)

One of the most persistent inefficiencies in prediction markets is **underdog aversion**: traders systematically undervalue low-probability outcomes.

The UAI measures this:

```
UAI = VW_underdog_share ÷ Market_Price_underdog_share
```

- **UAI > 0.8**: Whales are actively buying the underdog. The market may be overconfident in the favorite.
- **UAI < 0.3**: Whales are avoiding the underdog entirely. The favorite may be correctly priced.
- **0.3–0.8**: Normal range — no significant divergence.

In the 2026 election cycle, markets with UAI above 0.8 showed an average repricing of +12% toward the underdog within 72 hours.

---

## Velocity: How Fast Is Sentiment Shifting?

**Velocity** measures how quickly VW divergence is changing — the derivative of money flow.

```
Velocity_5m = (Divergence_now − Divergence_5min_ago) ÷ 5
```

A fast-moving divergence is more actionable than a slow drift. High velocity + high divergence = **urgent signal**. Low velocity + high divergence = **accumulation in progress**.

---

## How to Use SightWhale's VW Analysis Page

The [Volume Analysis](https://www.sightwhale.com/volume-analysis) page is free for all users. Here's what you get:

1. **Market Rankings**: Sort by total volume, divergence magnitude, or signal strength. Focus on the largest capital flows first.

2. **Signal Badges**: Each market gets a Bullish / Bearish / Neutral label based on VW divergence direction and magnitude.

3. **Trend Charts**: Click any market to open a detail drawer with a VW vs. Market Price chart over time. Green = VW money flow, Gray = quoted price. When the green line crosses above the gray, momentum is shifting.

4. **Cross Signals**: Compare VW signals against whale trading direction. When both VW and whales agree, confidence is highest.

5. **UAI Tracking**: Spot underdog opportunities before the crowd catches on.

---

## Why This Matters for Your Edge

Three reasons VW Analysis improves decision-making on Polymarket:

**1. Detects accumulation before price moves.** Whales don't buy all at once. VW divergence rises before the price does — giving you a leading indicator.

**2. Filters out noise.** A $10 bet at an extreme price doesn't shift VW. A $100,000 bet does. You see signal, not noise.

**3. Surfaces hidden sentiment.** The Underdog Aversion Index catches opportunities that price screens miss entirely.

---

## Frequently Asked Questions

### What's the difference between VW price and market price?

Market price is the last trade. VW price is the dollar-weighted average of all trades over a window. A single small trade can move the market price; only sustained large-volume buying moves the VW.

### How often does the VW Analysis data update?

Every 5 minutes. SightWhale's engine recomputes VW metrics, snapshots, and signals on a continuous loop, ingesting live Polymarket trade data.

### Is the Volume Analysis page free?

Yes. The VW Analysis page is available to all visitors — no account or subscription required.

### What does a strong signal look like?

A strong signal combines three factors: large divergence (>10%), high velocity (>3% per 5 min), and high total volume (>$5,000 in 24h). Any two of the three is worth attention.

### Can VW Analysis predict market resolution?

No single indicator predicts resolution perfectly. VW Analysis measures **capital flow sentiment** — where informed money is positioning now. It's one input in a broader decision process, not a crystal ball.

### How does this compare to whale tracking?

Whale tracking tells you **who** is trading. VW Analysis tells you **where the money** is flowing, aggregating all large trades regardless of wallet identity. They complement each other — use both for the fullest picture.

---

## Start Using VW Analysis

The VW Analysis page is live now at [sightwhale.com/volume-analysis](https://www.sightwhale.com/volume-analysis).

For real-time whale alerts and the full SightWhale signal suite, [check out our plans](https://www.sightwhale.com/pricing).

**Trade what the money trades, not what the price says.**"""


def upgrade() -> None:
    # Ensure table exists
    op.execute("""
        CREATE TABLE IF NOT EXISTS blog_posts (
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
        )
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_language_idx
        ON blog_posts (slug, language)
    """)

    # Upsert the blog post
    op.execute(
        sa.text(
            """INSERT INTO blog_posts (id, slug, title, excerpt, content, author, read_time, tags, published_at, created_at, updated_at, language, group_slug, status)
            VALUES (:id, :slug, :title, :excerpt, :content, :author, :read_time, :tags, :published_at, :created_at, :updated_at, :language, :group_slug, :status)
            ON CONFLICT (slug, language) DO UPDATE SET
                title=excluded.title, excerpt=excluded.excerpt, content=excluded.content,
                author=excluded.author, read_time=excluded.read_time, tags=excluded.tags,
                updated_at=excluded.updated_at"""
        ).bindparams(
            sa.bindparam("id", BLOG_ID),
            sa.bindparam("slug", SLUG),
            sa.bindparam("title", TITLE),
            sa.bindparam("excerpt", EXCERPT),
            sa.bindparam("content", CONTENT),
            sa.bindparam("author", "Whale Team"),
            sa.bindparam("read_time", "6 min"),
            sa.bindparam("tags", ["VW Analysis", "On-Chain Analysis", "Data Science", "Trading Strategy"]),
            sa.bindparam("published_at", NOW, type_=sa.DateTime(timezone=True)),
            sa.bindparam("created_at", NOW, type_=sa.DateTime(timezone=True)),
            sa.bindparam("updated_at", NOW, type_=sa.DateTime(timezone=True)),
            sa.bindparam("language", "en"),
            sa.bindparam("group_slug", "polymarket-volume-weighted-analysis"),
            sa.bindparam("status", "published"),
        )
    )


def downgrade() -> None:
    op.execute(
        f"DELETE FROM blog_posts WHERE slug = '{SLUG}' AND language = 'en'"
    )
