---
title: "Cross-Market Price Discovery: Which Market Leads, Which Follows, and Why"
date: "2026-03-11"
excerpt: "In correlated Polymarket markets, not all prices are equal. Some markets lead price discovery; others follow with a delay. This post lays out a practical lead–lag workflow (cross-correlation plus a simplified causality check) you can reproduce using public price endpoints—then shows how to turn “leader flow” into actionable trades."
author: "Whale Team"
readTime: "12 min"
tags: ["Analysis", "Research", "Price Discovery", "Lead Lag", "Correlated Markets", "Order Flow", "Polymarket", "CLOB"]
---

# Cross-Market Price Discovery: Which Market Leads, Which Follows, and Why

Polymarket markets are often correlated by design:

- one market is a clean proxy for a macro belief
- another is a narrower version of the same belief
- a third is a time-windowed version

In theory, they should move together.

In practice, they don’t move *together*.
They move in sequence:

- **leader**: absorbs information first
- **follower**: updates later, often in jumps

If you can measure that lead–lag relationship, you stop watching the wrong chart—and you stop treating whale flow as random.

Internal links:
- Smart money context: [/smart-money](/smart-money)
- Wallet drilldown: [/whales/0x94f199fb7789f1aef7fff6b758d6b375100f4c7a](/whales/0x94f199fb7789f1aef7fff6b758d6b375100f4c7a)
- Backtesting framework: [/backtesting](/backtesting)

---

## 1) Why Lead–Lag Exists on Polymarket

Lead–lag is microstructure, not mysticism.

Two markets can encode a similar belief but differ on:

- spread and depth (execution cost)
- participant mix (hedgers vs narrative traders)
- resolution clarity (wording and sources)
- time-to-close (urgency changes who trades and when)

The “leader” is usually the market that is:

- easiest to trade (tight spread, real depth)
- fastest to update (book refills; less spoofing)

The follower is often the market with:

- worse liquidity or higher resolution friction
- a more retail-heavy flow

If you want to go deeper on regime shifts, read:
- [/blog/liquidity-regimes-detecting-when-market-turns-tradable-before-crowd](/blog/liquidity-regimes-detecting-when-market-turns-tradable-before-crowd)

---

## 2) What You Need (Public Data Only)

Polymarket documents three public API families:

- **Gamma API** for market metadata (discovery, token IDs)
- **CLOB API** for order books and pricing endpoints
- **Data API** for positions/trades  
External source: https://docs.polymarket.com/quickstart/reference/endpoints

For lead–lag, you only need:

1) two token IDs (one per market/outcome)
2) a price history series per token

Token IDs are discoverable from Gamma market objects.  
External source: https://docs.polymarket.com/developers/gamma-markets-api/get-markets

---

## 3) The Lead–Lag Workflow (The Version That Works)

We’ll do two checks:

1) **Cross-correlation of returns** across lags (fast, robust)
2) **Stability across windows** (the most important part)

Work with returns, not raw prices:

```
r_t = p_t - p_{t-1}
```

Then for each lag `k`, compare:

```
corr(r_A(t), r_B(t + k))
```

If correlation peaks at positive `k`, A tends to lead B by `k` time steps.

Now the key: **repeat the test**.

You need the relationship to persist:

- across multiple lookback windows (1d, 3d, 7d)
- at multiple granularities (1m, 5m)

If “the leader” changes every hour, you don’t have price discovery—you have noise.

---

## 4) Reproducible Script (Fetch + Lead–Lag)

Polymarket’s endpoints overview lists public CLOB pricing endpoints, including price history.  
External source: https://docs.polymarket.com/quickstart/reference/endpoints

This script fetches two price histories, resamples to a fixed interval, then computes cross-correlation across lags.

```python
import json
import math
import urllib.request
from statistics import mean

TOKEN_A = "TOKEN_ID_A"
TOKEN_B = "TOKEN_ID_B"

INTERVAL_SECONDS = 60
MAX_LAG = 30  # 30 minutes if interval is 60s

def get_json(url: str):
  with urllib.request.urlopen(url) as r:
    return json.loads(r.read().decode("utf-8"))

def fetch_prices(token_id: str):
  data = get_json(f"https://clob.polymarket.com/prices-history?token_id={token_id}")
  points = []
  for row in data:
    ts = int(row.get("t") or row.get("timestamp") or row.get("time"))
    px = float(row.get("p") or row.get("price"))
    points.append((ts, px))
  points.sort(key=lambda x: x[0])
  return points

def resample(points, interval):
  buckets = {}
  for ts, px in points:
    b = (ts // interval) * interval
    buckets[b] = px
  if not buckets:
    return []
  t0 = min(buckets.keys())
  t1 = max(buckets.keys())
  out = []
  cur = None
  for t in range(t0, t1 + interval, interval):
    if t in buckets:
      cur = buckets[t]
    if cur is None:
      continue
    out.append((t, cur))
  return out

def returns(series):
  return [series[i][1] - series[i-1][1] for i in range(1, len(series))]

def corr(x, y):
  n = min(len(x), len(y))
  if n < 10:
    return 0.0
  x = x[:n]
  y = y[:n]
  mx = mean(x)
  my = mean(y)
  vx = mean([(a - mx) ** 2 for a in x])
  vy = mean([(b - my) ** 2 for b in y])
  if vx <= 1e-12 or vy <= 1e-12:
    return 0.0
  cov = mean([(x[i] - mx) * (y[i] - my) for i in range(n)])
  return cov / math.sqrt(vx * vy)

pa = resample(fetch_prices(TOKEN_A), INTERVAL_SECONDS)
pb = resample(fetch_prices(TOKEN_B), INTERVAL_SECONDS)
ra = returns(pa)
rb = returns(pb)

results = []
for lag in range(-MAX_LAG, MAX_LAG + 1):
  if lag >= 0:
    c = corr(ra, rb[lag:])
  else:
    c = corr(ra[-lag:], rb)
  results.append((lag, c))

best = max(results, key=lambda x: x[1])
lag, c = best
relation = "A leads B" if lag > 0 else "B leads A" if lag < 0 else "synchronous"
print({"best_relation": relation, "lag_steps": lag, "corr": c, "all": results})
```

Use it like a filter:

- if best correlation is tiny, you don’t have a usable relationship
- if best lag flips frequently across windows, don’t trade it

---

## 5) Turning “Leader” Into a Trade

Once you identify the leader:

1) monitor whale flow and price movement in the leader
2) check if the follower has updated fully
3) if follower lags, that lag is your window

Common playbooks:

- **watch leader, enter follower** (if follower has better execution)
- **watch leader, hedge with leader** (if follower is a cleaner payoff but worse to manage)

This is where wallet context matters:
- [/smart-money](/smart-money)
- [/whales/0x94f199fb7789f1aef7fff6b758d6b375100f4c7a](/whales/0x94f199fb7789f1aef7fff6b758d6b375100f4c7a)

---

## 6) Failure Modes (How You Fool Yourself)

Lead–lag analysis breaks when:

- both markets are illiquid (prices move from micro-noise)
- one market’s book is mostly cancellation pressure (fake depth)
- the correlation is shared resolution mechanics, not shared belief

If you can’t explain *why* a market leads, don’t trust the statistic.

---

## Sources (External)

- Polymarket API endpoints overview: https://docs.polymarket.com/quickstart/reference/endpoints
- Gamma Markets API (market discovery): https://docs.polymarket.com/developers/gamma-markets-api/get-markets
