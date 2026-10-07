"""Semantic tests for the delivery-outcome ledger (F1) — the claim/finish guards.

WHY THIS FILE EXISTS
--------------------
`tests/test_delivery_ledger.py` checks the *structure* of the send paths with
AST analysis (is every `_finish_delivery(SENT)` call guarded? does the failure
path always re-raise?). Those checks are worth having, but they say nothing
about the `WHERE` clauses that actually implement the ledger's three
properties. Mutation-tested: flipping the claim's `==` to `!=`, flipping the
`sent` guard, and replacing the `failed` guard with `True` all left that file
**fully green**. Those three mutations are precisely the ways this feature can
fail catastrophically:

  * claim guard broken   -> a pair stays claimed forever, so alerts stop being
    delivered and never retry — the exact symptom this investigation started from;
  * `sent` guard broken  -> a delivered alert is re-sent, or a later failure
    overwrites a success;
  * `failed` guard broken -> a failure downgrades an already-successful send.

So the guards are asserted here directly, by compiling the real statements with
the real Postgres dialect. No database is needed, which matters because CI has
no Postgres service (its `DATABASE_URL` points at a host that does not exist).

The final class binds code to schema: the conflict target must match the unique
constraint that actually exists, and every value written must fit the column it
lands in. The latter is not hypothetical — a value overflowing its column is
exactly the bug that was silently dropping hundreds of trades a day before this
ledger work started.
"""
from __future__ import annotations

import ast
import re
from pathlib import Path

from sqlalchemy.dialects import postgresql

from services.telegram_bot import api
from shared.models import Delivery

ROOT = Path(__file__).resolve().parents[1]

MIGRATION_0001 = "alembic/versions/0001_init.py"
MIGRATION_0020 = "alembic/versions/0020_deliveries_status.py"
API = "services/telegram_bot/api.py"


def _read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def _dotted(node) -> str | None:
    """Render an attribute chain (`result.scalar_one_or_none()`) as a string."""
    if isinstance(node, ast.Call):
        return _dotted(node.func)
    if isinstance(node, ast.Attribute):
        base = _dotted(node.value)
        return f"{base}.{node.attr}" if base else node.attr
    if isinstance(node, ast.Name):
        return node.id
    return None


def _compiled(stmt) -> str:
    return str(stmt.compile(dialect=postgresql.dialect()))


def _on_conflict_where(stmt) -> tuple[str, dict]:
    """Return (WHERE clause of ON CONFLICT DO UPDATE, bind params).

    Scoping matters: the `SET` list also contains `status = ...`, so the clause
    must be isolated or an assertion could be satisfied by the SET rather than
    by the guard.
    """
    c = stmt.compile(dialect=postgresql.dialect())
    sql = str(c)
    assert "ON CONFLICT" in sql, f"not an upsert: {sql}"
    after_update = sql.split("DO UPDATE", 1)[1]
    assert "WHERE" in after_update, (
        "the DO UPDATE has no WHERE guard — without one any conflicting row is "
        f"overwritten unconditionally: {sql}"
    )
    where = after_update.split("WHERE", 1)[1].split("RETURNING", 1)[0].strip()
    return where, dict(c.params)


def _guard_value(stmt) -> tuple[str, str]:
    """Return (operator, compared_value) of the DO UPDATE guard.

    Resolves the bind name that appears *inside the WHERE clause* instead of
    searching all params, so the value read is the comparison and not the value
    being written by SET.
    """
    where, params = _on_conflict_where(stmt)
    names = re.findall(r"%\((\w+)\)s", where)
    assert len(names) == 1, f"expected exactly one comparison bind, got {names} in: {where}"
    operator = "!=" if ("!=" in where or "<>" in where) else "="
    return operator, params[names[0]]


def _create_table_columns(src: str, table: str) -> set[str]:
    """Column names declared by one `op.create_table(...)` block."""
    m = re.search(rf'op\.create_table\(\s*"{table}",(.*?)\n\s*\)', src, re.S)
    assert m, f"no op.create_table block found for {table!r}"
    return set(re.findall(r'sa\.Column\(\s*"(\w+)"', m.group(1)))


