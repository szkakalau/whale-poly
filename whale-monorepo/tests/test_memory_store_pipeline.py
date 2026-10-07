"""InMemoryRedis pipeline conformance.

Regression tests for the 2026-10-07 production error:

    ERROR unified.worker_loop alert_consume_failed_single
      File "/app/services/alert_engine/engine.py", line 395, in process_whale_trade_event
        pipe.set("alert_created:last", payload_raw, ex=86400)
    AttributeError: '_Pipeline' object has no attribute 'set'

`_Pipeline` only implemented rpush/ltrim/expire, so the batched
"RPUSH + SET" in alert_engine/engine.py raised. The exception was raised
*before* the `if created:` cooldown block, so cooldown/dedup logic was skipped
on EVERY alert, and every alert logged a full ERROR traceback.

Beyond pinning `set`, `test_every_pipelined_command_is_supported` is a contract
test: it scans the source for `pipe.<method>(...)` call sites and asserts
`_Pipeline` implements each one, so the next missing shim method fails CI
instead of production.
"""
import re
from pathlib import Path

from services.unified.memory_store import InMemoryRedis, _Pipeline

ROOT = Path(__file__).resolve().parents[1]


# ── direct pipeline behaviour ────────────────────────────


class TestPipelineSet:
    async def test_set_is_queued_and_executed(self):
        redis = InMemoryRedis(decode_responses=True)
        async with redis.pipeline(transaction=True) as pipe:
            pipe.rpush("q", "payload")
            pipe.set("alert_created:last", "payload", ex=86400)
            await pipe.execute()

        assert await redis.get("alert_created:last") == "payload"
        assert await redis.lrange("q", 0, -1) == ["payload"]

    async def test_set_records_a_command(self):
        redis = InMemoryRedis(decode_responses=True)
        pipe = redis.pipeline(transaction=True)
        assert pipe.set("k", "v", ex=60) == "QUEUED"
        assert [c[0] for c in pipe._commands] == ["set"]

    async def test_ex_is_forwarded(self):
        """ex must reach InMemoryRedis.set() — otherwise the key never expires."""
        redis = InMemoryRedis(decode_responses=True)
        async with redis.pipeline(transaction=True) as pipe:
            pipe.set("withttl", "v", ex=60)
            pipe.set("nottl", "v")
            await pipe.execute()

        assert "withttl" in redis._kv
        assert "nottl" in redis._kv
        # expiry_ts is stored alongside the value; the ttl'd key must carry one
        _, expiry = redis._kv["withttl"]
        assert expiry is not None and expiry > 0

    async def test_set_default_when_no_ex(self):
        redis = InMemoryRedis(decode_responses=True)
        pipe = redis.pipeline(transaction=True)
        pipe.set("k", "v")
        assert pipe._commands[0] == ("set", ("k", "v"), {"ex": None, "nx": False})

    async def test_set_on_exit_without_explicit_execute(self):
        """__aexit__ flushes queued commands even when execute() is not awaited."""
        redis = InMemoryRedis(decode_responses=True)
        async with redis.pipeline(transaction=True) as pipe:
            pipe.set("autoflushed", "v", ex=30)
        assert await redis.get("autoflushed") == "v"


