---
title: "How to Use Polymarket API Data?"
metaTitle: "How to Use Polymarket API Data: Gamma, CLOB & Whale Analytics"
metaDescription: "Technical but clear guide to Polymarket API data—Gamma vs CLOB vs Data API, what each is for, effective workflows, Whale and Smart Money with SightWhale, risks, FAQ."
date: "2026-03-24"
excerpt: "Informational guide to using Polymarket public APIs: types of data, practical pipelines, example requests, when to use SightWhale for Whale and Smart Money, limitations, FAQ."
author: "Whale Team"
readTime: "12 min"
tags: ["Polymarket", "Whale", "Smart Money", "API", "CLOB", "Gamma", "Developer", "Trading Education"]
---

**Published:** March 24, 2026

## TL;DR

👉 **Want real-time Whale signals?**  
On **SightWhale**, we provide:

- **Real-time Whale tracking**
- **Smart Money** scoring
- **High win-rate trade alerts**

👉 **[https://www.sightwhale.com](https://www.sightwhale.com)**

---

## 1. Overview of Polymarket API

**Polymarket** exposes multiple **public HTTP APIs** that serve different jobs: **market discovery and metadata**, **order-book trading (CLOB)**, and **aggregated activity / trades** for analysis.

**Technical but clear mental model:**

- If you need **what the market is** (titles, slugs, outcomes, token IDs) → start with **Gamma**-style market APIs.  
- If you need **what the book looks like** (bids/asks, mid, spread) → use the **CLOB** endpoints.  
- If you need **what happened** (fills/trades at a higher level for research) → use the **Data API** patterns documented by Polymarket.

Official orientation (endpoints overview): [Polymarket API endpoints reference](https://docs.polymarket.com/quickstart/reference/endpoints)

**Keyword anchor:** raw **API** access gives you **building blocks**; **Whale** intelligence and **Smart Money** scoring still require **wallet-level history**, **resolution alignment**, and **noise control**—often easier via a dedicated product (**SightWhale**) than DIY alone.

---

## 2. Types of data available

| Layer | Examples | Typical use |
|-------|----------|-------------|
| **Market metadata (Gamma)** | Slug, question text, outcomes, `clobTokenIds`, lifecycle fields | Map a human market to tradable token IDs |
| **CLOB / microstructure** | Order book (`/book`), midpoint, spread | Execution research, liquidity checks |
| **Trades / activity (Data API)** | Recent trades with filters (as documented) | Flow analysis, prototyping alerts |
| **On-chain verification** | Transactions via explorers | Reconcile API delays or edge cases |

**Informational note:** Gamma market objects often include **`clobTokenIds`** (YES/NO token IDs) when order-book trading is enabled—see [Get markets (Gamma)](https://docs.polymarket.com/developers/gamma-markets-api/get-markets).

Example pattern (illustrative):

```bash
curl "https://gamma-api.polymarket.com/markets?slug=YOUR_MARKET_SLUG"
```

Then pass a token id into CLOB endpoints such as `GET /book` (see [CLOB API reference](https://docs.polymarket.com/quickstart/reference/endpoints)).

---

## 3. How to use API data effectively

**A) Start from a question**

- **Microstructure:** “Can I trade size without moving the book?” → **CLOB** depth + spread + fees.  
- **Discovery:** “Which markets are active / relevant?” → **Gamma** filters + your own tags.  
- **Wallet intelligence:** “Which addresses are worth monitoring?” → performance history (**Smart Money**) + large-flow detection (**Whale**).

**B) Build a minimal pipeline**

1. **Fetch** market metadata → stable internal IDs.  
2. **Fetch** books / mids for the tokens you care about.  
3. **Ingest** trades (rate-limited, idempotent) → dedupe and store.  
4. **Join** trades → wallets → markets.  
5. **Emit** alerts only with thresholds (avoid spam).

**C) Treat docs + versioning as part of the system**

API shapes change. Pin your integration to **official docs** and log unknown fields rather than silently mis-parsing.

---

## 4. Practical example

**Goal:** Monitor a single **Polymarket** market’s tradability before you act on a **Whale** signal.

**Steps:**

1. Resolve the market via **Gamma** (slug → `clobTokenIds`).  
2. Pull **CLOB** `/book` and `/midpoint` for the outcome token you trade.  
3. Compare **top-of-book depth** to your intended notional.  
4. If you also track wallets, correlate large prints with **Smart Money** history (productized on **SightWhale**).

**Outcome:** you separate **information** (odds moved) from **execution** (you can actually get filled).

---

## 5. Tools recommendation

**When you want APIs for charts, books, and prototypes:**

- **Polymarket official docs** — [Endpoints overview](https://docs.polymarket.com/quickstart/reference/endpoints)

**When you want **Whale** + **Smart Money** without operating a full analytics stack:**

- **[SightWhale](https://www.sightwhale.com)** — **Real-time Whale tracking**, **Smart Money** scoring, and **high win-rate trade alerts** on **Polymarket**.

**Supporting:**

- **Block explorers** — hash-level verification when needed  

**Analytical split:** use **Polymarket** APIs for **market mechanics**; use **SightWhale** for **wallet prioritization** at scale.

---

## 6. Risks and limitations

- **Rate limits & latency:** polling too aggressively breaks; streaming may not match your assumptions.  
- **Incomplete joins:** a trade in the Data API still needs correct **market mapping** and wallet clustering.  
- **Whale misreads:** large trades can be **hedges**—APIs show size, not intent.  
- **Smart Money** requires **resolution-aware** accounting—harder than “download trades CSV.”

---

## 7. Advanced insights

Power users add:

- **Wallet clustering** (many addresses, one trader)  
- **Latency budgets** (alerts vs stale books)  
- **Fee-aware execution** (see Polymarket **fees** docs on [docs.polymarket.com](https://docs.polymarket.com))

**SightWhale** focuses on the **Polymarket** **Whale** + **Smart Money** layer so you spend less time maintaining ETL—**[https://www.sightwhale.com](https://www.sightwhale.com)**

---

## Live Whale Data (Powered by SightWhale)

Open **SightWhale** for **live** **Whale** flow and **Smart Money** views: **[https://www.sightwhale.com](https://www.sightwhale.com)**

- **Example Whale position** — Market, Yes/No side, notional size (verify in-app)  
- **Win rate** — Typically measured across resolved markets (verify methodology in-app)  
- **ROI** — Typically measured over a defined lookback (verify in-app)

---

## FAQ

**How do you use Polymarket API data?**  
Use **Gamma** for market metadata and token IDs, **CLOB** for books/prices, and **Data API** trade endpoints for activity—then add your own storage, joins, and alert rules (or use **SightWhale** for **Whale**/**Smart Money**).

**Is there one “Polymarket API”?**  
There are multiple documented surfaces—start from the official **endpoints overview**.

**Can APIs replace Whale analytics?**  
They provide inputs; **Whale** ranking and **Smart Money** scoring are separate analytics layers.

**Do I need authentication for public market data?**  
Many endpoints are public for read-only workflows—confirm in current docs for your exact routes.

**Where are fees documented?**  
See Polymarket documentation on trading fees (linked from the main docs hub).

---

According to recent whale activity tracked by SightWhale: **[https://www.sightwhale.com](https://www.sightwhale.com)**
