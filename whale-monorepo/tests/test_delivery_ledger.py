"""Static AST contract tests for the alert-delivery ledger fixes (F1 / D1 / D2 / D3).

Why *static* (AST) and not behavioural?
    ``_send_one`` builds a PostgreSQL-dialect upsert
    (``sqlalchemy.dialects.postgresql.insert(...).on_conflict_do_update(...)``)
    and opens a real ``SessionLocal``; ``conftest`` pins ``DATABASE_URL`` to a
    fake DSN. So the delivery paths cannot be imported-and-executed here, and
    their SQL cannot be compiled against SQLite either. The guarantees we care
    about are *structural* — statement ordering, the shape of the ``sent_ok``
    guard, the return contract of ``_send_via_bot``, and the "leave a trace"
    logging — so we assert them directly against the module AST. Nothing here
    connects to a DB or a network.

Contracts pinned
    C1  Ledger write before ephemeral bookkeeping, on every send path:
        ``_finish_delivery(..., _STATUS_SENT, ...)`` must have a strictly
        smaller ``lineno`` than the bookkeeping call that follows it
        (``record_after_digest_flush`` / ``record_push_for_group``). This is the
        D1 invariant: a bookkeeping failure after a successful send must never
        be able to downgrade the ledger.
    C2  ``_finish_delivery(..., _STATUS_FAILED, ...)`` only ever fires when the
        send did NOT succeed. The guard variable is discovered *dynamically*
        inside the enclosing ``try`` and pinned to an **authoritative** set
        (D5-1 + D7-1): a name counts only if it is initialised ``False`` before
        the send AND set ``True`` as a *direct* statement between the send and
        the ``_STATUS_SENT`` ledger write. Truthiness is normalised (D5-2), so the
        contract survives an innocent rename (``sent_ok`` -> ``did_send``), a
        re-spelling (``if sent_ok is True:``) or a genuinely added second flag,
        yet still fails when the guard is removed (e.g. the D1 sibling-indentation
        shape) or replaced by a conditional / never-initialised decoy. Decided by
        AST parent/child, never by indentation text.
    C3  ``_send_via_bot`` never swallows a failure: it returns ``True`` on success
        (so the function body contains ``return True``) and every ``except``
        handler either returns ``False`` or *always re-raises* (its body ends in
        ``raise``, so it has no normal-completion path) — D2/D7-2. A handler that
        can complete without returning ``False`` (``pass``, or a lone
        ``logger.warning(...)``) is a violation.
    C4  The digest / push fan-outs always leave a *visible, redacted* trace on a
        send failure: ``daily_vw_digest`` / ``prediction_digest`` each log
        ``logger.error(...)`` inside ``except TelegramError``; ``vw_pusher``
        logs ``logger.warning(...)`` and must not downgrade to ``logger.debug``.
    C5  The ``deliveries`` outcome trio exists in both places that define the
        schema: the ``Delivery`` ORM model (``status`` String(16) NOT NULL
        default ``'sent'``, ``error`` String(200), ``updated_at`` DateTime) and
        migration ``0020`` (``revision == "0020"``, ``down_revision == "0019"``,
        ``upgrade`` only ``ADD COLUMN``s exactly those three).
"""

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

API_PATH = ROOT / "services" / "telegram_bot" / "api.py"
DAILY_PATH = ROOT / "services" / "telegram_bot" / "daily_vw_digest.py"
PRED_PATH = ROOT / "services" / "telegram_bot" / "prediction_digest.py"
PUSHER_PATH = ROOT / "services" / "telegram_bot" / "vw_pusher.py"
MODELS_PATH = ROOT / "shared" / "models" / "models.py"
MIGRATION_PATH = ROOT / "alembic" / "versions" / "0020_deliveries_status.py"

_SENT = "_STATUS_SENT"
_FAILED = "_STATUS_FAILED"


# ── generic AST helpers ───────────────────────────────────────────────────────


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _parse(src: str) -> ast.Module:
    return ast.parse(src)


def _find_func(tree, name, *, is_async=None):
    """First (Async)FunctionDef named ``name``, searched recursively."""
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            if is_async is None or isinstance(node, ast.AsyncFunctionDef) == is_async:
                return node
    return None


def _parent_map(tree):
    parents = {}
    for node in ast.walk(tree):
        for child in ast.iter_child_nodes(node):
            parents[child] = node
    return parents


