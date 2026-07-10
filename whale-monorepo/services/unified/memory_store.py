from __future__ import annotations

"""
In-memory drop-in replacement for redis.asyncio.Redis.

Supports the exact subset of Redis commands used by SightWhale services:
- Lists: rpush, blpop, lpop, llen, lrange, ltrim, lmove, delete
- KV: get, set (ex, nx), delete, expire, ping, incr, decr
- Lua eval: BATCH_RPUSH, _BATCH_LMOVE
- Pipeline (transaction)

All operations are async-compatible and single-process safe.
"""

import asyncio
import json
import logging
import time
from typing import Any

logger = logging.getLogger("memory_store")


class _Pipeline:
    """Collects commands and executes them in a batch (like Redis pipeline)."""

    def __init__(self, store: "InMemoryRedis", transaction: bool = True):
        self._store = store
        self._transaction = transaction
        self._commands: list[tuple[str, tuple, dict]] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        if self._commands:
            await self.execute()

    async def execute(self):
        results = []
        for cmd, args, kwargs in self._commands:
            method = getattr(self._store, cmd, None)
            if method:
                try:
                    result = await method(*args, **kwargs)
                    results.append(result)
                except Exception:
                    results.append(None)
            else:
                results.append(None)
        return results

    def rpush(self, key: str, *values: str) -> "str":
        self._commands.append(("rpush", (key, *values), {}))
        return "QUEUED"

    def ltrim(self, key: str, start: int, stop: int) -> "str":
        self._commands.append(("ltrim", (key, start, stop), {}))
        return "QUEUED"

    def expire(self, key: str, seconds: int) -> "str":
        self._commands.append(("expire", (key, seconds), {}))
        return "QUEUED"


