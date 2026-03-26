## How to Design a Whale Ranking System for Polymarket

## TL;DR

👉 Want real-time whale signals?  
On SightWhale, we provide:
- Real-time whale tracking
- Smart Money scoring
- High win-rate trade alerts
👉 https://www.sightwhale.com

---

## 1. Overview of short-term trading strategies

Short-term trading in prediction markets is less about long-horizon forecasting and more about **timing**, **execution**, and **information flow**. In Polymarket, the traders that look like “Whales” by size are not always the traders worth following. A good Whale ranking system separates:

- **Whale**: “can move markets” (size, persistence, footprint)
- **Smart Money**: “tends to be right” (repeatable edge, credibility)
- **Short-term skill**: “times entries well” in the presence of liquidity and volatility constraints

If you rank Whales purely by notional, you build a leaderboard of attention—not a leaderboard of alpha. The goal is to produce a ranking that answers: **Which Polymarket Whales are most worth watching right now, for short-term signals?**

---

## 2. Core components (timing, liquidity, volatility)

An effective Whale ranking model has three pillars plus one filter.

### 2.1 Timing (entry quality)
Timing should reward Whales who enter *before* repricing and avoid chasing:
- entry price vs subsequent VWAP (next 10m / 1h windows)
- time-to-acceptance (does price hold after the entry?)
- “first mover” behavior (entering early in the catalyst window)

### 2.2 Liquidity (tradability)
A Whale can be “right” but still be unhelpful if followers can’t replicate entries:
- spread at entry
- liquidity depth proxy (or trade impact proxy if depth is unavailable)
- estimated slippage for a standard follower size (e.g., $250 / $1,000 / $5,000)

Ranking should penalize Whales whose trades consistently occur in thin markets where replication is unrealistic.

### 2.3 Volatility (regime awareness)
Short-term markets behave differently under high vs low volatility:
- volatility bursts increase noise and fakeouts
- stable regimes reward persistence and acceptance

Include regime features so the system can answer: “Is this Whale strong *in this market regime*?”

### 2.4 Smart Money filter (credibility gating)
Whale ranking should not replace Smart Money scoring; it should incorporate it:
- credibility gating (enough resolved sample)
- recency-weighted performance
- anti-gaming flags (churn, pump-and-fade signatures)

In practice: Whale ranking = “who matters now,” Smart Money = “who tends to be right.”

---

## 3. How short-term trading works in Polymarket

Short-term trading on Polymarket often follows a microstructure loop:

1. A Whale initiates (or starts scaling) into YES/NO.
2. Liquidity reacts (spread and depth change).
3. Price either **accepts** (holds and grinds) or **fades** (reverts).
4. Other Smart Money entities may confirm or contradict.

A Whale ranking system should be updated at short horizons (minutes to hours), not just daily:
- “Top Whales in the last 1h” for actionable monitoring
- “Top Whales in the last 24h” for context
- “Top Smart Money Whales (30d)” for credibility baseline

The output should be a leaderboard that supports real-time alerts:
- “This Whale is top-ranked now because timing + liquidity + acceptance are strong.”

---

## 4. Practical example

### Example: Ranking two Whales in the same market

**Market**: “Will X happen by date Y?” (Polymarket)

**Whale A**
- Notional: high
- Entry: late (after price already moved)
- Liquidity: thin (wide spreads)
- Post-entry: price fades

**Whale B**
- Notional: medium
- Entry: early (before repricing)
- Liquidity: tradable (spread tightens after entry)
- Post-entry: price accepts and trends

A notional-only leaderboard ranks A above B.  
A short-term Whale ranking system ranks B above A because it better predicts *replicable*, short-term opportunity.

### A practical ranking formula (interpretable baseline)

Compute a **Whale Rank Score** (0–100) per entity, per time window:

