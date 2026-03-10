---
title: "Alert Calibration: Choosing Thresholds That Don’t Overfit (A Backtesting Playbook)"
date: "2026-03-07"
excerpt: "If your whale alerts feel noisy, the fix isn’t another heuristic—it’s calibration. This playbook shows how to choose alert thresholds using precision/recall, stratified backtests (by liquidity, market category, and regime), and out-of-sample validation so you don’t tune to yesterday’s tape."
author: "Whale Team"
tags: ["Analysis", "Research", "Backtesting", "Alert Thresholds", "Precision Recall", "Overfitting", "Polymarket", "Trading Signals"]
---

# Alert Calibration: Choosing Thresholds That Don’t Overfit (A Backtesting Playbook)

Most alert systems fail in the same way:

They confuse *activity* with *signal*.

If you alert on every large trade, you will get:
- endless notifications
- low trust
- and a brutal problem: users mute you right before the best trade of the month

The alternative is not magic. It’s calibration.

This post explains how to choose alert thresholds in a way that:
- is measurable
- resists overfitting
- improves precision without destroying recall

Internal links:
- Backtesting: [/backtesting](/backtesting)
- Upgrade / alerts: [/subscribe](/subscribe)

---

## 1) First: Define What “Good Alert” Means

An alert is not “correct.” An alert is useful.

Pick a concrete label that matches how users trade. Examples:

- **Profit label**: after an alert, the market moves +X cents in your direction before moving -Y cents against you (a “take-profit / stop-loss” label)
- **Time label**: after an alert, the market has positive return over the next 1h/6h/24h
- **Execution label**: after an alert, there was enough depth/spread for a reasonable entry (filters out illiquid traps)

Do not mix labels. Pick one per calibration run.

---

## 2) Choose Metrics That Penalize Noise

Accuracy is useless here because “good alerts” are rare. Use:

- **Precision**: of alerts fired, how many were good?
- **Recall**: of good opportunities, how many did you catch?

The precision–recall curve is the right tool because it explicitly shows the tradeoff between precision and recall across thresholds.  
Source: scikit-learn documentation on precision–recall curves and operating points. https://scikit-learn.org/stable/auto_examples/model_selection/plot_precision_recall.html

Treat each threshold choice as an operating point.

---

## 3) A Threshold Is an Operating Point (Not a “Setting”)

Every threshold is a policy choice:

- Low threshold: high recall, low precision (chatty)
- High threshold: low recall, high precision (quiet)

Most teams tune thresholds based on vibes.

Instead, tune them based on the cost of errors:

- False positive cost: user gets spammed, loses trust, enters bad trades
- False negative cost: user misses a great move

If your product promise is “only the top signals,” accept lower recall and optimize precision.
If your promise is “never miss big moves,” accept more noise and optimize recall.

---

## 4) Stratify Your Backtest (or You Will Overfit)

The fastest way to overfit is to calibrate one global threshold.

Markets aren’t one distribution.

Stratify by at least:

### A) Liquidity tier

Liquidity changes everything (spread, impact, fill reliability). A $10k trade means different things in:
- a thick book with tight spreads
- a thin book with wide spreads

### B) Market category

Crypto minute markets are not election markets.
Sports markets are not geopolitical markets.

### C) Regime / time period

News-driven months behave differently from quiet months.

Implementation tip:

Build a backtest table where each row is an alert candidate and add columns:
- liquidity bucket
- category tag
- timestamp bucket (week/month)

Then calibrate per bucket, or at least validate per bucket.

---

## 5) The Calibration Loop (What to Actually Do)

Here’s the loop that works:

### Step 1 — Generate candidates

Start with a permissive candidate set:
- trades above a USD threshold
- wallets above a score threshold
- markets above a minimum liquidity threshold

### Step 2 — Label outcomes

For each candidate alert:
- compute forward returns or take-profit/stop-loss outcomes
- store the label (good/bad) and the magnitude

### Step 3 — Sweep thresholds

Choose a parameterization:

- min trade size (USD)
- min wallet score
- min confidence
- cooldown window

Then grid-sweep and compute precision/recall for each combo.

### Step 4 — Pick operating points per segment

Pick thresholds per segment (liquidity × category). Prefer stable points that:
- don’t swing wildly week to week
- survive regime splits

### Step 5 — Validate out-of-sample

Use a time split:
- train: older period
- validate: recent period

Do not randomly shuffle; time order matters.

---

## 6) Preventing Overfitting: Three Guardrails

### Guardrail A — Penalize complexity

If a threshold set requires 12 special cases, it will die in production.

Prefer a simpler policy that’s slightly worse in-sample but stable.

### Guardrail B — Freeze thresholds for a period

Re-tuning daily is how you chase noise.

Set a cadence:
- weekly or biweekly recalibration
- but only change if metrics move beyond a band

### Guardrail C — Audit failures, don’t hide them

Keep an “alert postmortem” log:
- which segments are noisy
- which segments miss moves
- what changed (liquidity, fees, market structure)

---

## 7) A Practical Baseline Policy (Good Enough to Start)

If you want a baseline that is usually sane:

1. Require a minimum wallet quality (score / historical performance)
2. Require minimum market liquidity (avoid thin traps)
3. Use a cooldown per wallet per market (avoid spam)
4. Segment by category: crypto vs everything else
5. For fee-enabled markets, widen thresholds near 50% probability where fees peak (execution cost matters more)

Polymarket documents that some market types have taker fees enabled and describes how fees vary with price (peaking near 50%).  
Source: Polymarket “Fees” documentation. https://docs.polymarket.com/trading/fees

---

## 8) How This Maps to SightWhale

Our job isn’t to alert on “large trades.”
It’s to alert on trades that are:
- large enough to matter
- made by wallets that repeat
- in markets where execution is feasible

If you want to calibrate your own alerts, use:
- [/backtesting](/backtesting)

If you want the calibrated stream (quiet, high-signal), upgrade:
- [/subscribe](/subscribe)

---

## Sources (External)

- Precision–recall curve explanation and threshold tradeoffs (operating points): https://scikit-learn.org/stable/auto_examples/model_selection/plot_precision_recall.html
- Polymarket fees (fee curve; fee-enabled markets; fee-rate endpoint): https://docs.polymarket.com/trading/fees
