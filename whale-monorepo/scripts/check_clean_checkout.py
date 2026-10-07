#!/usr/bin/env python
"""Run the test suite against a CLEAN checkout, and report what could differ.

Why this exists
---------------
Commit b62b03a added `tests/test_delivery_ledger.py`, whose C4 contract asserts
things about three *other* modules (`daily_vw_digest`, `prediction_digest`,
`vw_pusher`). The fixes for those modules were left uncommitted. Locally the
suite was green — the test read the fixed files from the working tree. On a
clean checkout it read the unfixed ones and failed:

    CI run 37597351561 → 1 failed, 196 passed
    C4: daily_vw_digest.py `except TelegramError` at line 139 does not call
        logger.error() (a failed digest send would be silent)

That whole class of failure is invisible to a run in the working tree, because
a static/contract test measures *the files on disk*, not *the commit*. This
script closes that hole by doing what CI does: check out the commit into a
throwaway worktree and run the suite there.

It also does the cheaper, faster half first — scanning for the *condition* that
causes the mismatch: a source file that is modified/untracked in the working
tree while a committed test file references it. Those are the tests whose
result you cannot trust locally.

Usage
-----
    .venv\\Scripts\\python.exe scripts/check_clean_checkout.py
    .venv\\Scripts\\python.exe scripts/check_clean_checkout.py --ref HEAD~1
    .venv\\Scripts\\python.exe scripts/check_clean_checkout.py --no-run

Exit codes: 0 = clean checkout is green, 1 = it is not (or the scan found
at-risk files and --strict was passed), 2 = the harness itself failed.
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parent

# Mirrors .github/workflows/test.yml so the environment matches CI.
CI_ENV = {
    "DATABASE_URL": "postgresql://user:pass@localhost:5432/db",
    "REDIS_URL": "redis://localhost:6379/0",
    "LANDING_SUCCESS_URL": "http://localhost:3000/success",
    "LANDING_CANCEL_URL": "http://localhost:3000/cancel",
}

# Directories whose files can be asserted on by contract/AST tests.
WATCHED_PREFIXES = ("whale-monorepo/services/", "whale-monorepo/shared/", "whale-monorepo/alembic/")

SOURCE_SUFFIXES = (".py", ".yaml", ".yml", ".sql")


def git(*args: str, cwd: Path = REPO_ROOT) -> str:
    p = subprocess.run(
        ["git", *args], cwd=str(cwd), capture_output=True, text=True,
        encoding="utf-8", errors="replace",
    )
    if p.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {p.stderr.strip()}")
    return p.stdout


def uncommitted_sources() -> list[str]:
    """Working-tree source files that differ from HEAD (modified or untracked)."""
    out = []
    for line in git("status", "--porcelain").splitlines():
        if len(line) < 4:
            continue
        status, path = line[:2], line[3:].strip().strip('"')
        if status.strip() == "D" or not path.endswith(SOURCE_SUFFIXES):
            continue
        if path.startswith(WATCHED_PREFIXES):
            out.append(path)
    return sorted(out)


def committed_tests_referencing(basename: str) -> list[str]:
    """Committed test files that mention ``basename`` (content search on HEAD)."""
    try:
        hits = git("grep", "-l", "-F", basename, "HEAD", "--", "whale-monorepo/tests")
    except RuntimeError:
        return []
    return [h.split(":", 1)[1].strip() for h in hits.splitlines() if ":" in h]


def scan_risk() -> list[tuple[str, list[str]]]:
    """(uncommitted source, committed tests that read it) — the blind spot."""
    risks = []
    for path in uncommitted_sources():
        base = Path(path).name
        tests = committed_tests_referencing(base)
        if tests:
            risks.append((path, tests))
    return risks


def run_clean_checkout(ref: str) -> int:
    tmp = Path(tempfile.mkdtemp(prefix="clean-checkout-"))
    worktree = tmp / "wt"
    added = False
    try:
        git("worktree", "add", "--detach", str(worktree), ref)
        added = True
        pkg = worktree / "whale-monorepo"

        env = dict(os.environ)
        env.update(CI_ENV)
        # Use the project venv's interpreter if we were started with one.
        python = sys.executable
        print(f"  解释器: {python}")
        print(f"  检出:   {ref} -> {pkg}")

        p = subprocess.run(
            [python, "-m", "pytest", "tests/", "-q", "--tb=short"],
            cwd=str(pkg), env=env, capture_output=True, text=True,
            encoding="utf-8", errors="replace",
        )
        tail = [ln for ln in p.stdout.splitlines() if re.search(r"\d+ (passed|failed|error)", ln)]
        print("  " + (tail[-1] if tail else "(无 pytest 汇总行)"))
        if p.returncode != 0:
            print("\n  ---- 失败详情 ----")
            for ln in p.stdout.splitlines():
                if ln.startswith(("FAILED", "ERROR")) or ln.strip().startswith("E "):
                    print("  " + ln[:200])
        return p.returncode
    finally:
        if added:
            subprocess.run(
                ["git", "worktree", "remove", "--force", str(worktree)],
                cwd=str(REPO_ROOT), capture_output=True, text=True,
            )
        shutil.rmtree(tmp, ignore_errors=True)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ref", default="HEAD", help="commit/tree to check out (default HEAD)")
    ap.add_argument("--no-run", action="store_true", help="only run the risk scan")
    ap.add_argument("--strict", action="store_true",
                    help="exit 1 if the risk scan finds at-risk files")
    args = ap.parse_args()

    print("=== 1. 风险扫描：未提交、但有已提交测试在断言它的源文件 ===")
    risks = scan_risk()
    if not risks:
        print("  ✓ 没有。工作区结果可以信任。")
    else:
        print(f"  ⚠️  {len(risks)} 个文件处于「本地已改、CI 未改」状态 —— 它们的测试结果不可信：")
        for path, tests in risks:
            print(f"     {path}")
            for t in tests[:4]:
                print(f"        ← {t}")
        print("  说明：这些测试度量的是**磁盘上的文件**，若不同步提交则 CI 会红。")

    if args.no_run:
        return 1 if (args.strict and risks) else 0

    print(f"\n=== 2. 干净检出测试（与 CI 同环境）===")
    rc = run_clean_checkout(args.ref)
    print()
    if rc == 0:
        print(f"✓ 干净检出全绿 —— 这一提交可以安全推送。")
    else:
        print("✗ 干净检出失败 —— 按 CI 修好再推送（本地绿是假象）。")
    return 0 if rc == 0 else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as exc:
        print(f"harness error: {exc}", file=sys.stderr)
        sys.exit(2)
