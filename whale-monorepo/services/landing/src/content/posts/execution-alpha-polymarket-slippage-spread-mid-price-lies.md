---
title: "Execution Alpha on Polymarket: Slippage, Spread, and Why Mid Price Lies"
date: "2026-03-10"
excerpt: "Most traders lose money on Polymarket without being wrong. The culprit is execution: spread, depth, and fee curves that turn the midpoint into a comforting fiction. This guide shows how to estimate execution cost from order book snapshots and how to choose maker vs taker in a way you can reproduce."
author: "Whale Team"
tags: ["Analysis", "Research", "Polymarket", "CLOB", "Market Microstructure", "Slippage", "Bid-Ask Spread", "Execution Cost", "Order Book Depth"]
---

# Execution Alpha on Polymarket: Slippage, Spread, and Why Mid Price Lies

If you only remember one thing about trading a Central Limit Order Book (CLOB), make it this:

**Mid price is not a tradable price. It’s a statistic.**

On Polymarket, the difference between a great thesis and a profitable trade is often a few basis points of execution. That gap comes from:

- **Spread** (what you pay to cross immediately)
- **Depth / price impact** (what happens when your size walks the book)
- **Fees (when enabled)** (a nonlinear curve that peaks near 50% probability)
- **Opportunity cost** (what you lose by waiting for a limit fill)

This post gives you a reproducible way to quantify those costs from order book snapshots, then shows how to convert that into a practical decision: **maker vs taker**.

Internal links for later:
- Smart Money overview: [/smart-money](/smart-money)
- Backtesting tools & methodology: [/backtesting](/backtesting)
- Upgrade for real-time alerts: [/subscribe](/subscribe)

---

## 1) The “Midpoint Trap”

Most UI surfaces show:

- Last traded price
- Best bid / best ask
- Midpoint price (often the average of the best bid and ask)

Midpoint is useful for charting, but it hides the two things that determine your realized entry:

1. **How much size is actually posted at the top levels**
2. **How quickly the book refills after you take it**

In a deep book, midpoint and VWAP are close.
In a thin book, midpoint can be a lie you tell yourself before paying the spread plus impact.

---

## 2) Define Execution Cost (in a way you can measure)

Let:

- `p_mid` = midpoint at time of order
- `p_vwap` = volume-weighted average execution price for your size
- `p_ref` = your reference price (midpoint, or a “fair” model price)

A clean definition of execution slippage (for buys) is:

```
slippage_bps = 10,000 × (p_vwap - p_ref) / p_ref
```

For sells, flip the sign:

```
slippage_bps = 10,000 × (p_ref - p_vwap) / p_ref
```

Then add fees when they apply:

```
total_cost_bps ≈ slippage_bps + fee_bps(p, market_type)
```

Polymarket exposes public APIs for order books and pricing, and public APIs for market metadata (including CLOB token IDs). The docs list the base URLs for Gamma (market metadata) and CLOB (order books) APIs.  
Source: Polymarket API endpoints overview (Gamma / CLOB / Data API). https://docs.polymarket.com/quickstart/reference/endpoints

---

## 3) Reproducible Method: Estimate Slippage From a Snapshot

### Step A — Get a token ID (YES or NO) for a market

Polymarket’s Gamma Markets API returns market objects with `clobTokenIds` (YES/NO token IDs) when order book trading is enabled.  
Source: Gamma “Get markets” docs (includes CLOB token IDs and enableOrderBook). https://docs.polymarket.com/developers/gamma-markets-api/get-markets

Example (replace `slug` with any market/event slug you care about):

```bash
curl "https://gamma-api.polymarket.com/markets?slug=fed-decision-in-october"
```

From the response:
- confirm `enableOrderBook` is true
- extract the relevant `clobTokenIds` for the outcome you trade

### Step B — Pull the order book

Polymarket’s CLOB API exposes a public `GET /book` endpoint for a token’s order book (best bids/asks with price levels).  
Source: CLOB API endpoints reference (includes `/book`, `/midpoint`, `/spread`). https://docs.polymarket.com/quickstart/reference/endpoints

Example:

```bash
curl "https://clob.polymarket.com/book?token_id=YOUR_TOKEN_ID"
```

### Step C — Compute the VWAP you would actually pay

For a buy:
1. Sort asks from lowest price to highest
2. Consume quantity until your target size is filled
3. Compute VWAP

Here’s a minimal Python script (standard library only) that:
- fetches `/book`
- computes the VWAP for a target notional
- compares it to midpoint

