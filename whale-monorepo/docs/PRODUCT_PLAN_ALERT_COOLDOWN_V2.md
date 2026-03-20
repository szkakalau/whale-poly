# Product iteration plan: per-source dynamic cooldown + digest (minimal change, easy rollback)

**Owner:** Eng + Product  
**Goal:** Cooldown key = `user + source_type + source_id`; stronger signals get shorter cooldowns and can bypass; weaker signals batch into a digest instead of being dropped. **Rollback** = one env flag to restore current behavior.

---

## 0) Current state (as of repo)

| Layer | What exists | Gap vs target |
|--------|-------------|----------------|
| **Telegram fanout** (`services/telegram_bot/api_no_polling.py`, `api.py`) | Per-`telegram_id` global RPM limit (`rate_limit.allow_send` → key `rl:{tid}`). Plan delay / PRO confidence filter / ELITE low-signal delay. | No per-source cooldown; merged `recipient_plan_map = {**follow, **collection, **smart}` **drops** duplicate `tid` and **loses** which source matched. |
| **Alert engine** (`services/alert_engine/engine.py`) | Redis cooldown `cooldown:{wallet}:{market}` (event dedupe before fanout). | Orthogonal to **user-facing** per-source Telegram pacing; keep as-is unless you want one place for all throttling. |
| **In-app alerts** (`services/landing/.../api/alerts/route.ts`) | Dedup already scoped by `user_id + source_type + source_id`; fixed windows via `ALERTS_WHALE_COOLDOWN_MINUTES` / `ALERTS_COLLECTION_COOLDOWN_MINUTES`. | Not aligned with `effective_score` / digest / tier multipliers yet. |

**Prerequisite for “10 whales don’t block each other” on Telegram:** fanout must know **`(tid, source_type, source_id)` per recipient**, not a single dict keyed only by `tid`.

---

## 1) Target behavior (your spec, frozen for v1)

### 1.1 Cooldown key

```
cooldown_key = f"{telegram_id}:{source_type}:{source_id}"
```

- `source_type`: `whale` | `collection` (legacy `Collection`) | `smart_collection` (name TBD; must match DB + observability).
- `source_id`: wallet address (lowercase) for `whale`; collection UUID for collection types.

### 1.2 Unified score

```
effective_score = whale_score + log10(max(notional_usd, 1)) * 5
```

- **v1 guardrails:** cap `notional_usd` (e.g. max $10M) to avoid log blowing up; if `notional` missing, use `size` from payload or treat as `1`.
- **Observability:** log `effective_score` + components on send/digest for tuning.

### 1.3 Base dynamic cooldown (before tier multiplier)

| effective_score | Base cooldown |
|-----------------|---------------|
| ≥ 95 | 60s |
| ≥ 90 | 120s |
| ≥ 85 | 5m |
| ≥ 80 | 10m |
| else | 15m |

### 1.4 Strong signal bypass (eligible tiers only)

If `effective_score > last_pushed_effective_score + 5` for **the same `cooldown_key`**, allow immediate send (still subject to Telegram API / safety caps below).

### 1.5 Digest (no silent drop)

If in cooldown and not bypassing:

- Append event to **Redis buffer** keyed by `cooldown_key` (list or capped ZSET by time).
- **Flush digest** when:
  - cooldown window **ends** for that key, or
  - buffer size **≥ N** (default `5`), or
  - optional: max wait `T_max` (e.g. 30m) so nothing stalls forever.

Digest message format (v1): short HTML/plain list: market, wallet snippet, effective_score, time — **one Telegram message**.

### 1.6 Tier matrix (product)

| Tier | Cooldown multiplier | Bypass | Digest |
|------|---------------------|--------|--------|
| Free | ×2 | ❌ | Summary only (single digest message; optional truncate) |
| Pro | ×1 | ✅ | Standard digest |
| Elite | ×0.5 | ✅ (same threshold; **shorter** cooldown from multiplier → effectively more aggressive) | Standard digest + optional “real-time” for top band |

**Elite extras (Phase 2+, behind flags):**

- Drop low `effective_score` entirely (floor configurable).
- “Top 20% alpha” = percentile within user’s followed set or global precomputed tier — **define metric before building** (e.g. Whale Score + notional floor).

---

## 2) Rollback strategy (non-negotiable)

