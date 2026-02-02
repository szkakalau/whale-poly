import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
  sys.path.insert(0, str(ROOT))

os.environ.setdefault("DATABASE_URL", "postgresql://user:pass@localhost:5432/db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")


def pytest_ignore_collect(collection_path, config):
  p = str(collection_path)
  if "/whale-monorepo/.venv/" in p or p.endswith("/whale-monorepo/.venv"):
    return True
  if "/whale-monorepo/services/landing/node_modules/" in p:
    return True
  return "/whale-monorepo/scripts/" in p or p.endswith("/whale-monorepo/scripts")
