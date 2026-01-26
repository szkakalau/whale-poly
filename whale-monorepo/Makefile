.PHONY: up down migrate logs

up:
\tcd docker && docker compose up --build

down:
\tcd docker && docker compose down -v

migrate:
\tcd docker && docker compose exec trade-ingest-api alembic upgrade head

logs:
\tcd docker && docker compose logs -f --tail=200