def _added_columns(src: str, table: str) -> set[str]:
    return set(
        re.findall(rf'op\.add_column\(\s*"{table}",\s*sa\.Column\(\s*"(\w+)"', src)
    )


# ── the claim guard: who is allowed to win the conflict ──────────────────────


class TestClaimGuard:
    def test_only_a_failed_row_can_be_reclaimed(self):
        """'pending' means a send is in flight; 'sent' means never again."""
        stmt = api._delivery_claim_stmt("111", "wt-1")
        operator, value = _guard_value(stmt)
        assert operator == "=", (
            f"an equality is required so exactly one status passes, got {operator!r}"
        )
        assert value == api._STATUS_FAILED, (
            f"only a FAILED row may be re-claimed, guard compares to {value!r}; "
            "otherwise a transient failure is blocked by its own claim row forever"
        )

    def test_claim_statement_returns_the_row_id(self):
        """The claim must be able to report whether *this* caller won the race.

        `claimed` is `scalar_one_or_none() is not None`, so the statement has to
        produce a row — otherwise the claim never succeeds and the ledger
        silently stops delivering anything at all.

        NOTE — a deliberate record of an EQUIVALENT MUTANT: deleting the
        explicit `.returning(Delivery.id)` from `_delivery_claim_stmt` does NOT
        turn this red, because SQLAlchemy's PostgreSQL dialect already adds
        `RETURNING deliveries.id` implicitly to populate the primary key of an
        INSERT. The generated SQL is byte-identical with and without the call,
        so that mutant is behaviour-preserving rather than a coverage hole.
        This assertion therefore guards the *shape* of the statement (e.g. a
        switch to a dialect or statement form that drops RETURNING), not the
        presence of that one redundant method call.
        """
        assert "RETURNING deliveries.id" in _compiled(
            api._delivery_claim_stmt("111", "wt-1")
        ), "the claim could never report success without a returned row"

    def test_claim_conflicts_on_the_ledger_identity(self):
        sql = _compiled(api._delivery_claim_stmt("111", "wt-1"))
        assert "ON CONFLICT (telegram_id, whale_trade_id)" in sql, sql


# ── the finish guard: the machine must be monotonic ──────────────────────────


class TestFinishGuard:
    def test_sent_is_skipped_when_already_sent(self):
        stmt = api._delivery_finish_stmt("111", "wt-1", api._STATUS_SENT)
        operator, value = _guard_value(stmt)
        assert operator == "!=", (
            f"marking 'sent' must be a no-op on an already-'sent' row, got {operator!r}"
        )
        assert value == api._STATUS_SENT, value

    def test_failed_only_moves_a_row_we_claimed(self):
        """Restricted to 'pending': a late failure must not downgrade a success."""
        stmt = api._delivery_finish_stmt("111", "wt-1", api._STATUS_FAILED, "Boom")
        operator, value = _guard_value(stmt)
        assert operator == "=", (
            f"a failure must apply only to a known state, got {operator!r} — an "
            "inequality would let it overwrite a successful send"
        )
        assert value == api._STATUS_PENDING, (
            f"a failure may only move a row this task claimed ('pending'), got {value!r}"
        )

    def test_guards_are_never_vacuous(self):
        """The regression that mutations exposed: `where=True` overwrites anything."""
        for status in (api._STATUS_SENT, api._STATUS_FAILED):
            where, _ = _on_conflict_where(
                api._delivery_finish_stmt("111", "wt-1", status, "e")
            )
            assert "deliveries.status" in where, (
                f"guard for {status!r} does not reference the status column: {where}"
            )

    def test_finish_writes_the_columns_the_ledger_reads(self):
        sql = _compiled(
            api._delivery_finish_stmt("111", "wt-1", api._STATUS_FAILED, "E: x")
        )
        for col in ("status", "error", "updated_at", "telegram_id", "whale_trade_id"):
            assert col in sql, f"finish does not write {col}"


# ── what the code does with the claim's result ───────────────────────────────