def _call_name(node):
    """Dotted callee name: ``foo`` / ``redis.set`` / ``logger.error`` / ``op.add_column``."""
    if not isinstance(node, ast.Call):
        return None
    func = node.func
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        base = getattr(func.value, "id", None)
        if base is None and isinstance(func.value, ast.Call):
            base = _call_name(func.value)
        return f"{base}.{func.attr}" if base else func.attr
    return None


def _descends_from(node, ancestor, parents) -> bool:
    """True iff ``node`` is ``ancestor`` or a descendant of it, via the parent chain."""
    cur = node
    while cur is not None:
        if cur is ancestor:
            return True
        cur = parents.get(cur)
    return False


def _has_return(node, value) -> bool:
    for n in ast.walk(node):
        if isinstance(n, ast.Return) and isinstance(n.value, ast.Constant) and n.value.value is value:
            return True
    return False


# ── C1: ledger write before bookkeeping, on every path ────────────────────────


def _is_finish_delivery(node) -> bool:
    return isinstance(node, ast.Call) and _call_name(node) == "_finish_delivery"


def _status_arg(node) -> str | None:
    """3rd positional arg of ``_finish_delivery(telegram_id, whale_trade_id, status, ...)``."""
    if len(node.args) >= 3 and isinstance(node.args[2], ast.Name):
        return node.args[2].id
    return None


def _first_call_after(owner, sent, call_name):
    cands = [
        n
        for n in ast.walk(owner)
        if isinstance(n, ast.Call) and _call_name(n) == call_name and n.lineno > sent.lineno
    ]
    return min(cands, key=lambda n: n.lineno, default=None)


def _order_check(owner, sent, book_name, label):
    book = _first_call_after(owner, sent, book_name)
    if book is None:
        return [
            f"C1[{label}]: no {book_name}() call found after the "
            f"_finish_delivery(_STATUS_SENT) at line {sent.lineno}"
        ]
    if sent.lineno >= book.lineno:
        return [
            f"C1[{label}]: _finish_delivery(_STATUS_SENT) at line {sent.lineno} is NOT before "
            f"{book_name}() at line {book.lineno}"
        ]
    return []


def c1_violations(api_src: str):
    tree = _parse(api_src)
    parents = _parent_map(tree)
    send_one = _find_func(tree, "_send_one", is_async=True)
    if send_one is None:
        return ["C1: _send_one() not found in api.py"]

    # Deliberate trade-off (D5, no change): we keep the *exact* count assertion
    # ("three send paths, each with exactly one _STATUS_SENT write") rather than
    # relaxing it to "at least one". A missing or duplicated ledger write is a
    # real regression we want caught, and unlike the guard-name matching this
    # count does not depend on any identifier spelling, so it is not fragile to
    # innocent refactors. The false-positive cost is judged lower than the
    # detection value.
    delayed = _find_func(send_one, "_delayed_send", is_async=True)

    sents = [
        n for n in ast.walk(send_one) if _is_finish_delivery(n) and _status_arg(n) == _SENT
    ]
    in_delayed = lambda s: delayed is not None and _descends_from(s, delayed, parents)
    top_sents = sorted((s for s in sents if not in_delayed(s)), key=lambda n: n.lineno)
    delayed_sents = [s for s in sents if in_delayed(s)]

    v = []
    if len(top_sents) != 2:
        v.append(
            f"C1: expected 2 _finish_delivery(_STATUS_SENT) calls in _send_one body "
            f"(flush + immediate), found {len(top_sents)}"
        )
    if len(delayed_sents) != 1:
        v.append(
            f"C1: expected 1 _finish_delivery(_STATUS_SENT) call in _delayed_send, "
            f"found {len(delayed_sents)}"
        )

    if len(top_sents) == 2:
        flush_sent, immediate_sent = top_sents  # flush branch appears first
        v += _order_check(send_one, flush_sent, "record_after_digest_flush", "flush")
        v += _order_check(send_one, immediate_sent, "record_push_for_group", "immediate")
    if len(delayed_sents) == 1:
        v += _order_check(delayed, delayed_sents[0], "record_push_for_group", "delayed")
    return v


