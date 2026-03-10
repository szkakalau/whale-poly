---
title: "Whale Position Lifecycle: Entry → Defense → Unwind (and How to Detect Each Phase)"
date: "2026-03-09"
excerpt: "Whale edges don’t decay on a timer—they move through a lifecycle. This guide frames Polymarket trading as a position state machine and shows how to detect Entry, Defense, and Unwind phases using net position changes, trade structure, and closed-position PnL you can verify via Polymarket’s public APIs."
author: "Whale Team"
tags: ["Analysis", "Research", "Polymarket", "Whale Trading", "Position Lifecycle", "On-Chain Analytics", "Risk Management", "Order Flow"]
---

# Whale Position Lifecycle: Entry → Defense → Unwind (and How to Detect Each Phase)

Traders love talking about “signal half-life.” It’s comforting: a single number that tells you when a whale trade stops mattering.

Reality is messier and more useful.

Whales don’t buy once, post a tweet, and vanish. They manage a position like a system:

1. **Entry**: build exposure
2. **Defense**: add or reshape exposure when price moves against them
3. **Unwind**: reduce exposure into strength, or exit after the thesis changes

If you can detect which phase you’re in, you stop copying trades blindly and start copying **behavior**.

Internal links:
- Whale profiles: [/whales/0x94f199fb7789f1aef7fff6b758d6b375100f4c7a](/whales/0x94f199fb7789f1aef7fff6b758d6b375100f4c7a)
- Smart money leaderboard & methodology: [/smart-money](/smart-money)

---

## 1) Model It as a State Machine

The simplest lifecycle model that works is a 3-state machine with clear transition signals:

```
ENTRY  ->  DEFENSE  ->  UNWIND
  \_____________________/
        (thesis reset)
```

Your job is not to guess intent from one trade. Your job is to detect **persistent net behavior**:

- net position change (size up/down)
- aggressiveness (taker vs maker implied by execution patterns)
- price context (are they adding after adverse moves or chasing momentum?)

---

## 2) What Data You Can Verify (Public APIs)

You do not need privileged data to do this well. Polymarket provides:

- **Gamma API** for market metadata (slugs, condition IDs, outcomes)  
  Source: Gamma “Get markets” docs (fetch markets by slug, events, pagination). https://docs.polymarket.com/developers/gamma-markets-api/get-markets

- **Data API** for positions, closed positions, and trade history (per wallet)  
  Source: Polymarket endpoints overview (Data API base + endpoints). https://docs.polymarket.com/quickstart/reference/endpoints

Two endpoints matter most for lifecycle:

1) Current positions:

```bash
curl "https://data-api.polymarket.com/positions?user=0xYOUR_WALLET"
```

This returns `size`, `avgPrice`, `curPrice`, and related fields for each open position.  
Source: “Get current positions for a user”. https://docs.polymarket.com/api-reference/core/get-current-positions-for-a-user

2) Closed positions (settled / realized PnL):

```bash
curl "https://data-api.polymarket.com/closed-positions?user=0xYOUR_WALLET"
```

This returns `realizedPnl`, `totalBought`, `avgPrice`, `timestamp`, and market identifiers for positions that have closed.  
Source: “Get closed positions for a user”. https://docs.polymarket.com/api-reference/core/get-closed-positions-for-a-user

From these, you can reconstruct:
- whether a wallet is still exposed
- whether it tends to scale entries
- whether it typically unwinds into liquidity or exits abruptly

To detect **phase** in real-time, you’ll also want trades:
- `GET /trades` is available under the Data API (listed in the endpoints overview).  
  Source: https://docs.polymarket.com/quickstart/reference/endpoints

---

## 3) Phase Definitions (Operational, Not Vibes)

### Phase A — Entry

Entry is not “a big buy.” Entry is:

- **net position size increases over a window**
- with **average entry price** that stabilizes (suggesting structured execution)
- often concentrated in one outcome (YES or NO) rather than ping-ponging

