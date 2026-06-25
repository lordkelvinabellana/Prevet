# Car Pre-Vetting Tool — Plan & Chunks

> The detailed, durable plan for this capstone. `PROGRESS.md` tracks live build
> status and the immediate next step; this file is the stable reference for
> **what we're building, why, and how it fits together**. Read both.

---

## 1. Product in one line

A pre-vetting tool for **CarWow WA** (a Perth used-car dealer): a staff member
enters a car → the tool fetches a (mock) valuation and a (mock) history check →
a **deterministic** engine computes the maximum offer and a **Buy / Pass /
Check** recommendation → the result is saved for **human review**.

**Hard rule: AI must NOT decide price or the recommendation.** The pricing
engine is a pure, explainable function. Engine correctness matters more than UI
polish. Every result carries reason codes and a plain-English explanation so a
human can check the math.

### Who it's for
Dealership staff appraising many cars a day. They need a fast, trustworthy,
*defensible* verdict and the most they should pay — not a black box.

---

## 2. Locked product decisions

- **Max Offer** = `selectedWholesaleValue − repairCost − riskBuffer`.
- **Risk buffer** = **5%** of the selected wholesale value.
- **Recommendation bands** (max offer vs seller asking):
  - max offer **≥ asking** → **Buy**
  - max offer within **5% below** asking → **Check** (negotiable)
  - max offer **more than 5% below** asking → **Pass**
