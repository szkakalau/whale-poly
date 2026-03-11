---
title: "Resolution Risk & Wording Arbitrage: The Hidden Edge (and Hidden Landmines)"
date: "2026-03-11"
excerpt: "In prediction markets, you can be right about reality and still lose money. The gap is resolution: wording, sources, edge cases, and oracle mechanics. This guide shows how to score resolution risk, spot “same idea, different contract” mismatches, and build a repeatable pre-trade checklist using public market metadata."
author: "Whale Team"
readTime: "11 min"
tags: ["Analysis", "Research", "Resolution Criteria", "Market Wording", "Event Resolution Risk", "Prediction Market Pitfalls", "Polymarket"]
---

# Resolution Risk & Wording Arbitrage: The Hidden Edge (and Hidden Landmines)

If you trade prediction markets long enough, you’ll eventually experience the most painful loss class:

You were right about what happened.
You were wrong about what the contract said.

That gap—**resolution risk**—is the difference between trading “the world” and trading “a legal sentence.”

This post is a practical framework for:

- identifying wording and source mismatches
- pricing resolution risk explicitly (instead of hand-waving it)
- spotting “wording arbitrage” where two markets look equivalent but are not
- avoiding the landmines that make a clean thesis untradable

Internal links:
- See how we score and rank wallets: [/smart-money](/smart-money)
- Backtest filters and thresholds: [/backtesting](/backtesting)
- Get real-time alerts without noise: [/subscribe](/subscribe)

---

## 1) Resolution Risk Is Not “Rare”

Resolution risk shows up whenever the market relies on:

- ambiguous language (“announce”, “confirm”, “official”, “by end of day”)
- edge cases (delays, reversals, partial outcomes, technicalities)
- a resolution source that can lag, contradict, or update
- an oracle process that can dispute / delay / clarify

You don’t need to predict disputes to care about resolution.
You need to predict **what the contract will settle on**.

---

## 2) The Resolution Surface Area (What to Inspect)

Before you trade, inspect these fields:

### A) The question and the end date

Wording often encodes:

- what counts as “happened”
- the timestamp window
- whether late events count

### B) The resolution source(s)

Markets often specify a source (“AP”, “official website”, “regulator”, “on-chain metric”).
Different sources can disagree on timing or definition—even when reality is clear.

### C) The outcome mapping

Binary markets hide a trick: “YES” often means “the event occurs under the contract definition,” not “the vibe is true.”

### D) The oracle / dispute process

Even with clean wording, resolution can involve an oracle workflow and disputes.

Polymarket’s documentation describes resolution processes and UMA-based mechanisms for some markets, including dispute handling and clarifications (bulletin board).  
External sources:
- https://docs.polymarket.com/polymarket-learn/markets/how-are-markets-resolved
- https://docs.polymarket.com/developers/resolution/UMA

---

## 3) A Repeatable “Resolution Risk Score”

You don’t need perfect modeling. You need a consistent rubric.

Score each dimension 0–2 (low → high risk), then sum:

1) **Wording ambiguity**
- 0: objective, machine-checkable (e.g., “closing price above X” with a specified source)
- 1: mostly objective but with timing/edge-case fuzz
- 2: subjective or depends on interpretation (“confirmed”, “credible”, “significant”)

2) **Source stability**
- 0: a single, authoritative source with a history of consistent reporting
- 1: multiple sources required or known to revise frequently
- 2: source is unclear, unofficial, or prone to retroactive changes

3) **Edge-case density**
- 0: few plausible weird paths
- 1: some plausible weird paths
- 2: many plausible weird paths (delays, recounts, partial execution, chain reorganizations, etc.)

4) **Timing fragility**
- 0: wide window; clear close
- 1: narrow “by X time” window
- 2: “by end of day” / timezone ambiguity / rolling interpretation

5) **Oracle complexity**
- 0: historically smooth
- 1: can dispute / clarify
- 2: high chance of dispute or clarification dependence

