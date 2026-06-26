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
_defensible_ verdict and the most they should pay — not a black box.

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
- **assessments** — engine output + review + buy: repair_cost, risk_buffer,
  max_offer, recommendation, reasoning, reason_codes[], breakdown (jsonb),
  review_status (pending|reviewed), reviewed_by, reviewed_at, created_by,
  history_status (not_checked|checked, `0002`), reviewer_note (`0003`),
  purchase_price / purchased_at / purchase_note / purchased_by (`0004`).

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

| Token      | Effect                                  |
| ---------- | --------------------------------------- |
| `STOLEN`   | history flags stolen → Pass             |
| `WOVR`     | history flags written off → Pass        |
| `FINANCE`  | history flags finance owing → Check     |
| `NOVAL`    | valuation returns no value → Check      |
| `FAILVAL`  | valuation adapter throws (outage) → 503 |
| `FAILHIST` | history adapter throws (outage) → 503   |

A thrown `AdapterError` is an **outage** (→ 503, nothing persisted), distinct
from an adapter succeeding with a null valuation (→ engine Check).

---

## 6. API contract — two-phase assessment (Slice 2)

PPSR searches cost ~$2, so history is deferred behind a user-approved step and
skipped entirely on a price Pass.

**Phase 1 — `POST /api/assess`** (`runPriceAssessment`)

- Auth: 401 if no session. Body: `carInputSchema` (zod); 400 on invalid input/JSON.
- Flow: validate → valuation lookup (no PPSR) → engine with `history: null` →
  persist car/valuation/assessment (`history_status='not_checked'`) → 201 with a
  **provisional** `AssessmentResponse`.
- `provisional: true`; `ppsrEligible = priced && (Buy|Check)`.
- Valuation `AdapterError` → 503, nothing persisted.

**Phase 2 — `POST /api/assessments/[id]/ppsr`** (`runHistoryCheck`)

- Auth: 401. Runs the paid PPSR check → re-runs the engine with history →
  **finalizes the assessment in place** (Buy can flip to Pass/Check), inserts the
  `history_checks` row, sets `history_status='checked'`. Returns the final
  `AssessmentResponse` (`provisional: false`).
- 409 if already checked; 503 on a history outage (nothing changed); 404 if not found.

`AssessmentResponse` (in `src/lib/assess/service.ts`) is the shared offer payload
used by `/assess` and the `/assessments/[id]` detail view.

---

## 7. Build chunks

| #   | Chunk             | Status                  | Notes                                                                                    |
| --- | ----------------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Scaffold          | ✅ `83d5767`            | Next.js+TS+Tailwind+shadcn, Vitest, `.env.example`, Supabase MCP, agent skills           |
| 2   | Pricing engine    | ✅ `f1e8b26`            | Pure deterministic `assess()` + reason codes + explain + tests                           |
| 3   | Mock adapters     | ✅ `8295690`            | Valuation + history mocks, triggers, `AdapterError` + tests                              |
| 4   | Validation        | ✅ `54e2fce`            | `carInputSchema` (zod) + `parseCarInput` + tests                                         |
| 5   | DB layer          | ✅ `1c09664`            | Migration SQL, `types/db.ts`, supabase client helpers                                    |
| —   | Apply migration   | ✅ 2026-06-25           | Applied via Supabase MCP; 4 tables, RLS on                                               |
| 6   | Auth              | ✅ `34671ef`            | `proxy.ts` session refresh + gate, `(app)` group, login + Server Action, DAL, sign-out   |
| 7   | API orchestration | ✅ `eb39a77`            | `/api/assess` + `runAssessment` service + tests                                          |
| 8   | UI                | ✅ `b2d70ff`, `a4291fe` | `/assess` form + hero offer card (verdict + ledger); quick-fill presets + guide dialog   |
| 9   | History + review  | ✅ `dac0c6a`            | `/assessments` list + `/assessments/[id]` detail + "Mark reviewed"                       |
| 10  | E2E + README      | ✅                      | Playwright (unauth-redirect + happy path + finance edge) + README. **Slice 1 complete.** |

### Slice 2 — Deferred PPSR (two-phase) ✅

Built locally and verified live. Engine gains a price-only `provisional` mode
(`history: null`); service splits into `runPriceAssessment` + `runHistoryCheck`;
new `POST /api/assessments/[id]/ppsr`; migration `0002_history_status` (applied);
UI provisional banner + "Run PPSR check (~$2)" button (Buy/Check only) + list
"PPSR pending". 62 Vitest + 4/4 live Playwright; tsc + build clean.

### Slice 3 — Verdicts table dashboard ✅

