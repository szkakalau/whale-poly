.PHONY: up down migrate logs unified unified-down

up:
	cd docker && docker compose up --build

down:
	cd docker && docker compose down -v

# ── Unified single-process mode (no Redis, no Celery) ─────
unified:
	cd docker && docker compose up --build sightwhale postgres

unified-down:
	cd docker && docker compose down -v

migrate:
	cd docker && docker compose exec trade-ingest-api alembic upgrade head

logs:
	cd docker && docker compose logs -f --tail=200