class TestClaimConsumption:
    """The SQL is verified above; this covers the decision made from its result.

    `claimed` is the single switch between sending and returning, so inverting
    either half of it turns the ledger into "deliver nothing" or "deliver
    everything twice" — outcome-level failures that a SQL-shape assertion
    cannot see, and which `test_delivery_ledger.py` does not touch (it never
    mentions `claimed`).
    """

    def _claimed_assign(self) -> ast.Assign:
        tree = ast.parse(_read(API))
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign) and any(
                isinstance(t, ast.Name) and t.id == "claimed" for t in node.targets
            ):
                return node
        raise AssertionError("`claimed` is no longer assigned anywhere in the module")

    def test_claimed_is_true_only_when_a_row_came_back(self):
        value = self._claimed_assign().value
        assert isinstance(value, ast.Compare), (
            f"`claimed` must compare the claim result, found: {ast.dump(value)[:70]}"
        )
        assert _dotted(value.left) == "result.scalar_one_or_none", _dotted(value.left)
        assert len(value.ops) == 1 and isinstance(value.ops[0], ast.IsNot), (
            "`claimed` must be `... is not None`; inverting it to `is None` would "
            "return early on every successful claim, so no alert is ever delivered"
        )
        assert len(value.comparators) == 1 and isinstance(
            value.comparators[0], ast.Constant
        ) and value.comparators[0].value is None, (
            "`claimed` must compare against None"
        )

    def test_losing_the_race_returns_without_sending(self):
        """`if not claimed: return` is what prevents a duplicate delivery."""
        tree = ast.parse(_read(API))
        for node in ast.walk(tree):
            if not isinstance(node, ast.If):
                continue
            test = node.test
            if (
                isinstance(test, ast.UnaryOp)
                and isinstance(test.op, ast.Not)
                and isinstance(test.operand, ast.Name)
                and test.operand.id == "claimed"
            ):
                assert any(isinstance(stmt, ast.Return) for stmt in node.body), (
                    "`if not claimed:` must bail out with a bare return, otherwise "
                    "a pair already claimed by another task is delivered again"
                )
                return
        raise AssertionError(
            "the `if not claimed: return` guard is gone — without it every "
            "already-claimed (including already-'sent') pair would be re-sent"
        )


