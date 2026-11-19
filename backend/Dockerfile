FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH=/app/src \
    HOST=0.0.0.0 \
    PORT=8000

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src ./src

RUN useradd --create-home appuser
USER appuser

EXPOSE 8000

CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT} --workers 2 'server.wsgi:application'"]
