# Car Pre-Vetting Tool — Build Progress & Handoff

> **For a new Claude Code session:** read this file first. It is the source of
> truth for what is done and what to do next. The full plan lives at
> `~/.claude/plans/i-m-working-on-a-unified-zephyr.md`.

## Project in one line
CarWow WA (Perth used-car dealer) pre-vetting tool: Car input → mock valuation →
mock history check → **deterministic** max-offer → Buy/Pass/Check → human review.
**AI must NOT decide price or recommendation.** Engine correctness > UI polish.

## Stack
Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui (radix base) ·
Supabase (Postgres + Auth + RLS) · Vitest. No FastAPI, no live RedBook/PPSR/Apify.

## Key product decisions (locked)
- Max Offer = `selectedWholesaleValue − repairCost − riskBuffer`; risk buffer = **5%** of wholesale.
- "Close to asking" band = **within 5% below** asking → Check; more than 5% below → Pass; ≥ asking → Buy.
- Reviewer access: **any authenticated user** can create AND review (no roles table in Slice 1).
- Supabase project ref: **`cmwssucvqtaqkqosrumv`**; URL `https://cmwssucvqtaqkqosrumv.supabase.co`.

## Build chunks — status
- [x] **Chunk 1 — Scaffold** (commit `83d5767`): Next.js+TS+Tailwind+shadcn, Vitest, `.env.example`, Supabase MCP added, agent skills.
- [x] **Chunk 2 — Pricing engine** (commit `f1e8b26`): `src/lib/pricing/{engine,reason-codes,explain}.ts` + tests. Pure, deterministic.
- [x] **Chunk 3 — Mock adapters** (commit `8295690`): `src/lib/adapters/*` (valuation + history mocks, triggers, AdapterError) + tests.
- [x] **Chunk 4 — Validation** (commit `54e2fce`): `src/lib/validation/schema.ts` (zod) + tests.
- [x] **Chunk 5 — DB layer** (commit `1c09664`): `supabase/migrations/0001_init.sql`, `src/types/db.ts`, `src/lib/supabase/{server,client,env}.ts`.
      ⚠️ **Migration SQL written but NOT YET APPLIED to the database.**
- [ ] **Chunk 6 — Auth**: login page, middleware session refresh + gate `(app)/*`, unauthenticated → `/login`.
- [ ] **Chunk 7 — API orchestration**: `src/app/api/assess/route.ts` — validate → save car → run mock valuation + history → run engine → save assessment → return offer payload. Handle adapter failures (AdapterError) gracefully.
- [ ] **Chunk 8 — UI**: car form + **offer card (hero)** on `/assess` (shadcn, minimal).
- [ ] **Chunk 9 — History + review**: `/assessments` list + "Mark Reviewed" action.
- [ ] **Chunk 10 — E2E + README**: Playwright happy path + finance-owing edge + unauth redirect.

Tests so far: **49 passing** (`npm test`). `npx tsc --noEmit` clean.

## ▶ IMMEDIATE NEXT STEP — apply the migration via Supabase MCP
The `supabase` MCP server is configured in `.mcp.json` (project scope). On a fresh
session it should connect (approve it if prompted). Then:
1. Confirm the MCP tools are available (e.g. `mcp__supabase__list_tables`).
2. Apply `supabase/migrations/0001_init.sql` via the MCP `apply_migration` tool
   (project_ref `cmwssucvqtaqkqosrumv`), or run its SQL.
3. Verify the 4 tables exist with RLS enabled, then continue to Chunk 6.
Fallback if MCP unavailable: paste `supabase/migrations/0001_init.sql` into the
Supabase dashboard SQL editor and run it.

## Local env needed before running the app (Chunk 6+)
Create **`.env.local`** (gitignored) from `.env.example`:
- `NEXT_PUBLIC_SUPABASE_URL=https://cmwssucvqtaqkqosrumv.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key from Supabase project API settings>`
- `SUPABASE_SERVICE_ROLE_KEY=<server-only; optional for Slice 1>` (never expose client-side)

## Working agreement
Build in small, testable, committable chunks. Commit per chunk only when the user
asks. Keep pricing logic deterministic and isolated. No new deps without a reason.
