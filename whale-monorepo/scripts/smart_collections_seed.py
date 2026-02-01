import asyncio
import json
import os
import sys

from sqlalchemy.ext.asyncio import AsyncSession

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
  sys.path.insert(0, project_root)

from shared.db import SessionLocal
from shared.models import SmartCollection


async def _upsert_smart_collection(session: AsyncSession, *, id: str, name: str, description: str, rule: dict) -> None:
  row = await session.get(SmartCollection, id)
  payload = {
    "name": name,
    "description": description,
    "rule_json": json.dumps(rule),
    "enabled": True,
  }
  if row:
    row.name = payload["name"]
    row.description = payload["description"]
    row.rule_json = payload["rule_json"]
    row.enabled = payload["enabled"]
  else:
    session.add(
      SmartCollection(
        id=id,
        name=payload["name"],
        description=payload["description"],
        rule_json=payload["rule_json"],
        enabled=payload["enabled"],
      )
    )


async def main() -> None:
  async with SessionLocal() as session:
    items = [
      {
        "id": "top_50_high_score",
        "name": "Top 50 High-Score Whales",
        "description": "Whales with high whale scores and meaningful total volume.",
        "rule": {
          "min_score": 80,
          "min_total_volume": 10000,
          "top_n_by_score": 50,
        },
      },
      {
        "id": "high_pnl_whales",
        "name": "High PnL Whales",
        "description": "Whales with strong realized PnL and sufficient trade history.",
        "rule": {
          "min_score": 70,
          "min_total_volume": 5000,
          "min_total_trades": 20,
          "top_n_by_score": 100,
        },
      },
    ]

    for item in items:
      await _upsert_smart_collection(
        session,
        id=item["id"],
        name=item["name"],
        description=item["description"],
        rule=item["rule"],
      )

    await session.commit()


if __name__ == "__main__":
  asyncio.run(main())

