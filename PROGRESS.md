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
      ✅ **Migration `0001_init` APPLIED** via Supabase MCP (2026-06-25). All 4 tables exist with RLS enabled.
- [x] **Chunk 6 — Auth** (uncommitted): login page + Server Action (`src/app/login/*`), `src/proxy.ts` session refresh + optimistic gate, `(app)/` route group with DB-backed gate (`requireUser` in layout), sign-out, DAL (`src/lib/auth/dal.ts`), session helper (`src/lib/supabase/session.ts`), `Input` component.
      ⚠️ **Next.js 16: `middleware` is renamed to `proxy`** — entry is `src/proxy.ts` (Node runtime). Build + 49 tests green. Needs a real Supabase user to test sign-in end-to-end.
- [x] **Chunk 7 — API orchestration** (uncommitted): `src/app/api/assess/route.ts` (auth → validate → service) + `src/lib/assess/service.ts` (`runAssessment`: lookups → engine → persist → offer payload) + `tests/assess-service.test.ts`.
      Decisions: external lookups run **before** any DB write (no orphan rows); any `AdapterError` → **503, nothing persisted**; a succeeded-but-empty valuation flows to the engine as **Check**. `AssessmentResponse` is the shared offer-payload type for Chunk 8.
- [x] **Chunk 8 — UI** (`b2d70ff`, `a4291fe`): `/assess` form + hero offer card (`verdict.tsx`: colored Buy/Pass/Check band + mono max-offer + subtraction **ledger** + reasoning + flags + codes); quick-fill scenario presets + radix Guide dialog.
- [x] **Chunk 9 — History + review** (uncommitted): `/assessments` list (RLS-scoped, recent first) + `/assessments/[id]` detail (reuses `Verdict`) + **Mark reviewed** server action (`assessments/actions.ts`). Also: **fonts** switched to IBM Plex Sans/Mono and the `--font-sans` wiring bug fixed.
- [x] **Chunk 10 — E2E + README** (uncommitted): Playwright (`playwright.config.ts`, `tests/e2e/*`) — unauth-redirect (runs), happy path + finance-owing edge (skip without `E2E_EMAIL`/`E2E_PASSWORD`); full README. **Slice 1 complete.**

Tests so far: **49 passing** (`npm test`). `npx tsc --noEmit` clean.

## Slice 2 — Deferred PPSR (two-phase assessment) ✅
Built locally (the cloud Ultraplan run stalled — its env had no Supabase keys /
git remote). Cost optimization: only pay the ~$2 PPSR fee on cars still in play.
- **Engine** (`engine.ts`): `history` is now `HistoryFacts | null`; a null history
  → price-only verdict with `provisional: true` (history hard-stops skipped).
  `explain.ts` appends a provisional note.
- **Service** (`assess/service.ts`): split into `runPriceAssessment` (phase 1:
  valuation + price-only, persist `not_checked`) and `runHistoryCheck` (phase 2:
  PPSR → re-run engine → finalize in place; 409 if already run, 503 on outage).
  `AssessmentResponse` gains `provisional` + `ppsrEligible` (Buy/Check & priced).
- **API**: `/api/assess` → `runPriceAssessment`; new `POST /api/assessments/[id]/ppsr`.
- **DB**: migration `0002_history_status` (APPLIED via MCP) adds
  `assessments.history_status` ('not_checked'|'checked'); `db.ts` updated.
- **UI**: provisional banner + "Run PPSR check (~$2)" button (`ppsr-button.tsx`)
  on `/assess` and the detail page (Buy/Check only); "PPSR pending" in the list.

## Slice 3 — Verdicts table dashboard ✅
`/assessments` is now a dashboard, not a flat list. Server-rendered + RLS-scoped;
all state in URL params (shareable, back-button friendly).
- **Stat cards** (global): total, Buy/Check/Pass, awaiting PPSR, awaiting review.
- **Toolbar** (`assessments-toolbar.tsx`, client): debounced search (plate/make/
  model) + verdict & status (needs-PPSR / needs-review) filter chips.
