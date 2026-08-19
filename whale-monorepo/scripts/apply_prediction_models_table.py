"""Create the prediction_models table + index on the production Postgres.

Fallback path for when the DB's external access is disabled (so `prisma
migrate deploy` cannot be run from a laptop / Vercel). Run from Render Shell
on the backend service, which reaches Postgres over Render's internal network:

    cd /app && python scripts/apply_prediction_models_table.py

Idempotent — safe to run multiple times. Mirrors the Prisma migration
services/landing/prisma/migrations/20260810_add_prediction_models/migration.sql.
"""
import asyncio
import sys

sys.path.insert(0, "/app")

from sqlalchemy import text

from shared.db import SessionLocal


DDL_TABLE = """
CREATE TABLE IF NOT EXISTS prediction_models (
    "id" SERIAL NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "intercept" DOUBLE PRECISION NOT NULL,
    "score_coef" DOUBLE PRECISION NOT NULL,
    "bullish_coef" DOUBLE PRECISION NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "trained_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prediction_models_pkey" PRIMARY KEY ("id")
)
"""

DDL_INDEX = """
CREATE INDEX IF NOT EXISTS "prediction_models_trained_at_idx"
    ON "prediction_models" ("trained_at")
"""


async def main() -> None:
    async with SessionLocal() as session:
        # asyncpg cannot prepare multiple commands in one execute — run each
        # statement separately.
        await session.execute(text(DDL_TABLE))
        await session.execute(text(DDL_INDEX))
        await session.commit()
    print("prediction_models table + index ensured (idempotent).")


if __name__ == "__main__":
    asyncio.run(main())
