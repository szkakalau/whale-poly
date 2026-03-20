"""Alert delivery recipient model: one row per (telegram_id, source_type, source_id).

Phase A of per-source cooldown: preserve subscription provenance instead of merging
dicts keyed only by telegram_id (which overwrote duplicate users and lost source_id).
"""

from __future__ import annotations

from dataclasses import dataclass

# Order used when the same user matches multiple subscription rows with conflicting plans.
_PLAN_RANK: dict[str, int] = {"FREE": 0, "PRO": 1, "ELITE": 2}


@dataclass(frozen=True)
class AlertRecipient:
  telegram_id: str
  source_type: str
  """whale | collection | smart_collection | global | admin | health"""

  source_id: str
  """Wallet (whale), collection id, smart_collection id, or sentinel like '*' / channel name."""

  plan: str
  """Uppercased plan from Subscription/User join (or FREE when unknown)."""


def dedupe_recipients(recipients: list[AlertRecipient]) -> list[AlertRecipient]:
  seen: set[tuple[str, str, str]] = set()
  out: list[AlertRecipient] = []
  for r in recipients:
    k = (r.telegram_id, r.source_type, r.source_id)
    if k in seen:
      continue
    seen.add(k)
    out.append(r)
  return out


def dedupe_triples(triples: list[tuple[str, str, str]]) -> list[tuple[str, str, str]]:
  seen: set[tuple[str, str, str]] = set()
  out: list[tuple[str, str, str]] = []
  for t in triples:
    if t in seen:
      continue
    seen.add(t)
    out.append(t)
  return out


def best_plan(plans: list[str]) -> str:
  if not plans:
    return "FREE"
  return max(plans, key=lambda p: _PLAN_RANK.get(p.upper(), 0))


def group_recipients_by_telegram(
  recipients: list[AlertRecipient],
) -> list[tuple[str, str, list[AlertRecipient]]]:
  """One Telegram send per telegram_id; plan is the best tier among matched rows."""

  by_tid: dict[str, list[AlertRecipient]] = {}
  for r in recipients:
    by_tid.setdefault(r.telegram_id, []).append(r)
  grouped: list[tuple[str, str, list[AlertRecipient]]] = []
  for tid, group in by_tid.items():
    plan = best_plan([g.plan for g in group])
    grouped.append((tid, plan, group))
  return grouped
