# DSV EDI Naming Tool

A config-driven web application that replaces the `AAAAXXXXXXX - DSV EDI Naming Tool v63.xltm`
macro spreadsheet. It generates standardized EDI resource/file names (ITX maps, Resource Tags,
Lightwell Framework exports, SQL scripts, Business Processes, code lists, …) from a set of inputs.

The naming rules live as **data** (a "ruleset"), not code — so most updates are made by importing a
new ruleset version, not by changing the application.

## Why this design

The Excel tool is updated frequently, usually a few rules at a time. Here every naming rule is an
expression tree that mirrors the original Excel formulas (`CONCATENATE` / `IF` / `ISBLANK` / `OR`
/ `VLOOKUP`). Because rules are data:

| Update tier | Example | How it ships |
| --- | --- | --- |
| **data-only** | new message-type code, new lookup value, label tweak | Import → auto-classified **self-serve** → activate. No code, no redeploy. |
| **logic-change** | change an output's template/version segment | Import → flagged for review → activate. |
| **structural** | add a whole new input field or output | Import → flagged for developer review. |

Every import is validated, diffed against the active version, stored as an immutable version, and can
be **activated** or **rolled back**.

> 📖 **Project history & roadmap:** see [docs/PROJECT_HISTORY.md](docs/PROJECT_HISTORY.md) for the
> phased plan (P0–P4), what's done, and what's next. It travels with the repo, so it's readable on any machine.

## Architecture

```
packages/naming-engine   Pure TypeScript engine (fields + lookups + output expressions).
                         Zero framework deps. 17 unit tests. Reusable in browser or server.
apps/api                 Hono HTTP API + node:sqlite persistence (versions, activation, audit,
                         import pre-check/diff).
apps/web                 React + Vite UI: dynamic input form + instant results + admin
                         (import, pre-check diff, versions, activate/rollback, audit log).
```

- **Frontend:** React 18 + Vite + TypeScript
- **Backend:** Node + Hono, built-in `node:sqlite` (swap to PostgreSQL later without touching routes)
- **Shared core:** `@dsv/naming-engine`

## Getting started

```powershell
npm install

# Terminal 1 — API on http://localhost:8787
npm run dev:api

# Terminal 2 — Web on http://localhost:5173 (proxies /api to the API)
npm run dev:web
```

Open http://localhost:5173.

## Tests & checks

```powershell
npm test            # naming-engine unit tests (Vitest)
npm run typecheck   # all workspaces
```

## API

| Method & path | Purpose |
| --- | --- |
| `GET /api/ruleset/active` | Active ruleset + version metadata |
| `POST /api/generate` | `{ values }` → generated names, validation issues, visible fields |
| `GET /api/versions` | List stored ruleset versions |
| `POST /api/versions/import` | Validate + diff + store a new (inactive) ruleset version |
| `POST /api/versions/import-xltm` | Upload a `.xltm`/`.xlsx`; compile its formulas into a ruleset, then diff + store |
| `POST /api/versions/:id/activate` | Activate a version (or roll back to an older one) |
| `GET /api/audit` | Audit log |

## Status / known follow-ups

- Business users can drop the **`.xltm` itself** into the admin importer: the
  "Resource and file naming" formulas are compiled (CONCATENATE / IF / ISBLANK /
  OR / AND / NOT / UPPER / `&` / `=` / `<>`) into the engine model with a
  zero-dependency reader. Unsupported formulas (VLOOKUP, bare cell refs) are
  reported as warnings and skipped rather than failing silently.
- The engine currently ships the naming domains fully reverse-engineered from the Excel
  "Resource and file naming" sheet plus the 2026-07-03 ITX update. Remaining Excel domains
  (Mailboxes, Routing Rules, FTP/SFTP, AS2, Certificates, …) are added as more rulesets
  / by extending the importer to those sheets.
- The compact 3-char-coded **ITX map resource name** is provisional: it needs the DropDown
  message-type code table imported and the exact VBA algorithm confirmed. It is clearly marked
  in the UI.
