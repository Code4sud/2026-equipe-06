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
# Cards, ROME skills and the sample report used by the AI (src/ai/data.py reads /app/data)
COPY data ./data

RUN useradd --create-home appuser
USER appuser

EXPOSE 8000

# The end of a turn chains the AI's answer and the turn analysis: more than gunicorn's default 30 s may be needed
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT} --workers 2 --timeout 90 'server.wsgi:application'"]
