# Prelegal Project

## Overview

Prelegal is a SaaS product for drafting legal agreements from standard templates.
A user picks a document, fills in the key terms, sees the completed agreement
render, and exports it (Markdown / print to PDF) — the groundwork before a lawyer
is involved.

The available documents are catalogued in `frontend/catalog.json`, included here:

@frontend/catalog.json

The source templates live in `frontend/templates/` (Common Paper standards,
CC BY 4.0).

### Product vision (not all built yet)

The intended end state is: AI chat to help the user choose a document and fill
its fields, all 11 document types available, user accounts, and saved documents.
See **Current state** for what actually exists today.

## Current state

Delivered:

- **Marketing site** at `/` (Next.js static export).
- **Mutual NDA creator** at `/tools/mutual-nda/` — a guided form that builds the
  Common Paper Mutual NDA and renders it live. Runs **entirely client-side**
  (`frontend/lib/mutualNda.ts`); it does not call the backend.
- **`frontend/` + `backend/` foundation** (SCRUM-8): a FastAPI app serves the
  static frontend at `/` and the API under `/api/*`, backed by a throwaway
  SQLite database, packaged in a single Docker image, with start/stop scripts.

Not built yet:

- AI chat / LLM integration (no code calls an LLM; `OPENROUTER_API_KEY` is unused).
- User authentication — there is **no** `users` table, sign-up, or sign-in.
- Backend persistence of documents; the other 10 document types as guided tools.

## Development process

When instructed to build a feature:

1. Use your Atlassian tools to read the feature instructions from Jira.
2. Develop the feature — do not skip any step from the feature-dev 7-step process.
3. Thoroughly test with unit and integration tests and fix any issues.
4. Submit a PR using your GitHub tools.

## Architecture

Single Docker image, one process at runtime:

```
frontend/   Next.js 15 (App Router) + React 19 + TypeScript.
            Static export: `output: "export"`, `trailingSlash: true`.
            Tests: vitest (`npm test`). catalog.json + templates/ live here.
backend/    FastAPI + SQLAlchemy 2.0, Python 3.12, uv-managed.
            Serves frontend/out at `/` (StaticFiles, html=True) and the API
            under `/api/*`. Tests: pytest.
scripts/    Docker start/stop wrappers (mac / linux / windows).
Dockerfile  Multi-stage: node:20 builds frontend/out -> python:3.12-slim runs
            uvicorn and serves the built files. Exposes :8000.
```

### Backend layout (`backend/app/`)

- `config.py` — `Settings` (pydantic-settings). Every value has a default;
  override with `PRELEGAL_`-prefixed env vars (`PRELEGAL_DATABASE_URL`,
  `PRELEGAL_FRONTEND_DIST`).
- `db.py` — engine, `SessionLocal`, `Base`, `init_db()`, `get_session()`
  dependency.
- `models.py` — SQLAlchemy models. Currently just `app_meta` (a bootstrap
  key/value marker). Real domain tables arrive with the features that need them.
- `api/routes.py` — `APIRouter(prefix="/api")`. `GET /api/health` does a real
  DB round-trip; an `/api/*` catch-all keeps unknown API paths as JSON 404s.
- `main.py` — app factory + lifespan.

### Database

SQLite, **no migrations**. `init_db()` runs `drop_all` + `create_all` in the
FastAPI lifespan on every startup, so each process — and each fresh Docker
container — begins from a known-empty schema. Startup stamps an `initialized_at`
row; `GET /api/health` reads it back. When auth lands, the `users` table is
created the same way (recreated each start).

## AI design (planned)

When writing code to call LLMs, use LiteLLM via OpenRouter to the best free model
at your discretion. Use Structured Outputs so results can be parsed and used to
populate fields in the legal document. `OPENROUTER_API_KEY` is in `.env` at the
project root.

## Running & testing

Docker (supported path; listens on **http://localhost:8000**):

```bash
scripts/start-mac.sh     scripts/stop-mac.sh       # macOS
scripts/start-linux.sh   scripts/stop-linux.sh     # Linux
scripts/start-windows.ps1 scripts/stop-windows.ps1 # Windows
```

`start-*` builds the image and runs a container named `prelegal`; `stop-*`
removes it. A root `.env`, if present, is passed to the container.

Local development (no Docker):

```bash
cd backend  && uv sync && uv run uvicorn app.main:app --reload   # API on :8000
cd frontend && npm install && npm run dev                        # site on :3000
```

For the production path locally, `npm run build` in `frontend/` then load
`http://localhost:8000`.

Checks (also run by `.github/workflows/ci.yml` as `frontend` / `backend` /
`docker` jobs):

```bash
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
cd backend  && uv run ruff check . && uv run pytest
```

## Color scheme

- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`
