# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Start here

This is the **Car Pre-Vetting Tool** (CarWow WA used-car appraisal). Before doing anything:

- **PROGRESS.md** — current build state and the immediate next step. Read first.
- **PLAN.md** — product rules, architecture, data model, and the per-slice log.
- **CODEBASE_GUIDE.md** — plain-English tour, with a deep dive on the pricing logic.
- **DEPLOY.md** — Vercel deploy runbook (env vars, Supabase settings, smoke test).

@AGENTS.md

## Commands

- `npm run dev` — dev server at http://localhost:3000
- `npm run build` — production build (also the truest check that App Router routes type-check)
- `npx tsc --noEmit` — type check
- `npm run lint` — ESLint
- `npm test` — Vitest unit tests (`tests/*.test.ts`)
  - single file: `npx vitest run tests/engine.test.ts`
  - by name: `npx vitest run -t "stolen"`
- `npm run test:e2e` — Playwright (`tests/e2e/*.spec.ts`). The auth specs **self-skip** unless a real Supabase user is supplied: `E2E_EMAIL=… E2E_PASSWORD=… npm run test:e2e`. The unauth-redirect spec always runs.
- **`/preflight`** — slash command (`.claude/commands/preflight.md`): the deploy-readiness gate for Vercel (lint + tsc + build + tests + secret/env checks). Run before shipping; see `DEPLOY.md`.

To run the app you need **`.env.local`** (gitignored) with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`). DB migrations in `supabase/migrations/` are applied via the **Supabase MCP** (`apply_migration`), not a CLI; project ref `cmwssucvqtaqkqosrumv`. Use the Supabase MCP for any DB inspection/changes.

## Non-negotiable conventions

- **AI must never decide the price or recommendation.** That decision is the pure, deterministic engine in `src/lib/pricing/`. Keep it pure — no I/O, no clock, no randomness. Every verdict carries reason codes + a template explanation so it's auditable.
- **Next.js 16 differs from older versions** (hence `@AGENTS.md`). Notably: `middleware` is renamed to **`proxy`** (`src/proxy.ts`, Node runtime); `cookies()` is async; route `params`/`searchParams` are Promises. Route handlers and server actions verify auth themselves because the proxy excludes `/api`.
- Build in small, testable slices; **commit per slice** with verification (tsc + build + tests, and a live E2E pass when possible).
- No new dependencies without a clear reason. UI primitives are hand-built in `src/components/ui/` (shadcn radix-nova style); figures use IBM Plex Mono.

## Architecture (the big picture)

A **two-phase assessment** flows down isolated layers — UI never computes price; the engine never touches I/O:

```
UI  src/app/(app)/**
  → POST /api/assess            src/app/api/assess/route.ts        (auth + zod validate)
    → orchestration service     src/lib/assess/service.ts
        → adapters (mock)       src/lib/adapters/**   RedBook valuation + PPSR history
        → pricing engine        src/lib/pricing/**    ← the only thing that decides price
        → Supabase (RLS)        src/lib/supabase/**
```

- **Two-phase (deferred PPSR)** — PPSR searches cost money, so:
  1. `runPriceAssessment` (phase 1): valuation + a **price-only provisional** verdict (engine called with `history: null`, which skips the history hard-stops and sets `provisional: true`). Persisted with `history_status='not_checked'`.
  2. `runHistoryCheck` (phase 2, `POST /api/assessments/[id]/ppsr`): only when the user opts in (offered for Buy/Check, never a price Pass). Runs the paid history check, re-runs the engine with history, and **finalizes the assessment in place** (a Buy can flip to Pass/Check). `AssessmentResponse.ppsrEligible` + the engine's `provisional` flag drive the UI.
- **Engine** (`src/lib/pricing/`): `assess()` computes `maxOffer = wholesale − repairs − 5% buffer`, then a **first-match decision order** (stolen → written-off → finance-owing → no-valuation → price bands vs asking). `reason-codes.ts` enumerates the codes; `explain.ts` renders them to plain English.
- **Adapters** (`src/lib/adapters/`): deterministic mocks keyed off car identity. **Magic tokens** in the plate/VIN force scenarios (`STOLEN`, `WOVR`, `FINANCE`, `NOVAL`, `FAILVAL`, `FAILHIST`). A thrown `AdapterError` = outage → **503, nothing persisted**; an adapter *succeeding* with a null valuation flows to the engine as a **Check**. Real RedBook/PPSR integrations later implement the same interfaces without touching the engine.
- **Auth & RLS**: `(app)/` is gated twice — `src/proxy.ts` (optimistic, cookie session refresh) and `requireUser()` in `(app)/layout.tsx` (DB-backed, via `src/lib/auth/dal.ts`). Postgres **Row Level Security** is the real enforcement. **Per-user isolation** (migration `0005_per_user_isolation`): every row is owned via `created_by` (default `auth.uid()`), and the RLS policies scope read/update to the owner — a user sees and edits only their own assessments (and their cars/valuations/history). The app never filters by `created_by`; RLS does it. No roles table yet (no shared/admin view).
- **Data model** (`supabase/migrations/0001_init.sql`, hand-written types in `src/types/db.ts`): `cars`, `valuations`, `history_checks`, `assessments`. The assessment row stores the engine's full `breakdown` (jsonb), so the detail view and the phase-2 re-run reconstruct the exact numbers.
- **Assessments dashboard** (`src/app/(app)/assessments/`): server-rendered, RLS-scoped table with stat cards, filter chips, and search — all state in URL params (`?verdict=&status=&q=&sort=&dir=`). Pure helpers live in `_shared.ts`.

## Agents

Project-specific subagents live in `.claude/agents/`. Delegate to them for focused,
parallelizable work (they start without this session's context, so each one's prompt
points back to these docs + the graphify map to orient quickly):

- **planner** — design a buildable, file-named implementation plan before coding (read-only).
- **ux-engineer** — navigation, flows, IA, interaction/empty/error states, accessibility, responsive, UX copy.
- **visual-designer** — typography, color, spacing, polish; keeps the instrument/appraisal-docket aesthetic.
- **test-engineer** — Vitest unit + Playwright E2E; knows the fake-Supabase and deterministic-mock patterns.
- **code-reviewer** — review the diff against the non-negotiables before commit (read-only).

Typical loop: `planner` → implement (with `ux-engineer`/`visual-designer` for UI) →
`test-engineer` → `code-reviewer`. Run independent agents in parallel.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
