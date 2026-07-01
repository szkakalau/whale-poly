import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
  sys.path.insert(0, str(ROOT))

os.environ.setdefault("DATABASE_URL", "postgresql://user:pass@localhost:5432/db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")


def pytest_ignore_collect(collection_path, config):
  from pathlib import Path
  p = Path(collection_path).resolve()
  # Exclude virtual environments
  if p.name == ".venv" or ".venv" in p.parts:
    return True
  # Exclude node modules
  if "node_modules" in p.parts:
    return True
  # Exclude scripts directory
  if "scripts" in p.parts:
    return True
  return False
