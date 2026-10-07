"""Contract tests for startup reconciliation (`services.unified.reconcile`).

Why this file exists
--------------------
The reconciliation path was silently dead in production. The observable fact
was that `pipeline_reconciliation_done` had **zero** occurrences in the logs
while `pipeline_reconciliation_failed` had six — one per restart on
2026-10-05/07, each landing ~1 ms before `Application startup complete`.

Root cause: stage 1 used ``trade_id NOT IN (SELECT trade_id FROM whale_trades)``.
Postgres plans that as a per-row linear probe of a MATERIALISED sub-select
(estimated cost 4_638_578) instead of an anti-join (5_299 for the NOT EXISTS
form) — 56.5k window rows x 63k whale_trade ids. It blew the 20 s
`statement_timeout` this module sets for itself, and because **all stages
shared one session**, the cancellation rolled the transaction back and skipped
every later stage. The whole restart-recovery path never ran.

So the tests below pin four properties that the incident showed were load
bearing:

  * no `NOT IN` anti-join anywhere (the 875x cost trap);
  * each stage runs in isolation, so one failure cannot abort the rest;
  * the claim release (stage 0) runs FIRST and actually COMMITS — it is the
    only stage whose failure mode is permanent;
  * its age cutoff exceeds the longest legitimate in-flight window, otherwise a
    rolling deploy steals a live claim and the subscriber gets the alert twice.

Compiled-SQL assertions use the real PostgreSQL dialect; no database is
required (CI has none).
"""
from __future__ import annotations

import ast
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy.dialects import postgresql

from services.unified import reconcile as R

MODULE_PATH = Path(R.__file__)
SRC = MODULE_PATH.read_text(encoding="utf-8")
DIALECT = postgresql.dialect()

EXPECTED_STAGES = [
    "reconciled_stale_pending",
    "reconciled_raw_trades",
    "reconciled_whale_trades",
    "reconciled_alerts",
]


# ── helpers ──────────────────────────────────────────────────────────────────

def _func(name: str, src: str = SRC) -> ast.AsyncFunctionDef | ast.FunctionDef:
    tree = ast.parse(src)
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return node
    raise AssertionError(f"{name} not found")


def _callee_of(node: ast.AST) -> str | None:
    """Name of the function a Call/Lambda ultimately invokes."""
    if isinstance(node, ast.Lambda):
        return _callee_of(node.body)
    if isinstance(node, ast.Call):
        f = node.func
        if isinstance(f, ast.Name):
            return f.id
        if isinstance(f, ast.Attribute):
            return f.attr
    if isinstance(node, ast.Name):
        return node.id
    return None


def _called_names(node: ast.AST) -> set[str]:
    """Every attribute/method actually *called* inside `node`.

    Deliberately not a substring search over ast.dump: a docstring that merely
    mentions `commit` must not satisfy a test that requires commit() to be
    called. (A mutation test caught exactly that false pass.)
    """
    names: set[str] = set()
    for n in ast.walk(node):
        if isinstance(n, ast.Call):
            f = n.func
            if isinstance(f, ast.Attribute):
                names.add(f.attr)
            elif isinstance(f, ast.Name):
                names.add(f.id)
    return names


def _referenced_names(node: ast.AST) -> set[str]:
    """Every bare Name *read* inside `node` (excludes docstrings)."""
    return {n.id for n in ast.walk(node) if isinstance(n, ast.Name)}


def _string_constants(node: ast.AST) -> str:
    """All string literals in `node`, concatenated (includes f-string parts)."""
    out: list[str] = []
    for n in ast.walk(node):
        if isinstance(n, ast.Constant) and isinstance(n.value, str):
            out.append(n.value)
    return "\n".join(out)