# ── C2: _finish_delivery(FAILED) only fires on the "send did not succeed" branch
#
# The guard variable is discovered *dynamically* (D5-1), never hard-coded:
# inside the enclosing ``try`` we identify the flag that is initialised ``False``
# before the send and set ``True`` as a *direct* statement between the send and
# the ``_STATUS_SENT`` write (the authoritative send-outcome flag, D7-1). This
# keeps the contract green under an innocent rename (``sent_ok`` -> ``did_send``)
# while still failing loudly when no guard exists. Truthiness is normalised
# (D5-2) so the equivalent spellings ``X`` / ``X is True`` / ``X == True`` /
# ``True == X`` / ``bool(X)`` all count as "sent", and ``not X`` / ``X is False``
# / ``X == False`` as "not sent".


def _is_send_call(node) -> bool:
    """A call that actually reaches Telegram: ``_send_via_bot(...)`` or ``*.send_message(...)``."""
    if not isinstance(node, ast.Call):
        return False
    if _call_name(node) == "_send_via_bot":
        return True
    return isinstance(node.func, ast.Attribute) and node.func.attr == "send_message"


def _enclosing_try(node, parents):
    cur = node
    while cur is not None:
        cur = parents.get(cur)
        if isinstance(cur, ast.Try):
            return cur
    return None


def _bool_assigns_in(stmts):
    """Yield ``(name, value, lineno)`` for every ``X = <True|False literal>`` assignment."""
    for stmt in stmts:
        for n in ast.walk(stmt):
            if (
                isinstance(n, ast.Assign)
                and len(n.targets) == 1
                and isinstance(n.targets[0], ast.Name)
                and isinstance(n.value, ast.Constant)
                and n.value.value in (True, False)
            ):
                yield n.targets[0].id, n.value.value, n.lineno


def _stmts_before(node, parents):
    """Statements that precede ``node`` in its own enclosing block."""
    parent = parents.get(node)
    if parent is None:
        return []
    for field in ("body", "orelse", "finalbody"):
        lst = getattr(parent, field, None)
        if isinstance(lst, list) and node in lst:
            return list(lst[: lst.index(node)])
    return []


def _direct_true_assigns(try_node):
    """``(name, lineno)`` for every ``X = True`` written as a *direct* statement of
    the ``try`` body (not nested inside an ``if``/loop) — the unconditional
    "the send returned" flag."""
    out = []
    for stmt in try_node.body:
        if (
            isinstance(stmt, ast.Assign)
            and len(stmt.targets) == 1
            and isinstance(stmt.targets[0], ast.Name)
            and isinstance(stmt.value, ast.Constant)
            and stmt.value.value is True
        ):
            out.append((stmt.targets[0].id, stmt.lineno))
    return out


def _finish_delivery_calls(node, status):
    return [n for n in ast.walk(node) if _is_finish_delivery(n) and _status_arg(n) == status]


def _authoritative_guards(try_node, parents) -> set:
    """The authoritative send-guard names for ``try_node`` (D7-1).

    A name qualifies only when it is BOTH:

      (a) initialised ``False`` before the first send — so it really is a
          send-outcome flag; AND
      (b) set ``True`` as a *direct* statement of the try body, between the last
          send and the ``_STATUS_SENT`` ledger write — so it is set
          unconditionally on the send-returned path.

    This replaces the old loose union (any name merely assigned ``False``/``True``
    anywhere in scope), which let a *conditional* ``if rare: b = True`` (M7c) or a
    never-initialised ``decoy`` (M7d) masquerade as the guard. A genuinely added
    second flag (M7f) or an innocent rename (M1) is still tolerated.

    Returns ``set()`` when the try has no ``_STATUS_SENT`` write — the caller then
    reports a violation (conservative red) rather than falling back to the union.
    """
    sent = _finish_delivery_calls(try_node, _SENT)
    if not sent:
        return set()
    sent_lno = min(n.lineno for n in sent)

    send_lines = [n.lineno for stmt in try_node.body for n in ast.walk(stmt) if _is_send_call(n)]
    if not send_lines:
        return set()
    first_send, last_send = min(send_lines), max(send_lines)

    scope_stmts = _stmts_before(try_node, parents) + list(try_node.body)
    false_before = {
        name
        for name, value, lineno in _bool_assigns_in(scope_stmts)
        if value is False and lineno < first_send
    }

    guards = set()
    for name, lineno in _direct_true_assigns(try_node):
        if name in false_before and last_send < lineno < sent_lno:
            guards.add(name)
    return guards


def _cmp_single(test):
    """``(left, op, right)`` for a single-comparison ``Compare``, else ``None``."""
    if isinstance(test, ast.Compare) and len(test.ops) == 1 and len(test.comparators) == 1:
        return test.left, test.ops[0], test.comparators[0]
    return None


