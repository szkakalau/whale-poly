---
title: "When Volume Is a Trap: Measuring ‘Toxic Flow’ vs Informational Flow"
date: "2026-03-11"
excerpt: "High volume doesn’t mean smart money. In CLOB markets, the key is flow quality: toxic (adverse selection) versus informational (price discovery). This post shows how to measure adverse selection using trades + mid-price reactions, build a followability filter for whale alerts, and reproduce it with public Polymarket APIs."
author: "Whale Team"
readTime: "13 min"
tags: ["Analysis", "Research", "Toxic Flow", "Adverse Selection", "Volume Quality", "Order Flow", "Polymarket", "CLOB"]
---

# When Volume Is a Trap: Measuring ‘Toxic Flow’ vs Informational Flow

Volume is the easiest metric to display and the easiest metric to misunderstand.

On Polymarket, high volume can mean:

- real information arriving
- arbitrage and churn
- bots pinging the book
- traders paying the spread to chase noise

If your alerts key off volume alone, you will get louder—not better.

The fix is to measure **flow quality**:

- **informational flow**: trades that move price and keep it there (new information)
- **toxic flow**: trades that look like activity but create adverse selection (you get filled right before price moves against you)

Internal links:
- Calibrate alerts with backtests: [/backtesting](/backtesting)
- Follow top wallets, not noise: [/smart-money](/smart-money)
- Get high-signal alerts: [/subscribe](/subscribe)

---

## 1) The Core Idea: Adverse Selection

In market microstructure, “toxic” flow is flow that makes liquidity providers lose money:

- makers get filled
- mid price moves against them right after

From a follower’s perspective, toxic flow is even worse:

- you copy trades that were profitable for the initiator
- but you enter after the edge is gone

So we want to measure:

**How much does the mid price move after a trade, in the trade’s direction?**

If price moves immediately and stays moved, the flow was informational.
If price mean-reverts or whipsaws, the flow was mostly noise.

---

## 2) A Verifiable Metric: Post-Trade Mid-Price Drift

For each trade at time `t`:

- define `m_t` = mid price at trade time
- define `m_{t+Δ}` = mid price Δ seconds later

For a **buy**, informational drift is:

```
drift = m_{t+Δ} - m_t
```

For a **sell**, flip the sign:

```
drift = m_t - m_{t+Δ}
```

Then normalize by trade size to compare apples to apples:

```
drift_per_$ = drift / trade_notional_usd
```

If `drift_per_$` is consistently positive for a wallet’s trades, the wallet’s flow tends to be informational.
If it’s near zero or negative, copying is dangerous.

---

## 3) Data Pull: Trades + Mid Price (Public)

Polymarket documents public endpoints for:

- Data API (trade history)
- CLOB API (midpoint and price history)
- Gamma API (token IDs and discovery)  
External source: https://docs.polymarket.com/quickstart/reference/endpoints

Practical workflow:

1) choose a token ID (YES or NO token)
2) fetch recent trades for that token
3) fetch mid price time series
4) compute post-trade drift at multiple horizons (e.g., 30s, 5m, 30m)

---

## 4) Reproducible Script: Toxic Flow Score for a Token

This script:

- fetches recent trades (Data API)
- samples midpoint series (CLOB)
- computes post-trade drift at fixed horizons

```python
import json
import math
import urllib.request
from statistics import mean

TOKEN_ID = "YOUR_TOKEN_ID"
LIMIT = 200
HORIZONS = [30, 300, 1800]  # seconds

def get_json(url: str):
  with urllib.request.urlopen(url) as r:
    return json.loads(r.read().decode("utf-8"))

trades = get_json(f"https://data-api.polymarket.com/trades?limit={LIMIT}&token_id={TOKEN_ID}")
mid_hist = get_json(f"https://clob.polymarket.com/prices-history?token_id={TOKEN_ID}")

def normalize_points(points):
  out = []
  for row in points:
    ts = int(row.get("t") or row.get("timestamp") or row.get("time"))
    px = float(row.get("p") or row.get("price"))
    out.append((ts, px))
  out.sort(key=lambda x: x[0])
  return out

mid_points = normalize_points(mid_hist)
trade_points = []
for row in trades:
  ts = int(row.get("timestamp") or row.get("time") or row.get("t"))
  price = float(row.get("price"))
  size = float(row.get("size") or row.get("shares") or 0)
  side = (row.get("side") or "").lower()
  trade_usd = float(row.get("trade_usd") or (price * size))
  trade_points.append((ts, side, trade_usd, price))

def mid_at(ts):
  # last observation carried forward
  lo, hi = 0, len(mid_points) - 1
  if hi < 0:
    return None
  if ts <= mid_points[0][0]:
    return mid_points[0][1]
  if ts >= mid_points[-1][0]:
    return mid_points[-1][1]
  while lo <= hi:
    mid = (lo + hi) // 2
    if mid_points[mid][0] <= ts:
      lo = mid + 1
    else:
      hi = mid - 1
  return mid_points[max(0, hi)][1]

drifts = {h: [] for h in HORIZONS}
for ts, side, usd, _ in trade_points:
  m0 = mid_at(ts)
  if m0 is None or usd <= 0:
    continue
  for h in HORIZONS:
    m1 = mid_at(ts + h)
    if m1 is None:
      continue
    if side == "buy":
      drift = m1 - m0
    elif side == "sell":
      drift = m0 - m1
    else:
      continue
    drifts[h].append(drift / usd)

out = {f"drift_per_usd_{h}s": (mean(drifts[h]) if drifts[h] else 0.0) for h in HORIZONS}
print(out)
```

Interpretation:

- positive drift-per-$ at 30s and 5m suggests informational flow
- if 30s is positive but 30m is negative, you’re seeing short-lived impact (often toxic / mean reversion)

---

## 5) Turning Metrics Into an Alert Filter

A simple followability filter:

1) Require a minimum trade size
2) Require a minimum wallet quality (separate model)
3) Require **positive drift-per-$** at a relevant horizon

Example policy:

- allow signals only if:
  - `drift_per_$ (5m) > 0`
  - and `drift_per_$ (30m)` is not strongly negative

Then backtest by market category and liquidity regime:
- [/backtesting](/backtesting)

---

## 6) Why This Beats “Volume vs Conviction”

“Conviction” is often inferred from holding time or net position changes.
That’s useful, but it can’t distinguish:

- informed flow that moves price and persists
- churn that creates headlines and leaves no edge

Toxic flow metrics answer a sharper question:

**If I follow this flow, do I tend to enter before or after the information is priced?**

That’s the difference between “alerts” and “alpha.”

---

## 7) Where SightWhale Fits

We treat “followability” as a hard constraint:

- if execution is unstable, we downrank the signal
- if flow quality looks toxic, we demand stronger confirmation

That’s why the alert stream can stay quiet—and still be useful:
- [/subscribe](/subscribe)
- [/smart-money](/smart-money)

---

## Sources (External)

- Polymarket API endpoints overview (Gamma/CLOB/Data): https://docs.polymarket.com/quickstart/reference/endpoints
