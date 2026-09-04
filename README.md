# Prelegal

A small web app for contract groundwork before it reaches the lawyers.

The first tool is a **Mutual NDA creator**: a user fills in the key terms and
both parties' details, sees the completed agreement render live, and downloads
it (Markdown, or print to PDF). It is built on the Common Paper Mutual NDA
Standard Terms v1.0 stored in [`templates/`](./templates).

## Stack

- [Next.js](https://nextjs.org) 15 (App Router) + React 19 + TypeScript
- Static export (`output: "export"`) — no server needed
- `react-markdown` for the live document preview
- `vitest` for unit tests

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

The NDA creator lives at `/tools/mutual-nda`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Static production build into `out/` |
| `npm run lint` | ESLint (`next/core-web-vitals`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run unit tests |

## Project structure

```
app/
  layout.tsx                  Root layout, header/footer, metadata
  page.tsx                    Home (placeholder until SCRUM-1)
  tools/mutual-nda/page.tsx   Mutual NDA creator
components/
  NdaForm.tsx                 Controlled form for the cover-page fields
  NdaPreview.tsx              Renders the assembled agreement Markdown
lib/
  mutualNda.ts                Document builder: templates, merge, validation
  mutualNda.test.ts           Unit tests
templates/                    Source legal templates (CC BY 4.0, see LICENSE.txt)
catalog.json                  Index of the templates
```

## Notes

Generated agreements are **drafts** derived from the
[Common Paper Mutual NDA (v1.0)](https://commonpaper.com/standards/mutual-nda/1.0),
used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). This is a
prototype and not legal advice.