def _stage_calls(src: str = SRC) -> list[tuple[str, str]]:
    """Every `_run_stage(<key>, summary, <target>)` as (key, target-name)."""
    out: list[tuple[str, str]] = []
    for node in ast.walk(_func("reconcile_pipeline_on_startup", src)):
        if not isinstance(node, ast.Call):
            continue
        if not (isinstance(node.func, ast.Name) and node.func.id == "_run_stage"):
            continue
        key = node.args[0].value if isinstance(node.args[0], ast.Constant) else "<dynamic>"
        target = _callee_of(node.args[2]) if len(node.args) > 2 else None
        out.append((key, target or "<unknown>"))
    return out


def _sql(stmt) -> str:
    return str(stmt.compile(dialect=DIALECT))


def _params(stmt) -> dict:
    return dict(stmt.compile(dialect=DIALECT).params)


SINCE = datetime.now(timezone.utc) - timedelta(hours=48)


# ── the anti-join trap ───────────────────────────────────────────────────────

class TestNoNotInAntiJoin:
    """`NOT IN (subquery)` is the bug that killed reconciliation in prod."""

    def test_module_contains_no_not_in_subquery(self):
        assert ".in_(select(" not in SRC, (
            "a NOT IN (subquery) anti-join is back; it is ~875x more expensive "
            "than NOT EXISTS and will blow the statement_timeout"
        )

    def test_stage1_emits_a_correlated_not_exists(self):
        sql = _sql(R.raw_trades_missing_stmt(SINCE, 2000))
        assert "NOT (EXISTS (" in sql
        assert sql.count("EXISTS") == 1
        # correlated: the inner query references the outer table
        assert "whale_trades.trade_id = trades_raw.trade_id" in sql
        assert "NOT IN" not in sql.upper()

    def test_stage2_emits_a_correlated_not_exists(self):
        sql = _sql(R.whale_trades_missing_stmt(SINCE, 2000))
        assert "NOT (EXISTS (" in sql
        assert "alerts.whale_trade_id = whale_trades.id" in sql
        assert "NOT IN" not in sql.upper()

    def test_stage1_keeps_its_window_order_and_cap(self):
        """The rewrite must not have changed what the stage selects."""
        sql = _sql(R.raw_trades_missing_stmt(SINCE, 2000))
        assert "trades_raw.timestamp >=" in sql
        assert "ORDER BY trades_raw.timestamp" in sql
        assert "LIMIT" in sql


# ── stage isolation: the property whose absence hid the bug ──────────────────