- **Hard stops** (history, checked first, in this precedence):
  - stolen → **Pass**
  - written off → **Pass**
  - finance owing → **Check** (verify payout / clear encumbrance)
  - no valuation available → **Check** (can't price)
- **Access model (Slice 1):** any authenticated user can both **create** and
  **review**. No roles table yet.
- **Mock-only data:** no live RedBook / PPSR / Apify. Mocks are deterministic.
- **Supabase project ref:** `cmwssucvqtaqkqosrumv`
  (`https://cmwssucvqtaqkqosrumv.supabase.co`).

---

## 3. Stack & architecture

- **Next.js 16** (App Router, Turbopack) · TypeScript · React 19
- **Tailwind v4** · shadcn/ui (radix-nova style, radix-ui primitives)
- **Supabase** — Postgres + Auth + RLS; `@supabase/ssr` for cookie-based auth
- **Vitest** for unit tests; Playwright for E2E (Chunk 10)
- **Fonts:** IBM Plex Sans (UI) + IBM Plex Mono (all figures/data)

### Next.js 16 gotchas (this is NOT older Next.js)
- `middleware` is renamed to **`proxy`** → entry is `src/proxy.ts`, Node.js
  runtime. (See `node_modules/next/dist/docs/.../proxy.md`.)
- `cookies()` is **async** (`await cookies()`).
- Route handlers / server actions verify auth themselves (proxy excludes `/api`).

### Layered design
```
UI (forms, offer card)                         src/app/(app)/**
  → POST /api/assess (auth + validate)         src/app/api/assess/route.ts
    → runAssessment service (orchestration)    src/lib/assess/service.ts
      → adapters (mock valuation + history)     src/lib/adapters/**
      → pricing engine (pure, deterministic)    src/lib/pricing/**   ← decides price
      → persistence (Supabase, RLS-scoped)      src/lib/supabase/**
```
The pricing engine is isolated and pure: no I/O, no DB, no AI. Adapters
implement interfaces so real RedBook/PPSR integrations can drop in later without
touching the engine or orchestration.

---

## 4. Data model (`supabase/migrations/0001_init.sql`)

Four tables, **RLS enabled on every one** (anon denied; authenticated can read
all, insert their own, and update assessments for review):

- **cars** — identity (plate/vin, ≥1 required), year/make/model/trim, km,
  seller_asking_price, created_by (= `auth.uid()`).
- **valuations** — RedBook-style; wholesale/retail low/high +
  selected_wholesale_value (nullable when no valuation). FK → cars (cascade).
- **history_checks** — PPSR-style; finance_owing / stolen / written_off + notes.
  FK → cars (cascade).
- **assessments** — engine output + review: repair_cost, risk_buffer, max_offer,
  recommendation, reasoning, reason_codes[], breakdown (jsonb), review_status
  (pending|reviewed), reviewed_by, reviewed_at, created_by.

Row types are hand-maintained in `src/types/db.ts`.

---

## 5. The deterministic engine (`src/lib/pricing/`)

- **engine.ts** — `assess(input): PricingResult` and `calculateMaxOffer(...)`.
  Constants: `RISK_BUFFER_RATE = 0.05`, `CLOSE_BAND_RATE = 0.05`.
- **reason-codes.ts** — the `REASON_CODE` enum, `Recommendation` type.
- **explain.ts** — `explain(result)` renders template-based plain English (no
  AI) + `formatAud()`.

Decision order (first match wins): stolen → written off → finance owing →
no valuation → offer≥asking → offer within close band → offer below asking.

### Mock adapters (`src/lib/adapters/`)
Deterministic functions of car identity (no randomness). **Scenario tokens**
(case-insensitive substring of plate or VIN) force outcomes:

| Token      | Effect                                   |
| ---------- | ---------------------------------------- |
| `STOLEN`   | history flags stolen → Pass              |
| `WOVR`     | history flags written off → Pass         |
| `FINANCE`  | history flags finance owing → Check      |
| `NOVAL`    | valuation returns no value → Check        |
| `FAILVAL`  | valuation adapter throws (outage) → 503  |
| `FAILHIST` | history adapter throws (outage) → 503    |

A thrown `AdapterError` is an **outage** (→ 503, nothing persisted), distinct
from an adapter succeeding with a null valuation (→ engine Check).

---

## 6. API contract — `POST /api/assess`

- **Auth:** 401 if no session.
- **Body:** JSON matching `carInputSchema` (zod). 400 with `{ fields }` on
  validation failure; 400 on invalid JSON.
- **Flow:** validate → external lookups (before any write) → engine → persist
  car/valuation/history/assessment → 201 with `AssessmentResponse`.
- **Failures:** any `AdapterError` → 503 `{ error, code }`, nothing persisted;
  persistence failure → 500.

`AssessmentResponse` (in `src/lib/assess/service.ts`) is the shared offer
payload used by both `/assess` and the `/assessments/[id]` detail view.

---

## 7. Build chunks

| # | Chunk | Status | Notes |
|---|-------|--------|-------|
| 1 | Scaffold | ✅ `83d5767` | Next.js+TS+Tailwind+shadcn, Vitest, `.env.example`, Supabase MCP, agent skills |
| 2 | Pricing engine | ✅ `f1e8b26` | Pure deterministic `assess()` + reason codes + explain + tests |
| 3 | Mock adapters | ✅ `8295690` | Valuation + history mocks, triggers, `AdapterError` + tests |
| 4 | Validation | ✅ `54e2fce` | `carInputSchema` (zod) + `parseCarInput` + tests |
| 5 | DB layer | ✅ `1c09664` | Migration SQL, `types/db.ts`, supabase client helpers |
| — | Apply migration | ✅ 2026-06-25 | Applied via Supabase MCP; 4 tables, RLS on |
| 6 | Auth | ✅ `34671ef` | `proxy.ts` session refresh + gate, `(app)` group, login + Server Action, DAL, sign-out |
| 7 | API orchestration | ✅ `eb39a77` | `/api/assess` + `runAssessment` service + tests |
| 8 | UI | ✅ `b2d70ff`, `a4291fe` | `/assess` form + hero offer card (verdict + ledger); quick-fill presets + guide dialog |
| 9 | History + review | ✅ `dac0c6a` | `/assessments` list + `/assessments/[id]` detail + "Mark reviewed" |
| 10 | E2E + README | ✅ | Playwright (unauth-redirect + happy path + finance edge) + README. **Slice 1 complete.** |

---

## 8. Conventions / working agreement

- Build in small, testable, committable chunks. **Commit per chunk.**
- Keep pricing logic deterministic and isolated. **No AI in the price path.**
- No new dependencies without a reason.
- Read the bundled Next.js 16 docs before using a framework API — it differs
  from older versions.

## 9. Running locally

1. `.env.local` (gitignored, from `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL=https://cmwssucvqtaqkqosrumv.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>`
2. `npm run dev` → http://localhost:3000 → sign in (create a user in the
   Supabase dashboard) → **New assessment**.
3. `npm test` (Vitest), `npx tsc --noEmit`, `npx next build` to verify.
