---
title: "Liquidity Regimes: Detecting When a Market Turns ‘Tradable’ (Before the Crowd)"
date: "2026-03-11"
excerpt: "A Polymarket market can flip from untradable to efficient in hours—spread compresses, depth refills, and whales suddenly matter. This post builds a practical tradability score from spread, depth, and cancellation pressure, with a reproducible way to compute it using public order book endpoints."
author: "Whale Team"
readTime: "12 min"
tags: ["Analysis", "Research", "Liquidity Regime", "Market Depth", "Spread Compression", "Polymarket", "Trading Strategy", "CLOB"]
---

# Liquidity Regimes: Detecting When a Market Turns ‘Tradable’ (Before the Crowd)

Most “bad trades” on Polymarket aren’t bad because you misread the event.
They’re bad because you traded a market that wasn’t a market yet.

The same contract can behave like:

- a thin, jumpy instrument where every trade moves price
- or a deep book where size clears cleanly and signals are copyable

That flip is a **liquidity regime change**.

If you can detect it early, you get two edges:

1) execution costs drop before retail notices  
2) whale flow becomes interpretable instead of noisy

Internal links:
- See how we treat execution as alpha: [/smart-money](/smart-money)
- Test thresholds by liquidity bucket: [/backtesting](/backtesting)
- Get alerts only when markets are tradable: [/subscribe](/subscribe)

---

## 1) What “Tradable” Means (Operational Definition)

“Tradable” is not a vibe. It’s a set of conditions:

- spread is narrow enough that crossing doesn’t kill your EV
- depth at the top levels is sufficient for your size
- the book refills (liquidity is real, not a screenshot)
- price reacts to informed trades, not to random noise

In other words: **execution is stable**.

---

## 2) The Tradability Score (Simple, Useful, Auditable)

We’ll build a 0–100 score from three components:

1) **Spread score** (tightness)
2) **Depth score** (impact)
3) **Stability score** (refill vs cancellation pressure)

### A) Spread score

Polymarket’s CLOB API exposes a public spread endpoint (token-level).  
External source (CLOB endpoints list): https://docs.polymarket.com/quickstart/reference/endpoints

Let `spread` be best ask minus best bid (in probability units).

Define a normalized spread score:

```
spread_score = clamp(1 - spread / spread_target, 0, 1)
```

Where:
- `spread_target` can be 0.005 (0.5¢) for liquid markets, or 0.01 (1¢) for general use.

### B) Depth score

Pull the order book and compute how far the book moves if you trade a fixed notional (e.g., $2k).

If you can buy $2k with <0.5¢ impact, depth is good.
If the first $200 moves you 2¢, depth is not a market—yet.

### C) Stability score (cancellation pressure proxy)

You won’t get perfect cancel-rate data from one snapshot.
But you can estimate stability with repeated snapshots:

- sample the book every 10 seconds for 10 minutes
- compute how often top-of-book liquidity disappears vs refills

Proxy:

```
stability = 1 - (mean_abs_change(top_depth) / mean(top_depth))
```

Then clamp to [0, 1].

---

## 3) Reproducible Data Pull (Gamma + CLOB)

You need token IDs, then the book.

Polymarket documents that:
- Gamma API is public (market metadata, token IDs)
- CLOB API has public endpoints for book/midpoint/spread  
External source: https://docs.polymarket.com/quickstart/reference/endpoints

Fetch a market by slug (Gamma):

```bash
curl "https://gamma-api.polymarket.com/markets?slug=YOUR_MARKET_SLUG"
```

Then pull book/spread (CLOB):

```bash
curl "https://clob.polymarket.com/book?token_id=YOUR_TOKEN_ID"
curl "https://clob.polymarket.com/spread?token_id=YOUR_TOKEN_ID"
curl "https://clob.polymarket.com/midpoint?token_id=YOUR_TOKEN_ID"
```

---

## 4) A Minimal Script to Compute the Score

This script:
- samples the book repeatedly
- computes spread, $2k impact, and a stability proxy
- produces a 0–100 tradability score