class TestClaimLossIsObservable:
    """The not-claimed branch must say *why* it skipped, and how loudly.

    It used to be a bare `return` with no log line, which made the ledger
    unfalsifiable at the outcome level: losing the claim to a 'sent' row is the
    healthy outcome (reconcile replaying an already-delivered alert), while
    losing it to a *stranded* 'pending' row means the alert is dropped and never
    retried. Nothing was logged either way, so a dropped alert looked exactly
    like a quiet market. These tests pin the two apart.
    """

    def _branch(self) -> ast.If:
        tree = ast.parse(_read(API))
        for node in ast.walk(tree):
            if not isinstance(node, ast.If):
                continue
            test = node.test
            if (
                isinstance(test, ast.UnaryOp)
                and isinstance(test.op, ast.Not)
                and isinstance(test.operand, ast.Name)
                and test.operand.id == "claimed"
            ):
                return node
        raise AssertionError("the `if not claimed:` guard is gone")

    @staticmethod
    def _strings(node: ast.AST) -> str:
        return "\n".join(
            n.value for n in ast.walk(node)
            if isinstance(n, ast.Constant) and isinstance(n.value, str)
        )

    @staticmethod
    def _log_calls(node) -> list[tuple[str, str]]:
        """(level, message-literal) for every logger.<level>(...) in `node`.

        Accepts a node or a statement list — `ast.walk()` silently yields
        nothing for a bare list, which is a trap worth not tripping twice.
        """
        roots = node if isinstance(node, list) else [node]
        out: list[tuple[str, str]] = []
        for root in roots:
            for n in ast.walk(root):
                if not isinstance(n, ast.Call):
                    continue
                f = n.func
                if not isinstance(f, ast.Attribute) or _dotted(f.value) != "logger":
                    continue
                if not n.args:
                    continue
                first = n.args[0]
                if isinstance(first, ast.Constant) and isinstance(first.value, str):
                    out.append((f.attr, first.value))
        return out

    def test_losing_the_claim_is_logged(self):
        assert "delivery_claim_lost" in self._strings(self._branch()), (
            "the not-claimed branch is silent again; a dropped alert becomes "
            "indistinguishable from a quiet period"
        )

    def test_the_stranded_pending_case_is_a_warning(self):
        logs = self._log_calls(self._branch())
        pending = [(lv, m) for lv, m in logs if "delivery_claim_lost_pending" in m]
        assert pending, "a claim lost to a stranded 'pending' row must be logged"
        assert pending[0][0] == "warning", (
            "losing the claim to 'pending' can mean the alert is dropped forever; "
            "it must not be logged at info level alongside the healthy case"
        )

    def test_the_healthy_sent_case_is_only_info(self):
        logs = self._log_calls(self._branch())
        sent = [
            (lv, m)
            for lv, m in logs
            if m.startswith("delivery_claim_lost status=")
        ]
        assert sent, "the healthy 'already sent' case must still be logged"
        assert sent[0][0] == "info", (
            "reconcile replaying an already-delivered alert is routine; logging "
            "it as a warning would train operators to ignore the real one"
        )

    def test_the_status_is_read_back_from_the_ledger_not_assumed(self):
        branch = self._branch()
        called = set()
        for n in ast.walk(branch):
            if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute):
                called.add(n.func.attr)
        assert "scalar" in called, (
            "the branch must read Delivery.status back so the log reports the "
            "real reason instead of guessing"
        )
        reads_delivery_status = any(
            isinstance(n, ast.Attribute)
            and n.attr == "status"
            and isinstance(n.value, ast.Name)
            and n.value.id == "Delivery"
            for n in ast.walk(branch)
        )
        assert reads_delivery_status, "the read-back must query Delivery.status"

    def test_the_pending_test_is_a_real_comparison(self):
        """A constant test would keep every log string in the source while
        making the dangerous case unreachable — a mutation test caught exactly
        that, so this asserts the comparison, not just the presence of text."""
        branch = self._branch()
        compares = [
            n
            for n in ast.walk(branch)
            if isinstance(n, ast.Compare)
            and isinstance(n.left, ast.Name)
            and n.left.id == "existing"
            and len(n.comparators) == 1
            and isinstance(n.comparators[0], ast.Name)
            and n.comparators[0].id == "_STATUS_PENDING"
        ]
        assert compares, (
            "the branch must compare the read-back status against _STATUS_PENDING; "
            "any other test makes 'stranded pending' unreachable while still "
            "looking logged"
        )

    def test_both_outcomes_of_the_split_log(self):
        branch = self._branch()
        split = [
            n
            for n in ast.walk(branch)
            if isinstance(n, ast.If)
            and n.orelse
            and self._log_calls(n.body)
            and self._log_calls(n.orelse)
        ]
        assert split, (
            "both the pending (dropped) and the sent (healthy) outcome must be "
            "logged, so no path through the branch is silent"
        )

    def test_a_failed_read_back_cannot_break_delivery(self):
        branch = self._branch()
        handlers = [
            h for n in ast.walk(branch) if isinstance(n, ast.Try) for h in n.handlers
        ]
        assert handlers, (
            "the read-back is diagnostic only; if it raises, the send decision "
            "must still stand, so it must be wrapped in try/except"
        )
        caught = [
            "bare" if h.type is None else _dotted(h.type) for h in handlers
        ]
        assert any(c in ("Exception", "BaseException", "bare") for c in caught), (
            f"the read-back can fail with any DB error, but only {caught} is caught"
        )
        assert "delivery_claim_lost_status_unknown" in self._strings(branch), (
            "a failed read-back must still emit a log line, otherwise the "
            "diagnostic becomes the new silent branch"
        )


# ── code-to-schema contract ─────────────────────────────────────────────────


