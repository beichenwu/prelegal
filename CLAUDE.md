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

### Product vision

AI chat to help the user choose a document and fill its fields, all 11 document
types, user accounts, and saved documents. The chat + all 11 documents are built
(SCRUM-9, SCRUM-10); accounts and persistence are not (SCRUM-11). See **Current
state**.

## Current state

Delivered:

- **Marketing site** at `/` (Next.js static export). The document library lists
  all 11 agreements, each linking into the creator.
- **AI document creator** at `/tools/create/` (SCRUM-9, SCRUM-10) — a streaming
  freechat that produces **any of the 11** Common Paper agreements:
  - **Triage**: the assistant asks the user's purpose, then picks the matching
    document from the catalogue, or says none fits and names the closest.
  - **Fill**: it collects that document's fields and both parties conversationally.
  - The frontend assembles the draft (`lib/buildDocument.ts`) — fill the cover
    page's `{{token}}` placeholders, append the standard terms — and previews it
    live. Conversation is client-side only (React state + `localStorage`).
- **Mutual NDA guided form** at `/tools/mutual-nda/` (SCRUM-6, SCRUM-7) — the
  original hand-built form; unchanged. Links across to the AI creator.
- **`frontend/` + `backend/` foundation** (SCRUM-8): a FastAPI app serves the
  static frontend at `/` and the API under `/api/*`, backed by a throwaway
  SQLite database, packaged in a single Docker image, with start/stop scripts.

Not built yet:

- User authentication — there is **no** `users` table, sign-up, or sign-in.
- Backend persistence of documents (drafts live only in the browser).

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
            `.md` files import as raw strings (webpack rule in next.config.mjs).
            Tests: vitest (`npm test`).
  documents/   one <slug>.json per agreement: label, description, field list,
               party list, and the terms/cover filenames.
  templates/   Common Paper standard terms (`<slug>.md`, unmodified) + adapted
               fill-in cover pages (`<slug>-cover.md`, `{{token}}` placeholders).
backend/    FastAPI + SQLAlchemy 2.0, Python 3.12, uv-managed.
            Serves frontend/out at `/` (StaticFiles, html=True) and the API
            under `/api/*`. Stateless re: documents — the frontend sends the
            catalogue and field spec with each chat request. Tests: pytest.
scripts/    Docker start/stop wrappers (mac / linux / windows).
Dockerfile  Multi-stage: node:20 builds frontend/out -> python:3.12-slim runs
            uvicorn and serves the built files. Exposes :8000.
```

### Frontend document flow (`frontend/lib/`)

- `documents.ts` — imports every `documents/*.json` + its two `.md` files into
  `DOCUMENTS` / `DOCUMENT_CATALOG` / `getDocument(slug)`.
- `buildDocument.ts` — `buildDocument(slug, values)` fills the cover page's
  `{{field}}` and `{{party.<key>.<attr>}}` tokens, strips Common Paper's inline
  `<span …>` wrappers, appends the standard terms. `missingFields(slug, values)`
  reports what's still blank.
- `chat.ts` — SSE client: `streamChat({catalog, document, messages, fields})`,
  `chatStatus()` (`enabled` | `disabled` | `unreachable`), `mergeFields()`.
- `components/DocChat.tsx` drives triage + fill; `app/tools/create/page.tsx`
  owns the chosen slug + collected values and renders the live preview.

### Backend layout (`backend/app/`)

- `config.py` — `Settings` (pydantic-settings). Every value has a default;
  override with `PRELEGAL_`-prefixed env vars (`PRELEGAL_DATABASE_URL`,
  `PRELEGAL_FRONTEND_DIST`, `PRELEGAL_LLM_MODEL`). `openrouter_api_key` also reads
  the unprefixed `OPENROUTER_API_KEY`; the repo-root `.env` is loaded when present.
- `db.py` — engine, `SessionLocal`, `Base`, `init_db()`, `get_session()`
  dependency.
- `models.py` — SQLAlchemy models. Currently just `app_meta` (a bootstrap
  key/value marker). Real domain tables arrive with the features that need them.
- `chat_schema.py` — request models for `/api/chat` (`catalog`, optional
  `document` with its field/party spec, `messages`, `fields`).
- `prompts.py` — triage vs fill system prompts, plus the JSON-only extraction
  prompt for each.
- `llm.py` — LiteLLM wrapper: `stream_reply(system, messages)` (token stream)
  and `extract_json(system, messages)` (non-streamed, one retry, then `LLMError`).
  Also raises `LLMUnavailable` when no key.
- `api/routes.py` — `APIRouter(prefix="/api")`. `GET /api/health` does a real
  DB round-trip; `GET /api/chat` returns `{"enabled": bool}`; `POST /api/chat`
  streams `token` events then one `result` event (`reply`, `fields`,
  `missingFields`, `readyToGenerate`, `degraded`, plus `document` / `suggestion`
  in triage) or an `error` event (`code`: `unavailable` | `provider`). An
  `/api/*` catch-all keeps unknown API paths as JSON 404s.
- `main.py` — app factory + lifespan. CORS allows `localhost:3000` for `next dev`.

### Database

SQLite, **no migrations**. `init_db()` runs `drop_all` + `create_all` in the
FastAPI lifespan on every startup, so each process — and each fresh Docker
container — begins from a known-empty schema. Startup stamps an `initialized_at`
row; `GET /api/health` reads it back. When auth lands, the `users` table is
created the same way (recreated each start).

## AI design

Call LLMs through **LiteLLM → OpenRouter**, using a free model. `OPENROUTER_API_KEY`
is in `.env` at the project root; with no key `GET /api/chat` reports
`enabled: false` and the UI says so. The frontend also distinguishes "not
configured" from "endpoint unreachable" (wrong server, backend down,
`NEXT_PUBLIC_API_BASE` unset) and offers a retry for the latter.

The default model (`PRELEGAL_LLM_MODEL`) is currently
`openrouter/nvidia/nemotron-3-super-120b-a12b:free` — it supports JSON responses.
`meta-llama/llama-3.3-70b-instruct:free` is no longer free on OpenRouter; swap
the default again if the free tier changes.

Each user turn is two calls: a streamed conversational reply, then a separate
non-streamed `response_format: json_object` call that re-reads the whole
conversation and returns the structured result (in triage: the chosen slug; in
fill: the field/party values and a `ready` flag). One retry on unparseable
output, then the turn degrades gracefully (reply kept, values unchanged).
Document assembly stays entirely in the frontend.

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
The AI creator additionally needs `OPENROUTER_API_KEY` in the backend's environment.

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
| [SCRUM-9](https://beichenwu4667.atlassian.net/browse/SCRUM-9) | AI chat | Streaming freechat that fills a document from conversation. `POST /api/chat` (SSE) via LiteLLM → OpenRouter; backend streams the reply and extracts fields, frontend assembles + previews. AI asks permission before "generate". Client-side only. Shipped for the NDA; generalised by SCRUM-10. | branch `feature/SCRUM-9-ai-chat`, PR pending |
| [SCRUM-10](https://beichenwu4667.atlassian.net/browse/SCRUM-10) | All 11 documents | `/tools/create/` generic AI creator: triage picks the document (or suggests the closest for unsupported asks), then fill collects its fields. Data-driven `frontend/documents/*.json` + adapted `*-cover.md` fill pages + generic `buildDocument`. `/api/nda/chat` → `/api/chat`. NDA guided form kept, unchanged. | branch `feature/SCRUM-10-all-documents`, PR pending |

Backlog (not started): **SCRUM-11** auth, registration, per-user dashboard of past documents, preview-only disclaimer.