1. **Single kill switch:** e.g. `ALERT_COOLDOWN_V2_ENABLED=0` (default `0` in first deploy).
2. When disabled: existing `_send_with_rules` path unchanged — global `allow_send`, plan delays, PRO filter.
3. **Redis keys** for v2 prefixed: `cd2:{cooldown_key}` / `dig2:{cooldown_key}` so disabling v2 does not touch legacy keys.
4. **Deploy order:** ship recipient refactor + flag off → monitor → flag on for internal chat / small % → full.

---

## 3) Phased delivery (minimal diff per phase)

### Phase A — Recipient model fix (required, low UX risk)

**Status:** Implemented in `services/telegram_bot/recipients.py`, wired into `api_no_polling.py` and `api.py` (subscriber cache key bumped to `subs2:` for payload with `source_id`).

**Scope:**

- Replace `recipient_plan_map: dict[tid, plan]` merge with **`list[Recipient]`**:
  - `telegram_id`, `plan`, `source_type`, `source_id`, (optional) `smart_collection_id` / `collection_id`.
- SQL: three queries return rows with explicit source metadata; **append** to list instead of dict merge.
- **Dedup rule for same trade:** same `(tid, whale_trade_id, source_type, source_id)` → one send path. If same `tid` matches **multiple** sources for **one** trade, v1 choice:
  - **Option A (minimal):** one Telegram per `(tid, whale_trade_id)`; use **max `effective_score`** for cooldown/bypass; still update **per-source** cooldown state **if** product wants separate throttle for future events (recommended: **update all matched sources’ last_pushed score** or only primary — document choice).
  - **Option B:** allow multiple messages per trade (usually noisy; not recommended).

**Files:** `api_no_polling.py`, `api.py` (mirror), possibly small helper `recipient_resolution.py`.

**Rollback:** revert commit or feature-flag the new list path (keep dict path behind `if not USE_RECIPIENT_V2`).

---

### Phase B — Redis per-source cooldown + bypass (core)

**Status:** Implemented in `services/telegram_bot/delivery_cooldown.py`, wired into `api_no_polling.py` and `api.py`. **Default off** — set `ALERT_COOLDOWN_V2_ENABLED=1` to enable.

**Env (optional):** `COOLDOWN_V2_DIGEST_MAX`, `COOLDOWN_V2_NOTIONAL_CAP_USD`, `COOLDOWN_V2_NOTIONAL_FLOOR_USD`, `COOLDOWN_V2_BYPASS_DELTA`, `COOLDOWN_V2_MIN_SECONDS`, `COOLDOWN_V2_STATE_TTL_SECONDS`.


**Scope:**

- After Phase A, inside `_send_with_rules` (or extracted `delivery_policy.py`):

  1. Compute `effective_score`.
  2. Load Redis: `last_push_at`, `last_pushed_effective_score` for `cooldown_key`.
  3. Compute `cooldown_seconds = base_cooldown(effective_score) * tier_multiplier(plan)`.
  4. If eligible for bypass and `effective_score > last_pushed_effective_score + 5` → send now.
  5. Else if `now - last_push_at < cooldown_seconds` → **digest enqueue** (Phase C) or **drop** if digest not ready yet (Phase B-only: temporary **no-op drop** is bad — prefer ship B+C together or B with “enqueue digest stub”).

**Redis schema (example):**

- Hash `cd2:{cooldown_key}`: `last_at`, `last_effective_score`
- TTL optional; or rely on explicit timestamps only.

**Files:** `telegram_bot/*`, new `cooldown_v2.py` (or `services/telegram_bot/delivery_cooldown.py`).

**Safety cap:** keep existing `allow_send(rl:{tid})` as **hard** global ceiling so one user can’t spam Telegram if many sources fire.

---

### Phase C — Digest buffer + flush

**Status:** Same module + `format_digest_lines` in `templates.py`. Per-`telegram_id` Redis list `dig2:{tid}`; flush when buffer ≥ `COOLDOWN_V2_DIGEST_MAX` (default 5) or when a later event clears cooldown and merges backlog into the next outbound message.


**Scope:**

- `RPUSH dig2:{cooldown_key} json_payload` (cap list length, e.g. 20).
- Background: on cooldown expiry, **scheduled task** or **lazy flush** when next event arrives and sees expired window.
- **Flush trigger:** cooldown end OR len ≥ N OR `T_max`.
- Flush sends **one** `format_digest(...)` message; increment daily limit **once** per digest (product decision: count as 1 alert vs N — recommend **1** for Free fairness).