def _is_guard_name(node, guard_names) -> bool:
    return isinstance(node, ast.Name) and node.id in guard_names


def _is_true_const(node) -> bool:
    return isinstance(node, ast.Constant) and node.value is True


def _is_false_const(node) -> bool:
    return isinstance(node, ast.Constant) and node.value is False


def _truthy_guard_form(test, guard_names) -> bool:
    """``X`` / ``bool(X)`` / ``X is True`` / ``X == True`` / ``True == X``."""
    if _is_guard_name(test, guard_names):
        return True
    if (
        isinstance(test, ast.Call)
        and _call_name(test) == "bool"
        and len(test.args) == 1
        and _is_guard_name(test.args[0], guard_names)
    ):
        return True
    cmp = _cmp_single(test)
    if cmp and isinstance(cmp[1], (ast.Is, ast.Eq)):
        left, _, right = cmp
        return (_is_guard_name(left, guard_names) and _is_true_const(right)) or (
            _is_true_const(left) and _is_guard_name(right, guard_names)
        )
    return False


def _falsy_guard_form(test, guard_names) -> bool:
    """``not X`` / ``X is False`` / ``X == False`` / ``False == X``."""
    if isinstance(test, ast.UnaryOp) and isinstance(test.op, ast.Not) and _is_guard_name(test.operand, guard_names):
        return True
    cmp = _cmp_single(test)
    if cmp and isinstance(cmp[1], (ast.Is, ast.Eq)):
        left, _, right = cmp
        return (_is_guard_name(left, guard_names) and _is_false_const(right)) or (
            _is_false_const(left) and _is_guard_name(right, guard_names)
        )
    return False


def _guarded_on_not_sent(call, guard_names, parents) -> bool:
    """True iff the nearest enclosing ``If`` that references a guard name places
    ``call`` on the "send did not succeed" branch."""
    cur = call
    while cur in parents:
        parent = parents[cur]
        if isinstance(parent, ast.If):
            if _truthy_guard_form(parent.test, guard_names):
                # `if <guard>:` — the else branch is the not-sent branch.
                return any(_descends_from(call, s, parents) for s in parent.orelse)
            if _falsy_guard_form(parent.test, guard_names):
                # `if not <guard>:` — the body is the not-sent branch.
                return any(_descends_from(call, s, parents) for s in parent.body)
        cur = parent
    return False


def c2_violations(api_src: str):
    tree = _parse(api_src)
    parents = _parent_map(tree)
    send_one = _find_func(tree, "_send_one", is_async=True)
    if send_one is None:
        return ["C2: _send_one() not found in api.py"]

    failed = _finish_delivery_calls(send_one, _FAILED)
    if not failed:
        return ["C2: no _finish_delivery(_STATUS_FAILED) call found in _send_one/_delayed_send"]

    v = []
    for n in failed:
        try_node = _enclosing_try(n, parents)
        if try_node is None:
            v.append(
                f"C2: _finish_delivery(_STATUS_FAILED) at line {n.lineno} is not inside a `try` block "
                "(cannot locate its send guard)"
            )
            continue
        guards = _authoritative_guards(try_node, parents)
        if not guards:
            v.append(
                f"C2: could not locate the authoritative send-guard in the `try` block enclosing "
                f"line {n.lineno} (need a flag initialised False, then set True as a direct "
                "statement between the send and the _STATUS_SENT ledger write)"
            )
            continue
        if not _guarded_on_not_sent(n, guards, parents):
            v.append(
                f"C2: _finish_delivery(_STATUS_FAILED) at line {n.lineno} is not guarded by the "
                f"authoritative send flag {sorted(guards)} (must sit on the 'send did not succeed' "
                "branch: the else of `if <flag>:` or the body of `if not <flag>:`)"
            )
    return v


# ── C3: _send_via_bot never swallows a failure ────────────────────────────────


def _always_reraises(handler) -> bool:
    """A handler whose body *ends in* ``raise`` (bare ``raise`` or
    ``raise <exc> from <cause>``) can never fall through to normal completion — it
    always re-raises — so it does not swallow a failure and is exempt from the
    ``return False`` requirement (D7-2). A handler whose last statement is anything
    else — ``pass`` (M9a) or a lone ``logger.warning(...)`` (M9e) — has a
    normal-completion path and is NOT exempt."""
    return bool(handler.body) and isinstance(handler.body[-1], ast.Raise)


