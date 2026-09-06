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
- **Mutual NDA creator** at `/tools/mutual-nda/` with two input modes sharing one
  live preview and download path:
  - **Guided form** — builds the Common Paper Mutual NDA client-side
    (`frontend/lib/mutualNda.ts`).
  - **AI chat (beta)** (SCRUM-9) — a streaming freechat that asks for the terms
    and fills the same fields. Calls `POST /api/nda/chat`; the backend does the
    LLM conversation + field extraction, the frontend keeps assembly and
    validation. Conversation is client-side only (React state + `localStorage`).
- **`frontend/` + `backend/` foundation** (SCRUM-8): a FastAPI app serves the
  static frontend at `/` and the API under `/api/*`, backed by a throwaway
  SQLite database, packaged in a single Docker image, with start/stop scripts.

Not built yet:

- User authentication — there is **no** `users` table, sign-up, or sign-in.
- Backend persistence of documents; the other 10 document types (as forms or in
  the chat).

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
  `PRELEGAL_FRONTEND_DIST`, `PRELEGAL_LLM_MODEL`). `openrouter_api_key` also reads
  the unprefixed `OPENROUTER_API_KEY`; the repo-root `.env` is loaded when present.
- `db.py` — engine, `SessionLocal`, `Base`, `init_db()`, `get_session()`
  dependency.
- `models.py` — SQLAlchemy models. Currently just `app_meta` (a bootstrap
  key/value marker). Real domain tables arrive with the features that need them.
- `nda_schema.py` — `NdaFields` (partial Pydantic mirror of `NdaFormValues`) and
  `missing_required()` (mirrors the frontend `validate()`), used by chat extraction.
- `llm.py` — LiteLLM wrapper: `stream_reply()` (token stream) and
  `extract_fields()` (non-streamed JSON, one retry, keeps prior fields on failure).
  Raises `LLMUnavailable` (no key) / `LLMError` (provider/parse failure).
- `api/routes.py` — `APIRouter(prefix="/api")`. `GET /api/health` does a real
  DB round-trip; `GET /api/nda/chat` returns `{"enabled": bool}` (is a key
  configured); `POST /api/nda/chat` streams `token` events then one `result`
  event (`reply`, `fields`, `missingFields`, `readyToGenerate`, `degraded`) or
  an `error` event (`code`: `unavailable` | `provider`). An `/api/*` catch-all
  keeps unknown API paths as JSON 404s.
- `main.py` — app factory + lifespan. CORS allows `localhost:3000` for `next dev`.

### Database

SQLite, **no migrations**. `init_db()` runs `drop_all` + `create_all` in the
FastAPI lifespan on every startup, so each process — and each fresh Docker
container — begins from a known-empty schema. Startup stamps an `initialized_at`
row; `GET /api/health` reads it back. When auth lands, the `users` table is
created the same way (recreated each start).

## AI design

Call LLMs through **LiteLLM → OpenRouter**, using a free model. `OPENROUTER_API_KEY`
is in `.env` at the project root; with no key the chat endpoint reports
`enabled: false` and the UI shows the guided form instead. The frontend also
distinguishes "not configured" from "endpoint unreachable" (wrong server, backend
down, `NEXT_PUBLIC_API_BASE` unset) and offers a retry for the latter.

The default model (`PRELEGAL_LLM_MODEL`) is currently
`openrouter/nvidia/nemotron-3-super-120b-a12b:free` — it supports JSON responses.
`meta-llama/llama-3.3-70b-instruct:free` is no longer free on OpenRouter; swap
the default again if the free tier changes.

The Mutual NDA chat (`app/llm.py`) uses two calls per turn: a streamed
conversational reply, and a separate non-streamed JSON call that re-reads the
whole conversation and returns the fields known so far (`response_format`
`json_object` + schema in the prompt; parsed and validated with Pydantic, one
retry). Document assembly stays in the frontend.

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

In `next dev` the frontend must be told where the API is:
`NEXT_PUBLIC_API_BASE=http://localhost:8000` (e.g. in `frontend/.env.local`).
In the Docker/production path the API is same-origin, so the variable is unset.
The AI chat additionally needs `OPENROUTER_API_KEY` in the backend's environment.

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

## Delivered Jira tickets

| Ticket | Summary | What shipped | PR |
| --- | --- | --- | --- |
| [SCRUM-1](https://beichenwu4667.atlassian.net/browse/SCRUM-1) | Marketing site | Static marketing landing page describing Prelegal — hero, "what it is", how-it-works, and a template-library listing driven by `catalog.json`. | #5 |
| [SCRUM-5](https://beichenwu4667.atlassian.net/browse/SCRUM-5) | Template curation | One-time data task: pulled the Common Paper markdown agreement templates into `templates/`, generated `catalog.json` (name / description / filename per doc), added the CC BY 4.0 `LICENSE.txt`. | #3 |
| [SCRUM-6](https://beichenwu4667.atlassian.net/browse/SCRUM-6) | Mutual NDA creator (prototype) | `/tools/mutual-nda/` — a form for the cover-page terms and both parties, a live-rendered agreement, and Markdown download / print-to-PDF. All client-side (`frontend/lib/mutualNda.ts`). | #4 |
| [SCRUM-7](https://beichenwu4667.atlassian.net/browse/SCRUM-7) | Input improvement | Autocomplete for the city and governing-law fields in the NDA form: a suggestion list appears on partial input (`frontend/lib/locations.ts`). | #6 |
| [SCRUM-8](https://beichenwu4667.atlassian.net/browse/SCRUM-8) | V1 product foundation | `frontend/` + `backend/` split; FastAPI serving the static export plus `/api/*`; throwaway SQLite recreated each startup; `GET /api/health`; multi-stage Dockerfile; mac/linux/windows start-stop scripts; CI split into frontend / backend / docker jobs. No auth, no feature port. | #7 |
| [SCRUM-9](https://beichenwu4667.atlassian.net/browse/SCRUM-9) | AI chat | Streaming freechat mode on the NDA tool (toggle beside the guided form). `POST /api/nda/chat` (SSE) via LiteLLM → OpenRouter; backend streams the reply and extracts fields, frontend merges them into the same live preview. AI asks permission before "generate". Conversation client-side only. NDA only. | branch `feature/SCRUM-9-ai-chat`, PR pending |

Backlog (not started): **SCRUM-10** support all catalogued document types · **SCRUM-11** auth, registration, per-user dashboard of past documents, preview-only disclaimer.