```python
import json
import urllib.request

TOKEN_ID = "YOUR_TOKEN_ID"
NOTIONAL_USD = 5000  # change to your size

def get_json(url: str):
  with urllib.request.urlopen(url) as r:
    return json.loads(r.read().decode("utf-8"))

book = get_json(f"https://clob.polymarket.com/book?token_id={TOKEN_ID}")
mid = get_json(f"https://clob.polymarket.com/midpoint?token_id={TOKEN_ID}")

asks = book["asks"]  # [{ "price": "...", "size": "..." }, ...]
p_mid = float(mid["midpoint"])

remaining = NOTIONAL_USD
filled_shares = 0.0
paid = 0.0

for level in asks:
  p = float(level["price"])
  s = float(level["size"])
  level_notional = p * s
  take = min(remaining, level_notional)
  take_shares = take / p
  paid += take
  filled_shares += take_shares
  remaining -= take
  if remaining <= 1e-9:
    break

if remaining > 0:
  raise SystemExit("Not enough depth to fill this size from the snapshot.")

p_vwap = paid / filled_shares
slippage_bps = 10000 * (p_vwap - p_mid) / p_mid

print({"p_mid": p_mid, "p_vwap": p_vwap, "slippage_bps": slippage_bps, "shares": filled_shares})
```

What makes this verifiable:
- you can rerun it on the same token at any time
- you can store snapshots and compare execution cost distributions by market type (sports vs politics vs crypto)

---

## 4) The Part Everyone Misses: Depth Is Not Symmetric

For binary markets, depth often differs between YES and NO. Two common causes:

- **Behavioral skew**: retail prefers “Yes” narratives; makers compensate by widening that side
- **Inventory risk**: makers lean away from the side that becomes toxic after news

So your execution model should be **side-specific** and **outcome-specific**:

- slippage for YES-buy is not the same as NO-buy
- slippage at 20¢ is not the same as slippage at 50¢

That last point matters even more once taker fees are enabled, because fees peak around 50% probability for certain market types.  
Source: Polymarket “Fees” documentation (fee curve; markets with fees; fee-rate endpoint). https://docs.polymarket.com/trading/fees

---

## 5) A Practical Decision Rule: Maker vs Taker

Think in expected value, not ideology.

### Taker is “pay now”
You cross the spread, accept price impact, and (sometimes) pay the taker fee.

Taker is optimal when:
- you believe the market is about to gap through your limit price
- the cost of missing the move is larger than spread + impact + fee

### Maker is “wait for a discount”
You post a limit order and try to earn the spread (or at least avoid paying it).

Maker is optimal when:
- book depth is thin and crossing would walk multiple levels
- volatility is low enough that your limit has time to get hit
- your alert/edge is slow-moving (hours/days), not seconds

Here is a simple, usable model:

```
expected_cost_taker = spread_bps + impact_bps(size) + fee_bps
expected_cost_maker = miss_prob × move_bps - fill_prob × rebate_bps
```

You don’t need to estimate everything perfectly. You need the sign.

If you want to formalize this in a way that survives overfitting, build it into a backtest:
- stratify by liquidity and market category
- replay order book snapshots (or use midpoint + spread proxies where snapshots are unavailable)

This is exactly the kind of tooling we keep in the product stack:
- [/backtesting](/backtesting)

---

## 6) What This Looks Like in the Real World

When we analyze “smart money” wallets, the best ones are not just right—they are **cheap**.

They consistently:

- avoid crossing wide spreads in thin books
- scale into positions with limit orders when the book is fragile
- use taker only when timing matters more than price

That’s why we treat execution as alpha, not implementation detail:
- [/smart-money](/smart-money)

---

## 7) Checklist: Before You Click Buy

Use this pre-trade checklist:

1. **Pull the order book** (YES and NO token IDs) and measure depth at your size
2. **Compute snapshot VWAP** and compare to midpoint
3. **Check whether fees apply** (and the fee rate if enabled)
4. **Decide maker vs taker** using a simple expected-cost model
5. **Log it** (snapshot time, book, intended size) so you can audit your own execution later

If you want alerts that surface only the trades worth copying—and filter out noise—upgrade for real-time delivery:
- [/subscribe](/subscribe)

---

## Sources (External)

- Polymarket API endpoints overview (Gamma / CLOB / Data API): https://docs.polymarket.com/quickstart/reference/endpoints
- Gamma Markets API — Get markets (slugs, enableOrderBook, CLOB token IDs): https://docs.polymarket.com/developers/gamma-markets-api/get-markets
- Polymarket Fees (taker fees, fee curve, fee-rate endpoint): https://docs.polymarket.com/trading/fees