def c3_violations(api_src: str):
    tree = _parse(api_src)
    svb = _find_func(tree, "_send_via_bot", is_async=True)
    if svb is None:
        return ["C3: _send_via_bot() not found in api.py"]

    handlers = [n for n in ast.walk(svb) if isinstance(n, ast.ExceptHandler)]
    v = []
    if not handlers:
        v.append("C3: _send_via_bot() has no except handler (it cannot return False on failure)")
    for h in handlers:
        if _always_reraises(h):
            continue
        if not _has_return(h, False):
            v.append(
                f"C3: _send_via_bot() except handler at line {h.lineno} does not `return False` "
                "(it can complete normally without signalling the failure)"
            )
    if not _has_return(svb, True):
        v.append("C3: _send_via_bot() has no `return True` success signal")
    return v


# ── C4: digest / push failures leave a visible, redacted trace ────────────────


def _telegram_error_handlers(tree):
    out = []
    for n in ast.walk(tree):
        if isinstance(n, ast.ExceptHandler) and _catches(n, "TelegramError"):
            out.append(n)
    return out


def _catches(handler, name) -> bool:
    t = handler.type
    if t is None:
        return False
    if isinstance(t, ast.Name):
        return t.id == name
    if isinstance(t, ast.Tuple):
        return any(isinstance(e, ast.Name) and e.id == name for e in t.elts)
    return False


def _logger_calls(handler):
    names = {"logger.error", "logger.warning", "logger.debug", "logger.info"}
    return [c for c in (_call_name(n) for n in ast.walk(handler) if isinstance(n, ast.Call)) if c in names]


def _c4_error_handler(src, label):
    handlers = _telegram_error_handlers(_parse(src))
    v = []
    if not handlers:
        v.append(f"C4: {label} has no `except TelegramError` handler (expected a logged failure path)")
    for h in handlers:
        if "logger.error" not in _logger_calls(h):
            v.append(
                f"C4: {label} `except TelegramError` at line {h.lineno} does not call logger.error() "
                "(a failed digest send would be silent)"
            )
    return v


def _c4_pusher_handler(src, label):
    handlers = _telegram_error_handlers(_parse(src))
    v = []
    if not handlers:
        v.append(f"C4: {label} has no `except TelegramError` handler")
    for h in handlers:
        calls = _logger_calls(h)
        if "logger.warning" not in calls:
            v.append(
                f"C4: {label} `except TelegramError` at line {h.lineno} must log at WARNING "
                f"(got {calls or 'no logging'})"
            )
        if "logger.debug" in calls:
            v.append(
                f"C4: {label} `except TelegramError` at line {h.lineno} logs at DEBUG — invisible in prod"
            )
    return v


def c4_violations(daily_src: str, pred_src: str, pusher_src: str):
    return (
        _c4_error_handler(daily_src, "daily_vw_digest.py")
        + _c4_error_handler(pred_src, "prediction_digest.py")
        + _c4_pusher_handler(pusher_src, "vw_pusher.py")
    )


# ── C5: deliveries schema (model + migration 0020) ────────────────────────────


def _type_name(col_call) -> str | None:
    if not isinstance(col_call, ast.Call) or not col_call.args:
        return None
    first = col_call.args[0]
    if isinstance(first, ast.Call):
        return _call_name(first)
    if isinstance(first, ast.Name):
        return first.id
    return None


def _type_int_arg(col_call):
    if isinstance(col_call, ast.Call) and col_call.args and isinstance(col_call.args[0], ast.Call):
        inner = col_call.args[0]
        if inner.args and isinstance(inner.args[0], ast.Constant) and isinstance(inner.args[0].value, int):
            return inner.args[0].value
    return None


def _type_kw(col_call, kw_name):
    if isinstance(col_call, ast.Call) and col_call.args and isinstance(col_call.args[0], ast.Call):
        for k in col_call.args[0].keywords:
            if k.arg == kw_name and isinstance(k.value, ast.Constant):
                return k.value.value
    return None


def _kw(col_call, kw_name):
    for k in col_call.keywords:
        if k.arg == kw_name and isinstance(k.value, ast.Constant):
            return k.value.value
    return None


def _default_text(col_call) -> str:
    parts = []
    for k in col_call.keywords:
        if k.arg in ("server_default", "default") and isinstance(k.value, ast.Constant):
            parts.append(str(k.value.value))
    return " ".join(parts)


