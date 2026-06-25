# Car Pre-Vetting Tool

A pre-vetting tool for **CarWow WA** (a Perth used-car dealer). Staff enter a
car; the tool fetches a (mock) valuation and history check, runs a
**deterministic** pricing engine, and returns a **max offer** with a
**Buy / Pass / Check** recommendation — saved for human review.

> **Core rule:** AI never decides the price or the recommendation. The pricing
> engine is a pure, explainable function; every result carries reason codes and
> a plain-English explanation so a human can check the math.

For the full plan, architecture, and data model see **[PLAN.md](./PLAN.md)**;
for live build status see **[PROGRESS.md](./PROGRESS.md)**; for a guided,
plain-English tour of the codebase and the pricing logic see
**[CODEBASE_GUIDE.md](./CODEBASE_GUIDE.md)**.

## Stack

Next.js 16 (App Router) · TypeScript · React 19 · Tailwind v4 · shadcn/ui ·
Supabase (Postgres + Auth + RLS) · Vitest · Playwright. Fonts: IBM Plex Sans /
Mono. Data is mock-only (no live RedBook / PPSR).

## Setup

1. **Install**

   ```bash
   npm install
   ```

2. **Environment** — copy `.env.example` to `.env.local` (gitignored) and fill
   in from your Supabase project settings (Project Settings → API):

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://cmwssucvqtaqkqosrumv.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
   ```

3. **Database** — the schema lives in `supabase/migrations/0001_init.sql`
   (already applied to the project). To apply to a fresh project, run that SQL
   in the Supabase SQL editor or via the Supabase MCP / CLI.

4. **Create a user** — Supabase dashboard → Authentication → Users → Add user.
   Any authenticated user can create and review (Slice 1 has no roles).

## Run

```bash
npm run dev      # http://localhost:3000
```

Sign in, then **New assessment**. Use a **quick-fill** chip to load and run a
scenario in one click, or read **How to fill this in** for the field guide.

### Scenario tokens

The mock adapters are deterministic. Put any of these in the **plate** (or VIN)
to force an outcome:

| Token      | Outcome                              |
| ---------- | ------------------------------------ |
| `STOLEN`   | history flags stolen → **Pass**      |
| `WOVR`     | history flags written off → **Pass** |
| `FINANCE`  | finance owing → **Check**            |
| `NOVAL`    | no valuation → **Check**             |
| `FAILVAL`  | valuation outage → **503**           |
| `FAILHIST` | history outage → **503**             |

## Test

```bash
npm test             # Vitest unit tests (engine, adapters, validation, service)
npx tsc --noEmit     # type check
npm run build        # production build

# End-to-end (Playwright). The redirect test runs unauthenticated; the flow
# tests need a real Supabase user and self-skip without credentials:
npm run test:e2e
E2E_EMAIL=you@example.com E2E_PASSWORD=secret npm run test:e2e
```

## Project structure

```
src/
  app/
    (app)/                 authenticated area (gated by proxy + layout)
      assess/              car form + hero offer card (+ presets, guide)
      assessments/         saved list, detail, "mark reviewed" action
    api/assess/route.ts    POST: auth → validate → assess → persist
    login/                 login page + sign-in server action
  lib/
    pricing/               deterministic engine, reason codes, explain  ← decides price
    adapters/              mock valuation + history, scenario triggers
    validation/            zod input schema
    assess/service.ts      orchestration: lookups → engine → persist
    supabase/              SSR clients, session refresh, env
    auth/dal.ts            getUser / requireUser
  proxy.ts                 Next.js 16 "proxy" (renamed middleware): session + gate
supabase/migrations/       SQL schema + RLS
tests/                     Vitest unit tests; e2e/ Playwright specs
```