```python
import json
import time
import urllib.request
from statistics import mean

TOKEN_ID = "YOUR_TOKEN_ID"
NOTIONAL_USD = 2000
SAMPLES = 60          # 10 minutes at 10s interval
INTERVAL_SECONDS = 10

def get_json(url: str):
  with urllib.request.urlopen(url) as r:
    return json.loads(r.read().decode("utf-8"))

def snapshot():
  book = get_json(f"https://clob.polymarket.com/book?token_id={TOKEN_ID}")
  spread = get_json(f"https://clob.polymarket.com/spread?token_id={TOKEN_ID}")
  mid = get_json(f"https://clob.polymarket.com/midpoint?token_id={TOKEN_ID}")
  return book, float(spread["spread"]), float(mid["midpoint"])

def vwap_for_notional(asks, notional_usd):
  remaining = notional_usd
  paid = 0.0
  shares = 0.0
  for level in asks:
    p = float(level["price"])
    s = float(level["size"])
    level_notional = p * s
    take = min(remaining, level_notional)
    paid += take
    shares += take / p
    remaining -= take
    if remaining <= 1e-9:
      break
  if remaining > 0:
    return None
  return paid / shares

spreads = []
top_depth = []
impacts = []

for _ in range(SAMPLES):
  book, spread, mid = snapshot()
  asks = book["asks"]
  best_ask = float(asks[0]["price"]) if asks else None
  vwap = vwap_for_notional(asks, NOTIONAL_USD) if asks else None
  if best_ask is not None and vwap is not None and mid > 0:
    impacts.append((vwap - mid))  # in probability units
  spreads.append(spread)
  depth = 0.0
  for level in asks[:5]:
    depth += float(level["price"]) * float(level["size"])
  top_depth.append(depth)
  time.sleep(INTERVAL_SECONDS)

spread_target = 0.01
spread_score = max(0.0, min(1.0, 1 - mean(spreads) / spread_target))

impact_target = 0.005
avg_impact = mean([x for x in impacts if x is not None]) if impacts else 1.0
depth_score = max(0.0, min(1.0, 1 - (avg_impact / impact_target)))

avg_depth = mean(top_depth) if top_depth else 0.0
abs_changes = [abs(top_depth[i] - top_depth[i-1]) for i in range(1, len(top_depth))]
stability_proxy = 0.0
if avg_depth > 0 and abs_changes:
  stability_proxy = 1 - (mean(abs_changes) / avg_depth)
stability_score = max(0.0, min(1.0, stability_proxy))

score = 100 * (0.45 * spread_score + 0.35 * depth_score + 0.20 * stability_score)
print({
  "spread": mean(spreads),
  "avg_impact": avg_impact,
  "top5_notional": avg_depth,
  "spread_score": spread_score,
  "depth_score": depth_score,
  "stability_score": stability_score,
  "tradability_score": score
})
```

This is intentionally plain:
no SDK, no auth, no magic.

---

## 5) Why the Same Market Is Not the Same Asset All Day

Liquidity regimes often follow a predictable rhythm:

- **pre-news**: spoofier book, wider spreads, low refill
- **post-news**: spreads compress, makers step in, depth rebuilds
- **late hours**: spreads widen again, impact rises

If your alerts ignore this, you get a false impression:

“Whales stopped being smart.”

No—your market stopped being tradable.

---

## 6) How to Use This in Trading and Alerts

Two concrete policies:

### Policy A — Only act above a tradability threshold

For example:
- act when score ≥ 70
- watchlist when 50–70
- ignore below 50

### Policy B — Calibrate whale alerts by regime

In thin regimes, require:
- higher trade size
- higher wallet quality
- longer confirmation (multiple signals)

This is exactly where backtesting matters:
- [/backtesting](/backtesting)

---

## 7) How SightWhale Applies It

When we say “copyable,” we mean:
- the market can actually absorb the trade
- execution is repeatable
- and the signal is not just noise amplified by illiquidity

Use:
- [/smart-money](/smart-money)
- [/subscribe](/subscribe)

---

## Sources (External)

- Polymarket API endpoints overview (Gamma/CLOB/Data): https://docs.polymarket.com/quickstart/reference/endpoints