- **Impact score (0–25)**: size + persistence, capped to avoid domination by one huge trade
- **Timing score (0–30)**: entry quality vs subsequent VWAP + acceptance speed
- **Liquidity score (0–25)**: spread + estimated slippage for follower sizes
- **Volatility adjustment (−10 to +10)**: regime alignment (reduces noise)
- **Smart Money multiplier (0.5–1.2)**: credibility-weighted (high Smart Money boosts rank)

Then produce leaderboards:
- global top Whales (1h, 24h)
- per-category top Whales (politics, macro, sports)
- “Smart Money Whales” top list (requires credibility threshold)

---

## 5. Tools recommendation

### Data and computation
- **PostgreSQL**: entity profiles, resolved outcomes, score snapshots
- **ClickHouse**: high-volume trade and microstructure time series
- **Redis**: real-time rolling windows (1m/5m/1h aggregates), caching rank outputs

### Scoring and ranking pipeline
- Python: `pandas`, `numpy` for feature computation
- Optional: ranking model (learning-to-rank) once baseline is stable

### Product surfaces
- **Leaderboard pages** (SEO): “Top Polymarket Whales Today”, “Top Smart Money Whales”
- **Entity pages**: rank history + win rate + ROI + behavior fingerprint
- **Alerts**: “Top-ranked Whale entered” notifications with context

---

## 6. Risks and limitations

### Survivorship and small-sample bias
New entities can look “genius” on 1–2 trades. Use credibility gating:
- minimum resolved trades
- recency weighting
- confidence intervals or uncertainty bands

### Manipulation and signaling games
Whales may try to farm attention by trading in ways that create visible impact. Mitigate via:
- acceptance vs fade features
- anti-churn penalties
- cross-market consistency checks

### Execution mismatch
If followers can’t replicate entries due to liquidity, the ranking becomes entertainment. Liquidity and slippage penalties are essential.

### Category drift
A Whale strong in politics may be weak in sports. Use category-aware rankings or features.

---

## 7. Advanced insights

### 7.1 Separate “who is big” from “who is useful”
Maintain two leaderboards:
- **Biggest Whales** (size-only, informational)
- **Best Whales to Watch** (rank score optimized for short-term tradability)

This prevents confusion and improves user trust.

### 7.2 Multi-horizon ranking
Compute ranks for:
- 15m / 1h (action)
- 24h (context)
- 30d (credibility baseline)

Users can then filter by their holding horizon.

### 7.3 Confluence as a rank booster
When multiple high-ranked Whales align in the same direction, boost the story score:
- “Whale confluence” is often more reliable than any single Whale
- but apply strict pacing controls to avoid alert overload

### 7.4 Make ranking auditable
For each Whale rank, show the breakdown:
- timing contribution
- liquidity contribution
- volatility adjustment
- Smart Money multiplier

Auditability matters for credibility and is also strong SEO content.

---

## Live Whale Data (Powered by SightWhale)
- Example whale position
- Win rate
- ROI

### Example

- **Example whale position**
  - Wallet/entity: `0xABCD…1234`
  - Polymarket market: “Will X happen by date Y?”
  - Whale event (1h): net +$42,500 YES
  - Avg entry: 0.61
  - Current price: 0.64

- **Win rate**
  - Last 100 resolved trades win rate: 72%
  - Last 30 days win rate: 68%

- **ROI**
  - Last 100 resolved trades ROI: +16.4%
  - Last 30 days ROI: +9.1%

---

## FAQ

### What is a “Whale” on Polymarket?
A Polymarket Whale is an entity whose trades or position changes are large enough to move market prices/liquidity, or who consistently deploys large size across markets.

### How is Whale ranking different from Smart Money scoring?
Whale ranking answers “who matters right now” (short-term impact + tradability). Smart Money scoring answers “who tends to be right” (repeatable edge + credibility). The best systems use both.

### What should be the #1 feature in a short-term Whale ranking system?
Timing plus acceptance: reward entities whose entries are followed by sustained price acceptance, not immediate fades—while penalizing thin-liquidity, unreplicable trades.

### How often should ranks update?
For short-term use cases, update at least every few minutes for 15m/1h windows, and publish slower “credibility baselines” daily.