**Complexity note:** “cooldown ends” requires **timer** per key — options:

- **v1 pragmatic:** no timer; flush when **next** event hits the key and sees `now >= last_at + cooldown` **before** processing new event; plus length ≥ N flush immediately. (Edge case: long silence → rely on `T_max` sweep job or admin flush.)
- **v2:** Redis keyspace notifications / small worker with delayed queue (ZSET score = flush time).

**Files:** digest helper + template in `templates.py`.

---

### Phase D — Landing `alert_events` parity (optional but consistent)

**Status:** Implemented in `services/landing/src/lib/alertCooldown.ts` + `app/api/alerts/route.ts`.

- Set `ALERT_EVENTS_DYNAMIC_COOLDOWN=1` to use the same `effective_score` + tier multipliers + `COOLDOWN_V2_MIN_SECONDS` / notional cap+floor as `delivery_cooldown.py`.
- Ingest body may include `size` / `amount` (USD) for accurate `effective_score`; if omitted, notional defaults to floor (1).
- When the flag is off, legacy `ALERTS_WHALE_COOLDOWN_MINUTES` / `ALERTS_COLLECTION_COOLDOWN_MINUTES` apply.

---

### Phase E — Elite “top 20% / drop low”

**Status:** Implemented in `services/telegram_bot/elite_filters.py`; called from `api.py` / `api_no_polling.py` **before** cooldown/digest.

- `ELITE_DELIVERY_FILTERS_ENABLED=1` — master switch (default off).
- `ELITE_MIN_EFFECTIVE_SCORE` — drop ELITE Telegram sends below this combined score (set `0` to disable floor only). Default `78` when unset; only enforced when filters enabled.
- `ELITE_TOP_PERCENT_OF_FOLLOWS` — e.g. `20` keeps only alerts where the acting wallet’s `whale_stats.whale_score` is in the **top 20%** among that user’s **enabled** `whale_follows` (requires a **direct** `whale` match in `matched_group`. Collection-only matches skip this rule.)
- DB errors: **fail open** (allow send) to avoid silent total outage.

---

## 4) Config surface (all tunable without redeploy if using YAML)

Extend `alert_engine_config.yaml` (or new `delivery_config.yaml`):

```yaml
delivery_cooldown_v2:
  enabled: false          # master + env override
  digest_max_items: 5
  digest_stale_max: 30m
  effective_score:
    notional_cap_usd: 10_000_000
    notional_floor_usd: 1
  tiers:
    - min_effective: 95
      base_cooldown: 60s
    # ...
  tier_multipliers:
    FREE: 1.0  # actually ×2 per product — use 2.0
    PRO: 1.0
    ELITE: 0.5
  bypass:
    delta: 5
    plans: ["PRO", "ELITE"]   # FREE off
```

Env overrides for rollback / firefighting: `ALERT_COOLDOWN_V2_ENABLED`, `DIGEST_MAX_ITEMS`, etc.

---

## 5) Metrics & QA

- Counters: `cooldown_blocked`, `cooldown_bypass`, `digest_flushed`, `digest_items`, per plan.
- Dashboards: p50/p95 lag from trade → Telegram by `effective_score` band.
- **Load test:** 10 whales same user, alternating fires → verify independent keys.
- **Regression:** PRO still filters low confidence **before** cooldown (existing rule) unless product wants cooldown to apply after filter (document order: filter → cooldown → digest).

---

## 6) Open product decisions (resolve before Phase B ships)

1. **One trade, user matched via follow + smart collection:** one message or two? (Recommend one message, primary source = max score.)
2. **Daily alert limit (Free):** digest counts as 1 or N?
3. **Bypass + global RPM:** if bypass fires 5 times in 10s, still cap with `allow_send` — acceptable latency?
4. **Collection vs smart_collection** naming in `source_type` for analytics parity with `alert_events`.

---

## 7) Summary

| Phase | User-visible effect | Rollback |
|-------|---------------------|----------|
| A | Correct multi-whale routing; fixes lost source | Flag / revert |
| B | Per-source dynamic cooldown + bypass | `ALERT_COOLDOWN_V2_ENABLED=0` |
| C | No lost signals in cooldown | Disable digest; falls back to drop unless B ships with safe default |
| D | Web app matches Telegram policy | Independent |

**Smallest “complete” slice:** **A + B + C** behind one flag, default off until QA passes.
