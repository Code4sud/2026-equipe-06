.PHONY: dev up down logs

dev:
	PYTHONPATH=src uv run python -m server

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f api
