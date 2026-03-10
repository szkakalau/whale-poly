---
title: "Maker vs Taker on Polymarket: When Paying the Spread Is Actually Optimal"
date: "2026-03-05"
excerpt: "“Always use limit orders” is bad advice on a fast CLOB. Sometimes crossing the spread is cheaper than waiting. This post builds an execution-cost model that combines spread, depth, fee curves, fill probability, and opportunity cost—then shows how to validate it with Polymarket’s public APIs."
author: "Whale Team"
tags: ["Polymarket", "Maker Taker", "Limit Orders", "Market Orders", "Order Book", "Execution"]
---

# Maker vs Taker on Polymarket: When Paying the Spread Is Actually Optimal

Trading culture loves slogans:

- “Never market buy.”
- “Always be maker.”
- “Paying the spread is for amateurs.”

On Polymarket’s CLOB, those slogans will cost you money.

Sometimes the cheapest trade is the one that crosses the spread immediately.

This post explains when, using a model you can reproduce from public data:

- order book spread and depth
- Polymarket fee curves (when enabled)
- fill probability and queue priority
- opportunity cost (missed moves)

Internal links:
- CLOB microstructure primer: [/blog/clob-microstructure-real-buying-vs-fake-walls](/blog/clob-microstructure-real-buying-vs-fake-walls)
- Backtesting: [/backtesting](/backtesting)

---

## 1) Maker and Taker Are Execution Policies

On a CLOB:

- **Maker** adds liquidity: your limit order rests on the book.
- **Taker** removes liquidity: your order matches immediately against resting orders.

The naive view:

- maker = good (free / better price)
- taker = bad (fees / worse price)

The correct view:

**maker trades price for time. taker trades time for price.**

Your goal is not to be “maker.” Your goal is to minimize total expected cost.

---

## 2) Total Cost = Spread + Impact + Fees + Miss Risk

Start with two costs:

### Cost A — Immediate execution cost (taker)

If you cross the spread, you pay:

```
cost_taker ≈ half_spread + impact(size) + taker_fee
```

### Cost B — Waiting cost (maker)

If you post a limit order, you pay:

```
cost_maker ≈ miss_prob × adverse_move - fill_prob × (spread_capture + maker_rebate)
```

The important term is miss probability. In fast markets, **miss risk dominates**.

---

## 3) Fees Change the Math (Especially Near 50%)

Polymarket is fee-free on most markets, but some market types have taker fees enabled and the effective fee rate varies with share price, peaking near 50% probability.  
Source: Polymarket “Fees” documentation (fee curve; fee-rate endpoint). https://docs.polymarket.com/trading/fees

Separately, Polymarket documents a maker rebates program on eligible market types where taker fees fund rebates paid to liquidity providers.  
Source: Maker Rebates Program documentation. https://docs.polymarket.com/developers/market-makers/maker-rebates-program

Implication:

- In fee-enabled markets, “taker” can be materially more expensive at ~50¢ than at the extremes.
- In those same markets, “maker” can be materially better if you can actually get filled.

This pushes you toward a conditional policy:

- be maker when the book is stable and your time horizon allows waiting
- be taker when timing is the edge

---

## 4) When Paying the Spread Is Optimal

Here are the scenarios where taker is not just defensible, but optimal.

### Scenario A — News gap risk (your edge is timing)

If you believe a market will reprice quickly and one-sidedly (e.g., a breaking headline), your “limit price” is often just a hope.

If the price gaps through your level:
- you don’t get filled
- you chase higher
- your effective entry is worse than just taking now

In this regime, the opportunity cost of waiting is larger than half-spread.

### Scenario B — Thin top-of-book, deep second level (the ladder)

Many Polymarket books have:
- tiny size at best ask
- meaningful size one or two ticks above

If your order size clears the top level anyway, the incremental cost of taking the whole stack now can be small relative to the risk of missing.

### Scenario C — Your alpha decays intraday (not weekly)

If you trade markets where the “signal” is short-lived (crypto minute markets, sports in-play), the correct comparator is not midpoint.

It is:

**the expected future price if you wait.**

If that expected future price is worse than paying the spread now, you take.

---

## 5) How to Estimate the Inputs (Verifiable, From Public APIs)

Polymarket documents public APIs for:
- Gamma (market metadata)
- CLOB (order books, midpoint, spread)
- Data API (trades, positions)  
Source: Polymarket endpoints overview. https://docs.polymarket.com/quickstart/reference/endpoints

At minimum, you can estimate:

- `spread`: `GET /spread?token_id=...`
- `midpoint`: `GET /midpoint?token_id=...`
- `depth/impact`: `GET /book?token_id=...` and compute snapshot VWAP for your size
- `fee`: `GET /fee-rate?token_id=...` on fee-enabled markets (or use the documented fee curve)

That’s enough to compare policies.

If you want a template, the slippage/VWAP method is laid out here:
- [/blog/execution-alpha-polymarket-slippage-spread-mid-price-lies](/blog/execution-alpha-polymarket-slippage-spread-mid-price-lies)

---

## 6) The Metric That Actually Settles Maker vs Taker: Miss Rate

Most traders optimize a number they can see (spread) and ignore the number that matters (miss rate).

You can measure miss rate empirically:

1) For a given market and timestamp, choose a maker price (e.g., best bid for buys)
2) Ask: did the market trade through that price within `T` minutes?
3) If not, treat it as a miss (you waited and didn’t get in)

Then compare:

- maker realized entry price conditional on fill
- taker realized entry price
- opportunity cost of misses

This is a backtest, not an opinion.

---

## 7) A Simple Policy You Can Use Today

If you want a policy that behaves like a professional executor:

1) If spread is tight and depth is sufficient at your size: **taker is acceptable**
2) If spread is wide or top depth is thin: **post maker at a price you’re happy to miss**
3) If the market is fee-enabled and trading near 50¢: bias toward maker unless timing is critical
4) If you have an event-driven edge (news, deadlines): bias toward taker

“Happy to miss” is not sarcasm. It’s discipline.

If you are not happy to miss, you are not really making—you’re just delaying the taker decision.

---

## 8) Where SightWhale Fits

The best wallets aren’t just right; they’re efficient.
They:
- take when timing is the edge
- make when patience is the edge

We surface those behaviors so you can trade like an executor, not a spectator.

- Learn the mechanics: [/blog/clob-microstructure-real-buying-vs-fake-walls](/blog/clob-microstructure-real-buying-vs-fake-walls)
- Validate policies: [/backtesting](/backtesting)

---

## Sources (External)

- Polymarket API endpoints overview (Gamma / CLOB / Data API): https://docs.polymarket.com/quickstart/reference/endpoints
- Polymarket fees (fee curve; fee-enabled markets; fee-rate endpoint): https://docs.polymarket.com/trading/fees
- Maker Rebates Program (eligible markets; rebate mechanics): https://docs.polymarket.com/developers/market-makers/maker-rebates-program
