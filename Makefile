.PHONY: setup db db-local db-local-stop migrate api web check
setup:
	cd services/backend && uv sync --locked
	cd apps/web && npm ci

db:
	docker compose up -d db

db-local:
	./scripts/local-db.sh

db-local-stop:
	./scripts/local-db.sh stop

migrate:
	cd services/backend && uv run alembic upgrade head

api:
	cd services/backend && uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

web:
	cd apps/web && npm run dev

check:
	cd services/backend && uv run ruff check . && uv run pytest
	cd apps/web && npm run typecheck && npm run build