class TestSchemaContract:
    def test_conflict_target_matches_the_unique_constraint(self):
        """`index_elements` must name the columns of a real unique constraint.

        If it did not, every upsert would raise at runtime and — because the
        claim is wrapped in a try/except that returns — no alert would ever be
        delivered. The constraint is created in 0001_init, so assert it there.
        """
        assert re.search(
            r'UniqueConstraint\(\s*"telegram_id",\s*"whale_trade_id",\s*'
            r'name="uq_deliveries"',
            _read(MIGRATION_0001),
        ), (
            f"{MIGRATION_0001} no longer creates "
            "uq_deliveries(telegram_id, whale_trade_id), which the upserts conflict on"
        )
        assert api._DELIVERY_CONFLICT_COLUMNS == ["telegram_id", "whale_trade_id"], (
            f"the conflict target drifted from the constraint: {api._DELIVERY_CONFLICT_COLUMNS}"
        )
        model_unique = {
            tuple(c.name for c in con.columns)
            for con in Delivery.__table__.constraints
            if con.__class__.__name__ == "UniqueConstraint"
        }
        assert ("telegram_id", "whale_trade_id") in model_unique, (
            f"the Delivery model no longer declares that unique key: {model_unique}"
        )

    def test_migration_0020_chains_onto_0019(self):
        src = _read(MIGRATION_0020)
        assert re.search(r'^revision\s*=\s*"0020"', src, re.M)
        assert re.search(r'^down_revision\s*=\s*"0019"', src, re.M), (
            "0020 must chain onto 0019 — the production alembic_version it was "
            "written against; any other parent would need reconciling on the DB"
        )

    def test_0020_adds_exactly_the_three_ledger_columns(self):
        assert _added_columns(_read(MIGRATION_0020), "deliveries") == {
            "status",
            "error",
            "updated_at",
        }

    def test_every_model_column_is_created_by_a_migration(self):
        """The direction that breaks production: code reading a column that was
        never created. Scoped to the `deliveries` blocks so a same-named column
        on another table cannot make this pass by accident."""
        backed = _create_table_columns(_read(MIGRATION_0001), "deliveries")
        backed |= _added_columns(_read(MIGRATION_0020), "deliveries")
        unbacked = set(Delivery.__table__.columns.keys()) - backed
        assert not unbacked, (
            f"Delivery declares {sorted(unbacked)} but no migration creates them"
        )

    def test_status_width_fits_every_value_the_code_writes(self):
        """A value longer than the column raises StringDataRightTruncationError."""
        width = Delivery.status.type.length
        assert width is not None, "status must have a bounded width"
        too_long = [
            v
            for v in (api._STATUS_PENDING, api._STATUS_SENT, api._STATUS_FAILED)
            if len(v) > width
        ]
        assert not too_long, f"{too_long} do not fit status VARCHAR({width})"

    def test_status_width_matches_the_migration(self):
        m = re.search(
            r'sa\.Column\(\s*"status",\s*sa\.String\(length=(\d+)\)', _read(MIGRATION_0020)
        )
        assert m, "0020 no longer declares status as a sized String"
        assert int(m.group(1)) == Delivery.status.type.length, (
            f"model says {Delivery.status.type.length}, migration says {m.group(1)}"
        )

    def test_error_width_matches_the_migration(self):
        m = re.search(
            r'sa\.Column\(\s*"error",\s*sa\.String\(length=(\d+)\)', _read(MIGRATION_0020)
        )
        assert m, "0020 no longer declares error as a sized String"
        assert int(m.group(1)) == Delivery.error.type.length

    def test_error_text_never_exceeds_the_column(self):
        """`_delivery_error_text` must cap the reason to the column width.

        Asserted behaviorally (drive it with an over-long exception) rather than
        by reading the slice, so a wrong cap fails here — the same truncation
        class of bug that was dropping whole ingest batches.
        """
        width = Delivery.error.type.length
        assert width is not None
        text = api._delivery_error_text(RuntimeError("x" * 5000))
        assert len(text) <= width, (
            f"error text is {len(text)} chars but the column is VARCHAR({width}); "
            "the insert would raise and the outcome would be lost"
        )

    def test_error_text_redacts_the_bot_token(self):
        """The reason is persisted, so it must go through the redactor first."""
        token = "8468495085:AAEcTnTZ2169VJJG8PybGaxj8NIYTnNrmlg"
        text = api._delivery_error_text(
            RuntimeError(f"boom calling https://api.telegram.org/bot{token}/sendMessage")
        )
        assert token not in text, "the persisted failure reason must not carry the token"
        assert "***" in text