Operational signals:

- `Δsize > 0` in consecutive snapshots
- `avgPrice` moves slowly relative to `curPrice` (scaling instead of chasing)
- trade sizes cluster around a target notional (TWAP-ish behavior)

### Phase B — Defense

Defense is where whales separate from tourists.

Defense is:
- adding exposure when price moves against the existing position, or
- swapping exposure between outcomes / markets to keep thesis exposure but reduce liquidation risk.

Operational signals:

- `Δsize > 0` while `curPrice` moved against the position since the last snapshot
- `avgPrice` improves meaningfully (they are averaging down, not just adding)
- position becomes less “clean”: multiple fills, sometimes across multiple nearby markets

Defense is also where sloppy copy-traders get destroyed, because they join *after* the whale has already improved their entry.

### Phase C — Unwind

Unwind is not necessarily “sell everything.” It’s:

- a persistent reduction in size, often into liquidity, often as the market moves toward the whale’s thesis

Operational signals:

- `Δsize < 0` consistently
- realized PnL starts appearing in `closed-positions`
- trade sizes are smaller and more frequent (working an exit) or one-time (thesis flip)

---

## 4) A Reproducible Classifier (Rules That Survive Backtests)

You can build a phase detector without ML. Start with rules that you can audit.

Define a rolling window (e.g., 6 hours) and compute:

- `net_size_change = size(t) - size(t - window)`
- `price_change = curPrice(t) - curPrice(t - window)`
- `avg_price_change = avgPrice(t) - avgPrice(t - window)`

Then classify:

```
if net_size_change > +S_min:
  if price_change is adverse: DEFENSE
  else: ENTRY
elif net_size_change < -S_min:
  UNWIND
else:
  HOLD
```

Two parameters matter:

- `S_min`: ignore noise (e.g., 200 shares or $500 notional equivalent)
- “adverse”: define adverse relative to side (for YES, price down is adverse; for NO, price up is adverse)

This yields a detector that is:
- deterministic
- explainable
- easy to backtest and refine

If you want to go beyond rules, treat the phase label as your target variable and do calibration (precision/recall) rather than chasing accuracy.

---

## 5) Why Phase Detection Beats “Copy the Last Trade”

Copying individual trades fails because:

- you don’t know the whale’s remaining position
- you don’t know whether they are entering or exiting
- you don’t know whether the trade is hedge, defense, or unwind

Phase detection fixes this by shifting your question from:

“Did a whale buy?”

to:

“Is the whale still building exposure, defending it, or distributing it?”

That’s the difference between being early and being liquidity.

---

## 6) How We Use This in SightWhale

When you open a whale profile, the goal is not to show a single impressive trade.
The goal is to give you:

- what the wallet does repeatedly
- how it behaves around adverse moves
- whether it exits cleanly or gets trapped

Start with a profile page and watch how behavior changes across markets:
- [/whales/0x94f199fb7789f1aef7fff6b758d6b375100f4c7a](/whales/0x94f199fb7789f1aef7fff6b758d6b375100f4c7a)

For a higher-level view across wallets, use:
- [/smart-money](/smart-money)

---

## 7) Practical Takeaways

1. **Entry is a process**: one trade is not a position.
2. **Defense is informational**: averaging down is a signal only if it’s persistent and structured.
3. **Unwind tells you more than entry**: good wallets exit like professionals—quietly, into liquidity.
4. **Treat phase as the product**: copy behavior, not screenshots.

---

## Sources (External)

- Polymarket API endpoints overview (Gamma / CLOB / Data API): https://docs.polymarket.com/quickstart/reference/endpoints
- Gamma Markets API — Get markets: https://docs.polymarket.com/developers/gamma-markets-api/get-markets
- Data API — Get current positions for a user: https://docs.polymarket.com/api-reference/core/get-current-positions-for-a-user
- Data API — Get closed positions for a user: https://docs.polymarket.com/api-reference/core/get-closed-positions-for-a-user