- **Sortable table** desktop (`assessments-table.tsx`, `components/ui/table.tsx`),
  **cards** on mobile (`assessment-card.tsx`); sort via column-header links.
- DB-side filter + sort + 500 cap; text search in memory (spans the joined car).
- Pure helpers in `_shared.ts` (`needsPpsr`, `buildSortHref`, …) + unit tests.
- New primitives: `components/ui/{table,badge}.tsx`. No new deps.

## ▶ STATUS — Slices 1–3 complete
Full flow works and is **verified live**: sign in → price-only provisional verdict
→ (if Buy/Check) run PPSR → finalized verdict → saved → review & triage in the
`/assessments` dashboard → mark reviewed.

Tests: **68 Vitest passing** + Playwright **8/8 against the live Supabase DB**
(PPSR two-phase + table search/filter/sort/row-nav/mobile). `npx tsc --noEmit` +
`next build` clean. Migrations `0001`, `0002` applied.

### UX polish (post-Slice 3)
Global nav added to the `(app)` layout (`main-nav.tsx`) — sticky header with
brand mark + active-highlighted **New assessment** / **Assessments** links, so
no more typing URLs. Home (`(app)/page.tsx`) reworked into a launchpad (hero +
3-step how-it-works). Fixed the assessments table Car column wrapping.

### Polish & hardening pass (no paid API)
- **Logic**: new `OFFER_NON_VIABLE` reason code → Pass when repairs + buffer
  exceed value (instead of a confusing negative offer); model-year bound bumped
  (max 2027); "Reviewed by you" attribution on the detail page.
- **DRY**: verdict colour/label tokens centralized in `src/lib/verdict-style.ts`.
- **Dark mode**: wired — `.dark` + system preference + nav toggle, no FOUC.
- **Form/login**: mobile single-column (`grid-cols-1 sm:grid-cols-2`), `$` mono
  money inputs, clear-error-on-edit, login brand mark. Design context in
  `.impeccable.md`.
- Tests: **72 Vitest** + **10/10 live Playwright** (non-viable engine cases,
  dark-toggle persistence, mobile single-column).

### MVP polish — finish the rough edges (no paid API)
- **Loading states**: `Skeleton` primitive + `loading.tsx` for `/assessments`,
  `/assessments/[id]`, `/assess` — instant feedback during RSC navigation.
- **Boundaries**: `(app)/not-found.tsx` (bad assessment id) and `(app)/error.tsx`
  (retryable) so failures look intentional.