def _delivery_columns(models_src):
    tree = _parse(models_src)
    delivery = None
    for n in ast.walk(tree):
        if isinstance(n, ast.ClassDef) and n.name == "Delivery":
            delivery = n
            break
    if delivery is None:
        return None
    cols = {}
    for stmt in delivery.body:
        if (
            isinstance(stmt, ast.Assign)
            and len(stmt.targets) == 1
            and isinstance(stmt.targets[0], ast.Name)
            and isinstance(stmt.value, ast.Call)
            and _call_name(stmt.value) in ("Column", "sa.Column")
        ):
            cols[stmt.targets[0].id] = stmt.value
    return cols


def c5_model_violations(models_src: str):
    cols = _delivery_columns(models_src)
    if cols is None:
        return ["C5: class Delivery not found in models.py"]

    v = []
    status = cols.get("status")
    if status is None:
        v.append("C5: Delivery.status column missing")
    else:
        if _type_name(status) != "String" or _type_int_arg(status) != 16:
            v.append(f"C5: Delivery.status must be String(16) (got {_type_name(status)}({_type_int_arg(status)}))")
        if _kw(status, "nullable") is not False:
            v.append("C5: Delivery.status must be NOT NULL (nullable=False)")
        if "sent" not in _default_text(status):
            v.append("C5: Delivery.status must default to 'sent'")

    error = cols.get("error")
    if error is None:
        v.append("C5: Delivery.error column missing")
    elif _type_name(error) != "String" or _type_int_arg(error) != 200:
        v.append(f"C5: Delivery.error must be String(200) (got {_type_name(error)}({_type_int_arg(error)}))")

    updated = cols.get("updated_at")
    if updated is None:
        v.append("C5: Delivery.updated_at column missing")
    else:
        if _type_name(updated) != "DateTime":
            v.append(f"C5: Delivery.updated_at must be DateTime (got {_type_name(updated)})")
        elif _type_kw(updated, "timezone") is not True:
            v.append("C5: Delivery.updated_at must be DateTime(timezone=True)")
    return v


def c5_migration_violations(mig_src: str):
    tree = _parse(mig_src)
    v = []

    module_assigns = {}
    for stmt in tree.body:
        if (
            isinstance(stmt, ast.Assign)
            and len(stmt.targets) == 1
            and isinstance(stmt.targets[0], ast.Name)
            and isinstance(stmt.value, ast.Constant)
        ):
            module_assigns[stmt.targets[0].id] = stmt.value.value

    if module_assigns.get("revision") != "0020":
        v.append(f"C5: migration revision must be '0020' (got {module_assigns.get('revision')!r})")
    if module_assigns.get("down_revision") != "0019":
        v.append(f"C5: migration down_revision must be '0019' (got {module_assigns.get('down_revision')!r})")

    upgrade = _find_func(tree, "upgrade")
    if upgrade is None:
        v.append("C5: migration 0020 has no upgrade()")
        return v

    added = []
    for n in ast.walk(upgrade):
        if isinstance(n, ast.Call) and _call_name(n) == "op.add_column" and len(n.args) >= 2:
            col = n.args[1]
            if (
                isinstance(col, ast.Call)
                and _call_name(col) in ("sa.Column", "Column")
                and col.args
                and isinstance(col.args[0], ast.Constant)
            ):
                added.append(col.args[0].value)

    if set(added) != {"status", "error", "updated_at"} or len(added) != 3:
        v.append(f"C5: upgrade() must ADD COLUMN exactly {{status, error, updated_at}} (got {added})")
    return v


# ── tests ─────────────────────────────────────────────────────────────────────


def test_c1_ledger_write_precedes_bookkeeping():
    violations = c1_violations(_read(API_PATH))
    assert not violations, "\n".join(violations)


def test_c2_failed_write_is_guarded_by_sent_ok():
    violations = c2_violations(_read(API_PATH))
    assert not violations, "\n".join(violations)


def test_c3_send_via_bot_never_swallows_failure():
    violations = c3_violations(_read(API_PATH))
    assert not violations, "\n".join(violations)


def test_c4_digest_and_push_failures_leave_a_trace():
    violations = c4_violations(_read(DAILY_PATH), _read(PRED_PATH), _read(PUSHER_PATH))
    assert not violations, "\n".join(violations)


def test_c5_deliveries_schema_contract():
    violations = c5_model_violations(_read(MODELS_PATH)) + c5_migration_violations(_read(MIGRATION_PATH))
    assert not violations, "\n".join(violations)