`/assessments` upgraded from a list to a dashboard: global stat cards, a client
toolbar (debounced search + verdict/status filter chips), a sortable desktop
table (`components/ui/table.tsx` + `assessments-table.tsx`) with a mobile card
fallback — all driven by URL params. DB-side filter/sort/cap + in-memory search;
pure helpers in `_shared.ts` (unit-tested). New `components/ui/{table,badge}.tsx`;
no new deps. 68 Vitest + 8/8 live Playwright; tsc + build clean.

### Slice 4 — Reviewer notes ✅

Optional free-text note when marking an assessment reviewed (migration
`0003_reviewer_note`). Entered via a Textarea in the detail review form, shown
under the reviewed line.

### Polish passes ✅ (no paid API)

Global nav + home launchpad; engine `OFFER_NON_VIABLE` (repairs+buffer exceed
value → Pass); centralized verdict tokens (`src/lib/verdict-style.ts`); **dark
mode** (system + toggle); form ergonomics (mobile single-column, `$` mono inputs,
inline on-blur validation); **loading skeletons** + **not-found/error**
boundaries; light a11y pass.

### Source data on the offer card ✅

The offer card + detail show the **mock RedBook** valuation (wholesale/retail
ranges + selected) and the **PPSR** checks (Clear/Flagged + notes), so a reviewer
can cross-reference inputs → verdict. Valuation range columns plumbed through
`runHistoryCheck` + the detail query (were nulled). `verdict.tsx`.

### Purchase tracking ✅

Record the actual buy and report on it. Migration `0004_purchase`
(`purchase_price`/`purchased_at`/`purchase_note`/`purchased_by` on assessments).
`recordPurchase` action; **saved vs asking** = asking − price paid
(`purchaseSavings`); an "Open & record purchase" action on the assess result.

### Reporting pass — top action dialogs · CSV export · /dashboard ✅

Make the tool reportable for a supervisor:
- **Detail top action bar** — PPSR / **Mark reviewed** / **Record purchase** moved
  *above* the verdict as buttons that open radix **popup dialogs**
  (`record-purchase-dialog.tsx`, `mark-reviewed-dialog.tsx`); state shows as
  badges with a saved-vs-asking line.
- **Filter-aware CSV export** — shared `fetchFilteredAssessments` (`_query.ts`) +
  `getAssessmentStats` (`_stats.ts`) extracted from `/assessments`; new
  `GET /api/assessments/export` streams `text/csv` honouring the *same* filters
  (Purchased filter → a deals export). `_csv.ts` is unit-tested.
- **Dedicated `/dashboard`** — supervisor reports: Deals money story (Purchased ·
  Total spent · Saved vs asking) + verdict bars + pipeline; "Dashboard" added to
  the nav. `/assessments` stays the working queue.

### Assess UX — fast next-car loop ✅

Triaging the next car no longer means hand-clearing fields. An **"Assess
another"** button at the top of the result column wipes the form, clears the
result, and focuses Plate (focus also lands there after a verdict, so Enter
starts the next car). Editing a field after a verdict marks it **stale** — the
offer card dims and its actions (Run PPSR / Open & record purchase, which point
at the old assessment) are withdrawn behind an "Inputs changed — re-run" note;
re-running clears it. Result column got `role="status" aria-live`; mobile scrolls
the result into view after submit. Client-only (`assess/assess-form.tsx`).

### Mobile-friendly layout pass ✅

Responsive sweep at ~375–390px (className-only). The `/assessments` Deals strip
was `grid-cols-3` on every screen (cramped) → `grid-cols-1 sm:grid-cols-3` to
match the dashboard — the only real overflow source. Page shells + header
`px-6` → `px-4 sm:px-6`; the `/assessments` and `/dashboard` headers stack on
mobile; home hero scales down; detail identity line gets `break-words`. Verified
no horizontal overflow at 375px across all routes. Table↔card swap, toolbar, and
dialogs were already mobile-safe; button/touch-target sizing left as the
intentional compact scale.

### Two-step assess flow on mobile ✅

The side-by-side `/assess` layout only earns its keep on desktop (seeing inputs
next to the verdict ledger). On a phone it became a long scroll, so mobile is now
two steps: form is the screen → submit → result is the screen (form + scenario
toolbar hidden), with **"← Edit details"** (back, values intact) and **"Assess
another"** (fresh). Desktop keeps the live two-column flow unchanged. Driven by a
derived `showResultStep` toggling visibility classes — no route change,
client-only (`assess/assess-form.tsx`).

Current totals: **77 Vitest + 16/16 live Playwright**, tsc + build clean;
migrations `0001`–`0004` applied.

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