**Rule of thumb**:
- 0–3: tradable if execution is sane
- 4–6: trade smaller or demand a bigger edge
- 7+: only trade if you have an informational advantage on resolution mechanics, not just the event

---

## 4) Wording Arbitrage: “Same Idea” ≠ “Same Contract”

Wording arbitrage exists when two markets look equivalent in a screenshot but settle differently.

Common mismatch archetypes:

### Archetype A — “Announced” vs “Occurred”

- Market 1: “Will X be announced by Date?”
- Market 2: “Will X occur by Date?”

The first can resolve YES on an announcement even if the event never happens.
The second needs the event itself.

### Archetype B — “Official” vs “Reported”

- Market 1: “Will the regulator publish…”
- Market 2: “Will major media report…”

One depends on institutional calendars, the other depends on reporting behavior.

### Archetype C — “At any time” vs “at end of day”

Binary outcomes hide path-dependence.
A market can:
- touch a threshold intraday but close below it
- or reverse before the cutoff

If the contract says “at end of day”, intraday touches don’t matter.

### Archetype D — “Resolved by source A AND B” vs “A OR B”

Multi-source definitions can be surprisingly strict.

External example (illustrative of strict multi-source conditions; do not assume equivalence across markets):
- https://blog.uma.xyz/articles/polymarket-us-presidential-election-resolution-process-guide

---

## 5) How to Verify Wording and Sources (Public, Reproducible)

You can fetch market metadata via Polymarket’s public Gamma API.  
External source (Gamma markets API, including fields like `slug`, `endDate`, and `resolutionSource` depending on the market object):
- https://docs.polymarket.com/developers/gamma-markets-api/get-markets

Example workflow:

1) Pick a market slug (from a Polymarket URL)
2) Fetch the market object
3) Inspect wording, end date, resolution source, and outcomes

```bash
curl "https://gamma-api.polymarket.com/markets?slug=YOUR_MARKET_SLUG"
```

What to save for your audit log:

- `slug`
- `question` / title
- `endDate` / close time (and timezone)
- `resolutionSource` (or similar source fields)
- outcomes + outcomePrices (to track how pricing changed)

Polymarket also documents a clean separation of APIs:
- Gamma API for discovery/metadata
- CLOB API for order books/prices
- Data API for positions/trades  
External source:
- https://docs.polymarket.com/quickstart/reference/endpoints

---

## 6) A “Pre-Trade Contract Checklist” (Copy/Paste)

Before you take size, answer these:

1) What exact condition makes YES resolve?
2) What does NO mean (the complement, or “not proven by source”)?
3) What is the cutoff time and timezone?
4) What happens if the event occurs late?
5) What happens if the source revises retroactively?
6) Is there a single source or a multi-source requirement?
7) Is there a history of disputes/clarifications in similar markets?

If any answer is “not sure,” that’s not a reason to avoid trading.
It’s a reason to **demand a larger edge**.

---

## 7) How SightWhale Uses This

Most dashboards treat every market as equally settleable.
We don’t.

Resolution risk is a first-class dimension because it changes:
- what counts as “smart money”
- how long a position is rational to hold
- whether a whale trade is copyable

Use the product pages as entry points:
- Strategy-level alerts: [/smart-money](/smart-money)
- Portfolio testing and filters: [/backtesting](/backtesting)
- Real-time delivery: [/subscribe](/subscribe)

---

## Sources (External)

- Polymarket API endpoints overview: https://docs.polymarket.com/quickstart/reference/endpoints
- Gamma Markets API (market metadata; slugs; discovery): https://docs.polymarket.com/developers/gamma-markets-api/get-markets
- How markets resolve (Polymarket): https://docs.polymarket.com/polymarket-learn/markets/how-are-markets-resolved
- UMA resolution documentation (Polymarket developer docs): https://docs.polymarket.com/developers/resolution/UMA
- Example of strict resolution-source rules (UMA blog): https://blog.uma.xyz/articles/polymarket-us-presidential-election-resolution-process-guide
