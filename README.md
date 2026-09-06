# Prelegal

A web app for contract groundwork before it reaches the lawyers. Users draft
legal agreements from trusted standard templates, fill in the terms, and export a
signature-ready document.

Sign up, then the **AI creator** at `/tools/create` produces any of the 11
[Common Paper](https://commonpaper.com) standard agreements: describe what you
need, the assistant picks the right document (or suggests the closest one it can
make), then guides you through its terms while the draft fills in live. Save
drafts to your account and manage them from `/dashboard`. The Mutual NDA also
keeps a dedicated **guided form** at `/tools/mutual-nda`.

## Layout

```
frontend/     Next.js 15 (App Router) + React 19 + TypeScript, static export
backend/      FastAPI + SQLAlchemy, uv-managed; serves the built frontend and the API
scripts/      Docker start/stop wrappers for macOS, Linux, Windows
Dockerfile    Multi-stage build: Node builds the frontend -> Python serves everything
```

At runtime a single FastAPI process serves the static frontend at `/` and the API
under `/api/*`. Accounts use email + password with JWT bearer tokens. The SQLite
database (users + saved documents) **persists** across restarts — in Docker it
lives on the `prelegal-data` named volume. There are no migrations; the schema is
created on first run.

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

`start-*` builds the image and runs a container named `prelegal` with the
`prelegal-data` volume; `stop-*` removes the container (the volume, and your
data, stays). A repo-root `.env` is passed in — put two keys there:

```
OPENROUTER_API_KEY=...      # the AI creator; without it the creator is disabled
PRELEGAL_SECRET_KEY=...     # signs auth tokens; use a stable random value
```

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

The frontend dev server proxies nothing, so tell it where the API is — put

```
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

in `frontend/.env.local`. (In the Docker/production path the API is same-origin,
so this stays unset.) The backend picks up the repo-root `.env` automatically —
set `OPENROUTER_API_KEY` for the creator and `PRELEGAL_SECRET_KEY` for auth.

To exercise the production path (FastAPI serving the built site), run
`npm run build` in `frontend/` and load `http://localhost:8000`.

## Checks

```bash
# frontend
cd frontend && npm run lint && npm run typecheck && npm test && npm run build

# backend
cd backend && uv run ruff check . && uv run pytest
```

CI runs all of the above plus `docker build` on every pull request.

## Notes

**Preview only.** Generated agreements are drafts derived from the
[Common Paper](https://commonpaper.com) standards, used under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (the `*-cover.md`
fill-in pages are adaptations — see `frontend/templates/LICENSE.txt`). This is a
prototype, not legal advice — have a qualified lawyer review any document before
signing.