class TestStageIsolation:
    def test_all_stages_go_through_run_stage(self):
        calls = _stage_calls()
        assert len(calls) == len(EXPECTED_STAGES)
        assert [k for k, _ in calls] == EXPECTED_STAGES

    def test_stage0_is_the_claim_release_and_runs_first(self):
        calls = _stage_calls()
        key, target = calls[0]
        assert key == "reconciled_stale_pending"
        assert target == "release_stale_pending_claims"

    def test_run_stage_swallows_the_exception_and_records_it(self):
        summary: dict = {"failed_stages": []}

        async def boom():
            raise RuntimeError("stage exploded")

        asyncio.run(R._run_stage("reconciled_raw_trades", summary, boom))
        assert summary["reconciled_raw_trades"] == 0
        assert summary["failed_stages"] == ["reconciled_raw_trades"]

    def test_a_failed_stage_does_not_prevent_later_stages(self, monkeypatch):
        """The exact prod failure: stage 1 died, so stages 2/3 never ran."""
        ran: list[str] = []

        async def release():
            ran.append("stage0")
            return 3

        async def stage1(redis, since, max_items):
            ran.append("stage1")
            raise RuntimeError("QueryCanceledError: statement timeout")

        async def stage2(redis, since, max_items):
            ran.append("stage2")
            return 7

        async def stage3(redis, since, max_items):
            ran.append("stage3")
            return 11

        monkeypatch.setattr(R, "release_stale_pending_claims", release)
        monkeypatch.setattr(R, "_reenqueue_missing_whale_trades", stage1)
        monkeypatch.setattr(R, "_reenqueue_missing_alerts", stage2)
        monkeypatch.setattr(R, "_reenqueue_undelivered_alerts", stage3)

        summary = asyncio.run(R.reconcile_pipeline_on_startup(redis=None))

        assert ran == ["stage0", "stage1", "stage2", "stage3"], (
            "a failing stage must not stop the ones after it"
        )
        assert summary["reconciled_stale_pending"] == 3
        assert summary["reconciled_raw_trades"] == 0
        assert summary["reconciled_whale_trades"] == 7
        assert summary["reconciled_alerts"] == 11
        assert summary["failed_stages"] == ["reconciled_raw_trades"]

    def test_stage0_runs_even_if_it_is_the_one_that_fails(self, monkeypatch):
        ran: list[str] = []

        async def release():
            ran.append("stage0")
            raise RuntimeError("reaper blew up")

        async def ok(*a, **k):
            ran.append("later")
            return 1

        monkeypatch.setattr(R, "release_stale_pending_claims", release)
        monkeypatch.setattr(R, "_reenqueue_missing_whale_trades", ok)
        monkeypatch.setattr(R, "_reenqueue_missing_alerts", ok)
        monkeypatch.setattr(R, "_reenqueue_undelivered_alerts", ok)

        summary = asyncio.run(R.reconcile_pipeline_on_startup(redis=None))
        assert ran.count("later") == 3
        assert summary["failed_stages"] == ["reconciled_stale_pending"]

    def test_done_is_logged_even_when_every_stage_fails(self, monkeypatch, caplog):
        async def boom(*a, **k):
            raise RuntimeError("nope")

        for name in (
            "release_stale_pending_claims",
            "_reenqueue_missing_whale_trades",
            "_reenqueue_missing_alerts",
            "_reenqueue_undelivered_alerts",
        ):
            monkeypatch.setattr(R, name, boom)

        with caplog.at_level(logging.INFO, logger="unified.reconcile"):
            summary = asyncio.run(R.reconcile_pipeline_on_startup(redis=None))

        assert "pipeline_reconciliation_done" in caplog.text
        # the failing stages are named, so a partial run is not silently green
        assert len(summary["failed_stages"]) == 4
        assert "reconcile_stage_failed" in caplog.text

    def test_summary_always_carries_every_stage_key(self, monkeypatch):
        async def ok(*a, **k):
            return 0

        for name in (
            "release_stale_pending_claims",
            "_reenqueue_missing_whale_trades",
            "_reenqueue_missing_alerts",
            "_reenqueue_undelivered_alerts",
        ):
            monkeypatch.setattr(R, name, ok)

        summary = asyncio.run(R.reconcile_pipeline_on_startup(redis=None))
        for key in EXPECTED_STAGES:
            assert key in summary
        assert summary["failed_stages"] == []


# ── the claim release: correctness of the statement itself ───────────────────

class TestStalePendingReleaseStatement:
    def _stmt(self, cutoff: datetime | None = None):
        return R.stale_pending_release_stmt(cutoff or datetime.now(timezone.utc))

    def test_only_touches_pending_rows(self):
        """A 'sent' row must never be downgraded (P3)."""
        stmt = self._stmt()
        sql = _sql(stmt)
        assert "UPDATE deliveries" in sql
        assert "deliveries.status = " in sql
        assert _params(stmt)["status_1"] == "pending"

    def test_filters_on_age_so_a_live_claim_is_left_alone(self):
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=600)
        stmt = R.stale_pending_release_stmt(cutoff)
        sql = _sql(stmt)
        assert "deliveries.updated_at < " in sql
        assert _params(stmt)["updated_at_1"] == cutoff

    def test_marks_rows_failed_with_a_greppable_reason(self):
        params = _params(self._stmt())
        assert params["status"] == "failed"
        assert params["error"] == "reconcile_stale_pending"

    def test_touches_updated_at_so_a_second_pass_cannot_re_fire(self):
        assert "updated_at=now()" in _sql(self._stmt()).replace(" ", "")

    def test_there_is_no_null_updated_at_escape_hatch(self):
        """A 'pending' row always has updated_at set, so `<` is sufficient.

        Pinned because a NULL updated_at would make the comparison NULL and the
        row un-releasable forever; the claim statement is what guarantees it is
        never NULL, so losing that guarantee must fail here loudly.
        """
        assert "IS NULL" not in _sql(self._stmt())


