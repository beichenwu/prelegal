# Prelegal

A web app for contract groundwork before it reaches the lawyers. Users draft
legal agreements from trusted standard templates, fill in the terms, and export a
signature-ready document.

The first tool is a **Mutual NDA creator** built on the Common Paper Mutual NDA
Standard Terms v1.0. More document types from [`frontend/templates/`](./frontend/templates)
are next.

## Layout

```
frontend/     Next.js 15 (App Router) + React 19 + TypeScript, static export
backend/      FastAPI + SQLAlchemy, uv-managed; serves the built frontend and the API
scripts/      Docker start/stop wrappers for macOS, Linux, Windows
Dockerfile    Multi-stage build: Node builds the frontend -> Python serves everything
```

At runtime a single FastAPI process serves the static frontend at `/` and the API
under `/api/*`. The database is a throwaway SQLite file, **dropped and recreated
on every startup** — there are no migrations. There is no user auth yet.

## Run it (Docker)

Docker is the supported way to run the whole app. It listens on
**http://localhost:8000**.

```bash
# macOS
scripts/start-mac.sh
scripts/stop-mac.sh

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh
```

```powershell
# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```

`start-*` builds the image and runs a container named `prelegal`; `stop-*` removes
it. If a `.env` file is present at the repo root it is passed to the container.

Check it is up:

```bash
curl http://localhost:8000/api/health
# {"status":"ok","database":"ok","initialized_at":"..."}
```

## Local development (no Docker)

Two processes, hot-reloading independently.

```bash
# Terminal 1 — API on :8000
cd backend
uv sync
uv run uvicorn app.main:app --reload

# Terminal 2 — frontend dev server on :3000
cd frontend
npm install
npm run dev
```

The frontend dev server proxies nothing — call the API at
`http://localhost:8000/api/*` directly during development. To exercise the
production path (FastAPI serving the built site), run `npm run build` in
`frontend/` and load `http://localhost:8000`.

## Checks

```bash
# frontend
cd frontend && npm run lint && npm run typecheck && npm test && npm run build

# backend
cd backend && uv run ruff check . && uv run pytest
```

CI runs all of the above plus `docker build` on every pull request.

## Notes

Generated agreements are **drafts** derived from the
[Common Paper](https://commonpaper.com) standards, used under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). This is a prototype and
not legal advice.