class InMemoryRedis:
    """Drop-in async replacement for redis.asyncio.Redis.

    Usage:
        redis = InMemoryRedis(decode_responses=True)
        await redis.rpush("queue", json.dumps({"id": 1}))
        _, item = await redis.blpop("queue", timeout=1)
    """

    def __init__(self, *args, decode_responses: bool = False, **kwargs):
        # Silently accept Redis constructor args for drop-in compatibility
        self._decode_responses = decode_responses
        self._lists: dict[str, list[str]] = {}
        self._kv: dict[str, tuple[str, float]] = {}  # key -> (value, expiry_ts)
        self._sets: dict[str, set[str]] = {}
        self._waiters: dict[str, list[asyncio.Event]] = {}  # key -> list of events for BLPOP

    @classmethod
    def from_url(cls, url: str = "", *args, **kwargs) -> "InMemoryRedis":
        """Match redis.asyncio.Redis.from_url() signature."""
        return cls(*args, **kwargs)

    # ── Connection ──────────────────────────────────────────

    async def ping(self) -> bool:
        return True

    async def aclose(self):
        """No-op — no connections to close."""
        pass

    async def close(self):
        """No-op."""
        pass

    # ── List operations ─────────────────────────────────────

    async def rpush(self, key: str, *values: str) -> int:
        lst = self._lists.setdefault(key, [])
        lst.extend(values)
        self._notify_waiters(key)
        return len(lst)

    async def lpush(self, key: str, *values: str) -> int:
        lst = self._lists.setdefault(key, [])
        for v in reversed(values):
            lst.insert(0, v)
        self._notify_waiters(key)
        return len(lst)

    async def blpop(self, keys, timeout: int = 0) -> tuple[str, str] | None:
        """Blocking left pop — single key only (matching codebase usage)."""
        if isinstance(keys, (list, tuple)):
            key = keys[0]
        else:
            key = keys

        deadline = time.monotonic() + timeout if timeout > 0 else float("inf")

        while True:
            lst = self._lists.get(key, [])
            if lst:
                value = lst.pop(0)
                if not lst:
                    self._lists.pop(key, None)
                return (key, value)

            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return None

            # Register a waiter event
            event = asyncio.Event()
            waiters = self._waiters.setdefault(key, [])
            waiters.append(event)

            try:
                await asyncio.wait_for(event.wait(), timeout=min(remaining, 1.0))
                event.clear()
            except asyncio.TimeoutError:
                # Remove this event from waiters
                try:
                    waiters.remove(event)
                except ValueError:
                    pass
                # Check if deadline passed
                if time.monotonic() >= deadline:
                    return None

    async def lpop(self, key: str) -> str | None:
        lst = self._lists.get(key, [])
        if lst:
            value = lst.pop(0)
            if not lst:
                self._lists.pop(key, None)
            return value
        return None

    async def llen(self, key: str) -> int:
        return len(self._lists.get(key, []))

    async def lrange(self, key: str, start: int, end: int) -> list[str]:
        lst = self._lists.get(key, [])
        if end == -1:
            return lst[start:]
        return lst[start : end + 1]

    async def ltrim(self, key: str, start: int, stop: int) -> bool:
        lst = self._lists.get(key, [])
        if not lst:
            return True
        # stop=-1 means keep to end
        end = stop + 1 if stop >= 0 else len(lst) + stop + 1
        trimmed = lst[start:end]
        self._lists[key] = trimmed
        return True

    async def lmove(self, source: str, dest: str, wherefrom: str, whereto: str) -> str | None:
        """Atomic move from source to dest. Supports LEFT→RIGHT only (codebase usage)."""
        if wherefrom.upper() != "LEFT":
            raise NotImplementedError("lmove only supports LEFT source")
        lst_src = self._lists.get(source, [])
        if not lst_src:
            return None
        value = lst_src.pop(0)
        if not lst_src:
            self._lists.pop(source, None)
        lst_dst = self._lists.setdefault(dest, [])
        lst_dst.append(value)
        return value

    # ── Key-Value operations ────────────────────────────────

    async def exists(self, key: str) -> bool:
        """Check if key exists in any store (list, kv, or set). Respects TTL."""
        # Lists
        lst = self._lists.get(key)
        if lst:
            return True
        # Key-Value with TTL
        entry = self._kv.get(key)
        if entry is not None:
            _, expiry = entry
            if expiry == 0 or time.time() <= expiry:
                return True
        # Sets
        if key in self._sets:
            return True
        return False

    async def get(self, key: str) -> str | None:
        entry = self._kv.get(key)
        if entry is None:
            return None
        value, expiry = entry
        if expiry > 0 and time.time() > expiry:
            del self._kv[key]
            return None
        return value

    async def set(
        self,
        key: str,
        value: str,
        ex: int | None = None,
        nx: bool = False,
    ) -> bool | None:
        """Set key to value. Returns True on success, None if nx=True and key exists."""
        if nx and key in self._kv:
            entry = self._kv[key]
            if entry is not None:
                _, expiry = entry
                if expiry == 0 or time.time() < expiry:
                    return None
        expiry = time.time() + ex if ex else 0
        self._kv[key] = (str(value) if value is not None else "", expiry)
        return True

    async def delete(self, *keys: str) -> int:
        count = 0
        for key in keys:
            if key in self._lists:
                del self._lists[key]
                count += 1
            if key in self._kv:
                del self._kv[key]
                count += 1
            if key in self._sets:
                del self._sets[key]
                count += 1
        return count

    async def expire(self, key: str, seconds: int) -> bool:
        """Set TTL on an existing key."""
        if key in self._kv:
            value, _ = self._kv[key]
            self._kv[key] = (value, time.time() + seconds)
            return True
        # For lists, we track expiry in _kv separately
        self._kv[f"__expire_list__{key}"] = ("1", time.time() + seconds)
        return True

    async def incr(self, key: str) -> int:
        value = await self.get(key)
        if value is None:
            new_val = 1
        else:
            new_val = int(value) + 1
        self._kv[key] = (str(new_val), 0)
        return new_val

    async def decr(self, key: str) -> int:
        value = await self.get(key)
        if value is None:
            new_val = -1
        else:
            new_val = int(value) - 1
        self._kv[key] = (str(new_val), 0)
        return new_val

    # ── Lua eval ────────────────────────────────────────────

    async def eval(self, script: str, numkeys: int, *args: str) -> Any:
        """Execute Lua-like scripts. Supports BATCH_RPUSH and _BATCH_LMOVE."""
        if "for i = 1, #ARGV do" in script and "RPUSH" in script:
            # BATCH_RPUSH_SCRIPT
            key = args[0] if args else ""
            values = args[1:] if len(args) > 1 else []
            for v in values:
                lst = self._lists.setdefault(key, [])
                lst.append(v)
            self._notify_waiters(key)
            return len(values)
        elif "LMOVE" in script:
            # _BATCH_LMOVE
            source = args[0] if len(args) > 0 else ""
            dest = args[1] if len(args) > 1 else ""
            limit = int(args[2]) if len(args) > 2 else 1
            moved = 0
            for _ in range(limit):
                val = await self.lmove(source, dest, "LEFT", "RIGHT")
                if val is None:
                    break
                moved += 1
            return moved
        else:
            # Fallback: log and return 0
            logger.warning("memory_store_eval_unknown_script script=%s...", script[:80])
            return 0

    # ── Pipeline ────────────────────────────────────────────

    def pipeline(self, transaction: bool = True) -> _Pipeline:
        return _Pipeline(self, transaction=transaction)

    # ── Internal ────────────────────────────────────────────

    def _notify_waiters(self, key: str):
        """Notify all BLPOP waiters for a key."""
        waiters = self._waiters.get(key, [])
        while waiters:
            event = waiters.pop(0)
            event.set()

    # ── Set operations (for completeness) ───────────────────

    async def sadd(self, key: str, *values: str) -> int:
        s = self._sets.setdefault(key, set())
        before = len(s)
        s.update(values)
        return len(s) - before

    async def srem(self, key: str, *values: str) -> int:
        s = self._sets.get(key)
        if not s:
            return 0
        before = len(s)
        s.difference_update(values)
        if not s:
            self._sets.pop(key, None)
        return before - len(s)

    async def smembers(self, key: str) -> set[str]:
        return self._sets.get(key, set()).copy()

    async def scard(self, key: str) -> int:
        return len(self._sets.get(key, set()))

    # ── Utility ─────────────────────────────────────────────

    def __repr__(self) -> str:
        return (
            f"InMemoryRedis(lists={len(self._lists)}, kv={len(self._kv)}, "
            f"sets={len(self._sets)}, waiters={sum(len(w) for w in self._waiters.values())})"
        )
