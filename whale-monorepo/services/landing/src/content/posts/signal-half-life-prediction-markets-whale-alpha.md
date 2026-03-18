---
title: "Signal Half-Life in Prediction Markets: How Long Does Whale Alpha Last?"
date: "2026-03-18"
excerpt: "On Polymarket, the difference between riding smart money and becoming exit liquidity is measured in minutes, not days. This deep dive explains signal half-life—the time it takes for whale-driven edge to decay—and how to build trading rules around it."
author: "Whale Team"
tags: ["Analysis", "Research", "Whale Score", "Signal Half-Life", "Polymarket", "Prediction Markets", "Timing"]
---

# Signal Half-Life in Prediction Markets: How Long Does Whale Alpha Last?

Most traders obsess over being first. In reality, **how long a signal stays valid** is often more important than how fast you see it.

On Polymarket, smart money (“whales”) place large, information-rich bets. Your edge doesn’t come from guessing *what* they know, but from understanding **how quickly the edge they have decays**.

> **Signal half-life**: the amount of time it takes for a new information signal (like a whale trade) to lose half of its expected edge, because the rest of the market sees it, digests it, and re-prices.

If you assume every whale trade is timeless alpha, you’ll keep buying stale signals at the exact moment they flip from edge to exit liquidity.

This deep dive explains:

- the **three phases** of a whale signal’s life  
- how to estimate signal half-life from on-chain and orderbook behavior  
- practical rules you can apply when following whale alerts  
- how a system like **Whale Score™** can embed signal half-life into its weighting

Internal links:

- Whale leaderboard: [/smart-money](/smart-money)  
- Whale profiles and Score: [/whales](/whales)  
- Backtesting: [/backtesting](/backtesting)  

---

## 1. The Three Phases of a Whale Signal

### Phase 1 – Emergence: From Private Edge to Observable Flow

In the earliest phase, information is:

1. **Private or tightly held** (insiders, domain experts, quant teams)  
2. **Expressed via capital flow**, not public statements  
3. **Sparse but high-conviction** (few big tickets, not many small ones)

On Polymarket, you see this as:

- a single wallet or tight cluster lifting offers aggressively in a niche market  
- orders that do not hesitate at mid or best ask when liquidity is thin  
- little social chatter—the trade happens **before** the Twitter thread

Key traits of the Emergence phase:

- **Low participation:** one to three wallets doing most of the volume  
- **Directional:** a clear push toward one outcome, not ping-pong scalping  
- **Price elasticity:** the orderflow is willing to move the price several ticks

If you act in this window, you are effectively **partnering with the originator of the edge**. You are close to the source.

### Phase 2 – Diffusion: The Market Notices

As time passes, more participants notice:

- the price has moved  
- liquidity has been eaten away at a specific level  
- a previously quiet market is suddenly active

Diffusion looks like:

- **copycat flow:** smaller wallets echoing the same direction, but with worse fills  
- **liquidity response:** market makers reload the book; spreads adjust  
- **narrative lag:** tweets, Discord messages, Telegram threads appear that *explain* a move already in progress

At this stage, the edge is no longer “pure information.” It is a combination of:

- residual informational edge  
- orderbook microstructure  
- emotional overreaction or underreaction by retail

The **signal half-life** often sits somewhere inside this phase. Past that point, you are no longer buying the original idea; you are trading crowd behavior around the idea.

### Phase 3 – Exhaustion: From Signal to Exit Liquidity

Eventually, the signal decays:

- the price approaches a level that embeds the new information  
- the original whales slow down or start offloading risk  
- retail arrives late, with **smaller, emotionally driven trades**

Signs you are at or past exhaustion:

- volume is high but **asymmetric size disappears** (few big tickets, many tiny ones)  
- the book shows **thick size** on the same side retail is piling into  
- news has caught up: the “reason” for the move is now broadly known  
- outcome odds have moved to a level where only extreme scenarios justify further edge

Acting here is often a negative-EV decision. You are no longer following information; you are **funding the exit**.

---

## 2. Approximating Signal Half-Life in Practice

You do not need a PhD to estimate whether a whale signal is still alive. You need a consistent way to measure **time, volume, and structural change** around a trade.

### Step 1 – Timestamp the Origin

Define **t₀** as the first moment where all three conditions hold:

- a wallet or cluster takes significantly larger size than the typical ticket  
- the trade materially changes the orderbook or price (not just a nibble)  
- no obvious public catalyst has just fired (the trade looks like initiative, not reaction)

This is your anchor.

### Step 2 – Track Cumulative Volume and Price Drift

From t₀ forward, bucket time into intervals (for example, 5 minutes, 30 minutes, two hours) and measure:

- **cumulative volume in the direction of the whale**  
- **net price change relative to t₀**  
- **concentration of that volume** (few wallets vs. many)

A rough half-life estimate comes from the point where:

- price has realized **most** of the move implied by the original trade  
- additional volume is dominated by copycats, not the initiator  
- new information is visible in off-chain channels (tweets, news, group chats)

In many Polymarket-style event markets, this might be **30–180 minutes**, not days.

### Step 3 – Watch Wallet Behavior, Not Just Market Prints

A single large buy can be:

- part of a **sustained build** (multiple adds over hours or days)  
- a **one-off mispricing capture**  
- a **hedge or cross-venue arbitrage leg**

If the initiating wallet:

- keeps **adding** at higher prices → signal is still in Emergence/Diffusion  
- starts **unwinding** or flipping sides → the informational edge is probably fully priced  
- goes silent while retail continues in the same direction → exhaustion is close

Your half-life estimate must be **conditional on the wallet’s behavior**, not just the chart.

---

## 3. Embedding Signal Half-Life into a Whale Scoring System

A static score (“this wallet is 84/100 forever”) misses the dynamic part of edge.

A serious system should:

- penalize signals that only **briefly** produce edge before reversing  
- reward signals that **retain** predictive power over a measurable window  
- down-weight trades that are crowded instantly and decay fast

Conceptually, let:

- **S(t)** be the informativeness of a given whale signal over time  
- half-life **T½** be where S(t) ≈ ½ · S(0)

A good Whale Score weights wallets whose S(t) decays **slowly**, not just those with large S(0).

In practice, this can translate into:

- higher scores for wallets whose trades **age well** (PnL measured one hour, six hours, 24 hours post-trade)  
- lower scores for wallets whose trades are mostly **short-lived spikes** followed by mean reversion  
- time-decay factors baked into rankings and alert filters (for example, “ignore signals fired more than X minutes ago unless price has barely moved”)

---

## 4. Practical Rules You Can Use Today

Even without full infrastructure, you can adopt operational rules:

- **Rule 1: Define your freshness window.**  
  Decide a maximum age (for example, 60–90 minutes) beyond which you treat a signal as “old” unless price has barely moved.

- **Rule 2: Track initiator activity, not just symbols.**  
  Map alerts back to wallets and ask: *Is this wallet still building, or already exiting?*

- **Rule 3: Avoid narrative-only trades.**  
  If you discovered the trade through social media, you are probably in Phase 2 or 3 already.

- **Rule 4: Respect structural barriers.**  
  If price already moved into a range where only extreme outcomes justify it, treat new buys as exit-risk, not fresh alpha.

Prediction markets reward people who understand **when** a signal is still a signal, and when it has become a story. Half-life thinking is how you stay on the right side of that line.

