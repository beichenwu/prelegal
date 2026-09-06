# syntax=docker/dockerfile:1

# --- Stage 1: build the static frontend ---------------------------------------
FROM node:20-slim AS frontend
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build          # -> /app/frontend/out

# --- Stage 2: Python runtime -------------------------------------------------
FROM python:3.12-slim AS runtime
COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /uvx /bin/

WORKDIR /app/backend
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PRELEGAL_FRONTEND_DIST=/app/frontend/out \
    PRELEGAL_DATABASE_URL=sqlite:////app/backend/prelegal.db

COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev

COPY backend/ ./
COPY --from=frontend /app/frontend/out /app/frontend/out

EXPOSE 8000
CMD ["uv", "run", "--no-dev", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