class TestClaimReleaseCommits:
    """`async with SessionLocal()` CLOSES (rolls back) on exit — it never commits."""

    def test_release_commits_explicitly(self):
        called = _called_names(_func("release_stale_pending_claims"))
        assert "commit" in called, (
            "release_stale_pending_claims must call session.commit(); without it "
            "the UPDATE is discarded when the async-with block exits. Note: the "
            "docstring happens to contain the word 'commits', which is why this "
            "checks call nodes rather than the source text."
        )

    def test_no_other_stage_needs_a_commit(self):
        """Stages 1-3 only read from the DB (they write to redis), so a commit
        there would be a smell — and its absence is why stage 1's rollback used
        to be harmless for them and fatal for stage 0."""
        for name in (
            "_reenqueue_missing_whale_trades",
            "_reenqueue_missing_alerts",
            "_reenqueue_undelivered_alerts",
        ):
            assert "commit" not in _called_names(_func(name)), name

    def test_stage0_owns_its_own_session(self):
        """Its session must not be shared with the heavy stages."""
        orchestrator = _func("reconcile_pipeline_on_startup")
        # the orchestrator must not open a session itself any more
        assert "SessionLocal" not in _referenced_names(orchestrator), (
            "reconcile_pipeline_on_startup should not hold a session; each stage "
            "must own one so a rollback cannot span stages"
        )
        assert "SessionLocal" in _called_names(_func("release_stale_pending_claims"))



# ── the duplicate-send guard on the cutoff ───────────────────────────────────

class TestCutoffExceedsInFlightWindow:
    """A rolling deploy must not steal a claim the outgoing container still holds.

    The outgoing container can legitimately hold a claim for up to the slowest
    tier's delay (free tier: 5m) plus a 30 s send timeout. If the cutoff were
    shorter than that, the new container would flip a live claim to 'failed',
    replay it, and the old container — which does not re-check the ledger before
    sending — would deliver the same alert again.
    """

    def test_default_cutoff_exceeds_the_longest_legitimate_claim(self):
        assert R.STALE_PENDING_AFTER_SECONDS >= R.MAX_LEGITIMATE_INFLIGHT_SECONDS

    def test_inflight_bound_accounts_for_the_slowest_tier_delay(self):
        # free tier alerts_delay is 5m; PRO/ELITE are 0m
        assert R.MAX_LEGITIMATE_INFLIGHT_SECONDS >= 300
        # plus the 30s send timeout used by both send paths
        assert R.MAX_LEGITIMATE_INFLIGHT_SECONDS >= 330

    def test_cutoff_is_operator_tunable_via_env(self):
        assert "RECONCILE_STALE_PENDING_AFTER_SECONDS" in SRC
        assert "STALE_PENDING_AFTER_SECONDS" in _referenced_names(
            _func("release_stale_pending_claims")
        )

    def test_every_stage_keeps_its_statement_timeout(self):
        """Deploy-blocking is the reason the timeout exists; all four stages need
        it, including the new stage 0 (which is fast but must not hang startup)."""
        for name in (
            "release_stale_pending_claims",
            "_reenqueue_missing_whale_trades",
            "_reenqueue_missing_alerts",
            "_reenqueue_undelivered_alerts",
        ):
            assert "SET LOCAL statement_timeout" in _string_constants(_func(name)), name