class TestPipelineExecutesExactlyOnce:
    """`async with pipe:` + explicit `await pipe.execute()` must not double-run.

    execute() did not clear its command stack while __aexit__ re-executed any
    non-empty stack, so every command ran twice. Harmless-looking until you
    notice it duplicated alert_created queue entries and recent_trades cache
    rows (which whale detection reads).
    """

    async def test_explicit_execute_then_exit_runs_once(self):
        redis = InMemoryRedis(decode_responses=True)
        async with redis.pipeline(transaction=True) as pipe:
            pipe.rpush("q", "once")
            await pipe.execute()

        assert await redis.lrange("q", 0, -1) == ["once"]

    async def test_engine_shape_enqueues_exactly_once(self):
        import json

        redis = InMemoryRedis(decode_responses=True)
        payload = json.dumps({"alert_id": "a1"})
        async with redis.pipeline(transaction=True) as pipe:
            pipe.rpush("alert_created", payload)
            pipe.set("alert_created:last", payload, ex=86400)
            await pipe.execute()

        assert await redis.llen("alert_created") == 1
        assert await redis.get("alert_created:last") == payload

    async def test_worker_cache_shape_runs_once(self):
        """trade_ingest/worker.py: RPUSH + LTRIM + EXPIRE in one `async with`."""
        import json

        redis = InMemoryRedis(decode_responses=True)
        body = json.dumps({"amount": 1.0})
        async with redis.pipeline(transaction=True) as pipe:
            pipe.rpush("recent_trades:w:m", body)
            pipe.ltrim("recent_trades:w:m", -100, -1)
            pipe.expire("recent_trades:w:m", 3600)
            await pipe.execute()

        assert await redis.lrange("recent_trades:w:m", 0, -1) == [body]

    async def test_commands_stack_is_cleared(self):
        redis = InMemoryRedis(decode_responses=True)
        pipe = redis.pipeline(transaction=True)
        pipe.rpush("q", "a")
        assert len(pipe._commands) == 1
        await pipe.execute()
        assert pipe._commands == []

    async def test_two_explicit_executes_are_two_batches(self):
        redis = InMemoryRedis(decode_responses=True)
        pipe = redis.pipeline(transaction=True)
        pipe.rpush("q", "first")
        await pipe.execute()
        pipe.rpush("q", "second")
        await pipe.execute()
        async with pipe:
            pass
        assert await redis.lrange("q", 0, -1) == ["first", "second"]


class TestEnginePipelineShape:
    """The exact batched RPUSH + SET shape used by alert_engine/engine.py."""

    async def test_alert_created_pipeline_does_not_raise(self):
        import json

        redis = InMemoryRedis(decode_responses=True)
        payload_raw = json.dumps({"alert_id": "a1", "market_id": "m1"})

        async with redis.pipeline(transaction=True) as pipe:
            pipe.rpush("alert_created", payload_raw)
            pipe.set("alert_created:last", payload_raw, ex=86400)
            await pipe.execute()

        assert await redis.get("alert_created:last") == payload_raw
        assert await redis.llen("alert_created") == 1

    async def test_pipeline_failure_does_not_lose_earlier_commands(self):
        """__aexit__ flushes what was queued, even if a later call blows up."""
        redis = InMemoryRedis(decode_responses=True)
        try:
            async with redis.pipeline(transaction=True) as pipe:
                pipe.rpush("q", "kept")
                pipe.definitely_not_a_command("x")  # raises AttributeError
                await pipe.execute()
        except AttributeError:
            pass

        assert await redis.lrange("q", 0, -1) == ["kept"]


# ── contract test: no missing shim methods ───────────────


def _pipelined_method_names() -> dict[str, set[str]]:
    """{method_name: {files that call it}} for every `pipe.<method>(` in source."""
    found: dict[str, set[str]] = {}
    pattern = re.compile(r"\bpipe\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(")
    for path in list((ROOT / "services").rglob("*.py")) + list(
        (ROOT / "shared").rglob("*.py")
    ):
        if "__pycache__" in str(path):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for name in pattern.findall(text):
            found.setdefault(name, set()).add(path.relative_to(ROOT).as_posix())
    return found


def test_every_pipelined_command_is_supported():
    """Contract: every `pipe.X(...)` call site must exist on _Pipeline.

    This is what catches the next missing shim method before it reaches prod.
    """
    calls = _pipelined_method_names()
    assert calls, "expected to find at least one pipe.<method>() call site"

    missing = {name: sorted(files) for name, files in calls.items() if not hasattr(_Pipeline, name)}
    assert not missing, (
        "_Pipeline is missing methods that callers use:\n"
        + "\n".join(f"  pipe.{n}() used by {f}" for n, f in missing.items())
    )


def test_contract_test_sees_the_real_call_sites():
    """Guard against the scanner silently matching nothing (vacuous test)."""
    calls = _pipelined_method_names()
    # both known call sites must be discovered
    assert "rpush" in calls
    assert "set" in calls
    assert any("alert_engine/engine.py" in f for f in calls["set"])


def test_pipeline_methods_are_not_silently_swallowed():
    """A typo'd command must raise, not silently return None.

    InMemoryRedis._Pipeline.execute() tolerates unknown commands (returns None)
    because execute() dispatches dynamically. The *queueing* side must still be
    strict — otherwise a typo turns into a silently dropped write.
    """
    redis = InMemoryRedis(decode_responses=True)
    pipe = redis.pipeline(transaction=True)
    assert not hasattr(pipe, "definitely_not_a_command")