- **Inline validation**: per-field on-blur in the assess form; `requiredText`
  now says "X is required" for missing/empty (was zod's raw type error).
- **a11y**: focus-visible rings (row link + chips), amber contrast bump.
- Tests now: **72 Vitest** + **12/12 live Playwright** (added inline-error +
  not-found). `npx tsc --noEmit` + `next build` clean.

## Slice 4 — Reviewer notes ✅
Reviewers can leave an optional free-text note when marking an assessment
reviewed (migration `0003_reviewer_note`, applied via MCP → `assessments.
reviewer_note`). Entered via a Textarea in the detail review form, shown under
the reviewed line. New `components/ui/textarea.tsx`. 72 Vitest + 12/12 live
Playwright (happy path enters a note and asserts it displays).

## Source data on the offer card ✅
The offer card (and detail) now shows the **mock RedBook** valuation
(wholesale/retail ranges + selected) and the **PPSR** checks (Clear/Flagged +
notes), so a non-technical reviewer can cross-reference inputs → verdict. Plumbed
the valuation range columns through `runHistoryCheck` + the detail query (were
nulled). `verdict.tsx`. 72 Vitest + 12/12 live Playwright.

## Purchase tracking + dashboard UX ✅
Record the actual buy and report on it. Migration `0004_purchase` (price/at/
note/by on assessments). `recordPurchase` action; detail Purchase panel showing
**saved vs asking** (`purchaseSavings`); an "Open & record purchase" action on the
assess result. Dashboard gains a **Deals** strip (Purchased · Total spent · Saved)
above the pipeline counts + a **Purchased** filter; table/cards restyled for
hierarchy (bold max offer, muted secondary, coloured status, "Bought $X").
75 Vitest + 13/13 live Playwright; migrations `0001`–`0004` applied.

## Reporting pass — top action dialogs · CSV export · /dashboard ✅
Made the tool reportable for a supervisor (commits `aeb1b11`, `c45ba99`, `47c8804`).
- **Detail top action bar** (`assessments/[id]/page.tsx`): the actions moved
  *above* the verdict. PPSR / **Mark reviewed** / **Record purchase** are buttons
  that open radix **popup dialogs** (`record-purchase-dialog.tsx`,
  `mark-reviewed-dialog.tsx` — form `action` → server action in a `startTransition`
  → closes on success; `revalidatePath` refreshes). State shows as badges
  ("✓ Reviewed", "Bought $X" + Edit) with a saved-vs-asking line.
- **Filter-aware CSV export**: shared `fetchFilteredAssessments` (`_query.ts`) +
  `getAssessmentStats` (`_stats.ts`) extracted from `/assessments`; new
  `GET /api/assessments/export` streams `text/csv` honouring the *same* filters
  (Purchased filter → deals export). `_csv.ts` (`csvCell` + `assessmentsToCsv`,
  unit-tested). "Export CSV" button on `/assessments` carries the current params.
- **Dedicated `/dashboard`** (`(app)/dashboard/page.tsx`): supervisor reports —
  Deals money story (Purchased · Total spent · Saved vs asking), verdict
  breakdown with CSS bars, pipeline counts, Export CSV / New assessment CTAs;
  empty state. Added **Dashboard** to the nav (which now scrolls on narrow
  screens). `/assessments` stays the working queue.
- Tests: **77 Vitest** + **14/14 live Playwright** (purchase-via-dialog,
  mark-reviewed-via-dialog, dashboard metrics + CSV download). `tsc` + build clean.

## Assess UX — fast next-car loop ✅
Triaging the next car no longer means hand-clearing every field (commit
`fce773e`, all in `assess/assess-form.tsx`):
- **"Assess another"** primary button at the top of the result column wipes the
  form, clears the result, and focuses **Plate**. Focus also lands there after a
  verdict, so Enter starts the next car.
- **Stale verdict**: editing any field after a verdict dims the offer card to
  0.6, withdraws its actions (Run PPSR / Open & record purchase — they point at
  the *old* assessment), and shows an amber "Inputs changed — re-run" note;
  re-running clears it. A shown verdict can never look like it matches
  freshly-typed inputs.
- Result column got `role="status" aria-live="polite"`; on mobile the result
  scrolls into view after submit and Plate scrolls back after reset.
- 77 Vitest + **15/15 live Playwright** (new: edit → stale → "Assess another"
  resets); tsc + build clean.

### Possible next slices (not started)
- Roles (creator vs reviewer).
- Projected margin / resale revenue (deferred); edit/re-run an assessment; deploy.
- A real RedBook valuation adapter (and real PPSR) behind the existing interfaces.
- Generated Supabase types (`supabase gen types`) replacing hand-written `db.ts`.
- Pagination beyond the 500 result cap.

## Local env needed before running the app (Chunk 6+)
Create **`.env.local`** (gitignored) from `.env.example`:
- `NEXT_PUBLIC_SUPABASE_URL=https://cmwssucvqtaqkqosrumv.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key from Supabase project API settings>`
- `SUPABASE_SERVICE_ROLE_KEY=<server-only; optional for Slice 1>` (never expose client-side)

## Working agreement
Build in small, testable, committable chunks. Commit per chunk only when the user
asks. Keep pricing logic deterministic and isolated. No new deps without a reason.
