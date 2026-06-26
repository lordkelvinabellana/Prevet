# Codebase Guide — Car Pre-Vetting Tool

A plain-English walkthrough of how this app is built and how it works, written
so you (or an AI assistant like ChatGPT) can understand it deeply. The **pricing
logic** is the heart of the product and gets the most attention below.

> Companion docs: **PLAN.md** (the full plan & decisions), **PROGRESS.md** (build
> status), **README.md** (setup & run). This file is the *conceptual* tour.

---

## 1. What the app does, in one paragraph

A used-car dealer's staff member enters a car (plate/VIN, make, model, year, km,
the seller's asking price, and estimated repair cost). The app works in **two
phases** so it never pays for a search it doesn't need:

1. **Price phase** — it fetches a **valuation** (what the car is worth wholesale)
   and runs a **deterministic pricing engine** to compute the **maximum offer**
   and a *provisional* recommendation — **Buy**, **Pass**, or **Check** — based
   on price alone.
2. **History phase (PPSR)** — only if the car is still in play (Buy/Check) and the
   user chooses to, it runs a paid **history check** (stolen, written off, finance
   owing) and re-runs the engine to finalize the verdict (a Buy can flip to
   Pass/Check). A price **Pass** skips this — no point paying ~$2 to vet a car
   you're rejecting anyway.

The result is saved at each phase so a person can review and sign off on it.

**The single most important rule:** AI never decides the price or the
recommendation. That decision is made by a plain, predictable function you can
read top to bottom. Every result comes with **reason codes** and a
plain-English explanation so a human can verify the math. (Right now the
valuation and history data are *mocked* — deterministic fake data — so there are
no live RedBook/PPSR integrations yet.)

---

## 2. The mental model (how the pieces fit)

Think of it as a pipeline. A request flows down through layers, each with one
job:

```
┌─────────────────────────────────────────────────────────────┐
│ UI:  the /assess form  +  the offer card (the "verdict")      │  src/app/(app)/assess/
└───────────────┬───────────────────────────────────────────────┘
                │  HTTP POST (JSON)
                ▼
┌─────────────────────────────────────────────────────────────┐
│ API route:  POST /api/assess                                  │  src/app/api/assess/route.ts
│   1. Is the user logged in?            (else 401)             │
│   2. Is the input valid?               (else 400)            │
└───────────────┬───────────────────────────────────────────────┘
                │  validated CarInput
                ▼
┌─────────────────────────────────────────────────────────────┐
│ Service (orchestration):  runAssessment()                     │  src/lib/assess/service.ts
│   a. look up valuation + history (the adapters)              │
│   b. run the pricing engine          ◄── the brain          │
│   c. save car, valuation, history, assessment to the DB      │
│   d. return the "offer payload"                              │
└───────┬───────────────────────────┬───────────────────────────┘
        │                           │
        ▼                           ▼
┌──────────────────┐      ┌────────────────────────────────────┐
│ Adapters (mock)  │      │ Pricing engine (PURE, deterministic) │  src/lib/pricing/
│ valuation +      │      │   assess(input) -> { maxOffer,       │
│ history          │      │     recommendation, reasonCodes }    │  ◄── never uses AI
└──────────────────┘      └────────────────────────────────────┘
```

*(The orchestration is now **two-phase** — `runPriceAssessment` then, on demand,
`runHistoryCheck` for PPSR; see §4.8. The diagram above shows the single
conceptual pipeline.)*

**Why split it this way?** The pricing engine is *isolated and pure* — it takes
numbers and booleans in, returns a decision out, touches no database, no
network, no AI. That makes it trivial to test, impossible to make
non-deterministic, and easy to audit. The adapters hide *where* the data comes
from (today: mocks; tomorrow: real RedBook/PPSR) behind interfaces, so swapping
in real data never touches the engine.

---

## 3. Where everything lives

```
src/
  app/
    (app)/                     ← the signed-in area (everything here requires login)
      assess/
        page.tsx               the /assess screen shell
        assess-form.tsx        the car input form (client component)
        verdict.tsx            the offer card ("the verdict" + the calculation ledger)
        presets.ts             one-click demo scenarios
        guide.tsx              the "How to fill this in" help dialog
      assessments/
        page.tsx               the list of saved assessments
        [id]/page.tsx          one assessment's detail view
        actions.ts             the "Mark reviewed" server action
      layout.tsx               header + the auth gate for the whole (app) area
      page.tsx                 the home screen
    api/assess/route.ts        POST /api/assess  (auth + validate + call service)
    login/                     login page + sign-in server action
  lib/
    pricing/                   ★ THE PRICING LOGIC ★
      engine.ts                assess() + calculateMaxOffer() + the constants
      reason-codes.ts          the list of reason codes + the Recommendation type
      explain.ts               turns a result into plain-English text + formatAud()
    adapters/                  the (mock) data sources
      valuation.mock.ts        fake RedBook valuation
      history.mock.ts          fake PPSR history check
      mock-triggers.ts         the "magic token" scenario system + a hash function
      types.ts                 adapter interfaces + AdapterError
    validation/schema.ts       the zod input rules (what a valid car looks like)
    verdict-style.ts           Buy/Pass/Check colour + label tokens (one source)
    assess/service.ts          runPriceAssessment + runHistoryCheck (two-phase)
    supabase/                  database/auth clients + session refresh
    auth/dal.ts                getUser() / requireUser()
  proxy.ts                     Next.js 16's renamed "middleware": refresh session + gate routes
  types/db.ts                  TypeScript shapes of the database rows
supabase/migrations/0001_init.sql   the database schema + security rules (RLS)
tests/                         unit tests; tests/e2e/ are the browser tests
```

---

## 4. ★ The pricing logic (deep dive) ★

This is `src/lib/pricing/engine.ts`. Read this section slowly — it's the whole
product.

### 4.1 The formula

```
Max Offer = Selected Wholesale Value − Repair Cost − Risk Buffer
```

- **Selected Wholesale Value** — what the car is worth at wholesale (what a
  dealer pays, not the retail sticker price). Comes from the valuation adapter.
  Can be `null` if no valuation is available.
- **Repair Cost** — the staff member's estimate of what it'll cost to make the
  car sellable. Entered on the form.
- **Risk Buffer** — a safety margin held back, set to **5% of the wholesale
  value**. It protects against surprises (hidden faults, soft market).

All figures are rounded to whole dollars.

### 4.2 The two tunable rates (constants at the top of the engine)

```ts
export const RISK_BUFFER_RATE = 0.05; // risk buffer = 5% of wholesale value
export const CLOSE_BAND_RATE  = 0.05; // "close to asking" = within 5% below asking
```

- `RISK_BUFFER_RATE` decides how much margin to hold back.
- `CLOSE_BAND_RATE` decides how forgiving the "Check" band is (explained next).

Both can be overridden per call (the engine accepts optional `riskBufferRate` /
`closeBandRate`), but they default to these constants.

### 4.3 The decision: Buy / Pass / Check

After computing the max offer, the engine decides the recommendation by checking
conditions **in a fixed order — first match wins.** The order *is* the
precedence: dangerous/blocking conditions are checked first, so they win over
price considerations.

```
1. Is it stolen?            → PASS   (hard stop)
2. Is it written off?       → PASS   (hard stop)
3. Is finance owing?        → CHECK  (must verify/clear the debt first)
4. Is there no valuation?   → CHECK  (can't price it — go get a valuation)
5. maxOffer ≤ 0?            → PASS   (repairs + buffer exceed the car's value — no viable offer)
6. maxOffer ≥ asking?       → BUY    (you can meet or beat their price)
7. maxOffer within 5% below asking?  → CHECK  (close — negotiation might close the gap)
8. otherwise (well below)   → PASS   (their price is too high for you)
```

Steps 1–4 are about *safety and data*; steps 5–8 are about *price/viability*. Notice that
a stolen car returns **Pass** even though a max offer was still calculated — the
number exists, but the hard stop overrides it.

**The "close band" (step 6) explained.** If your max offer is *below* the asking
price but not by much, that's a "Check" (worth a human negotiating), not an
outright "Pass". "Not by much" = within `CLOSE_BAND_RATE` (5%) below asking:

```
closeThreshold = asking × (1 − 0.05) = asking × 0.95
if maxOffer ≥ closeThreshold  → Check   (within 5% below)
else                          → Pass    (more than 5% below)
```

### 4.4 The reason codes (why explainability works)

Every decision returns one or more **reason codes** (from
`src/lib/pricing/reason-codes.ts`). The first code is the *deciding* reason.

| Reason code                 | Recommendation | Meaning                                            |
| --------------------------- | -------------- | -------------------------------------------------- |
| `HISTORY_STOLEN`            | Pass           | History check reports the car as stolen.           |
| `HISTORY_WRITTEN_OFF`       | Pass           | On the Written-Off Vehicle Register.               |
| `HISTORY_FINANCE_OWING`     | Check          | Finance still owing — clear the debt first.        |
| `VALUATION_MISSING`         | Check          | No valuation, so no max offer can be computed.     |
| `OFFER_NON_VIABLE`          | Pass           | Repairs + risk buffer exceed the car's value (max offer ≤ 0). |
| `OFFER_AT_OR_ABOVE_ASKING`  | Buy            | Max offer ≥ asking price.                          |
| `OFFER_CLOSE_TO_ASKING`     | Check          | Max offer within 5% below asking (negotiable).     |
| `OFFER_BELOW_ASKING`        | Pass           | Max offer clearly below asking.                    |

`src/lib/pricing/explain.ts` turns these codes + the computed numbers into a
stable, template-based English sentence (no AI). For example, a Buy renders:
*"Max offer of $28,712 is at or above the seller's asking price of $25,000.
Calculation: $30,750 wholesale − $500 repairs − $1,538 risk buffer = $28,712 max
offer."*

### 4.5 Worked examples

All use the same car the demo presets use: a **2018 Toyota Corolla, 90,000 km**,
which the mock valuation prices at **$30,750 wholesale**. With **$500 repairs**:

```
risk buffer = round(30,750 × 0.05) = $1,538
max offer   = 30,750 − 500 − 1,538 = $28,712
```

| Scenario             | Asking  | Logic                                           | Result | Code                       |
| -------------------- | ------- | ----------------------------------------------- | ------ | -------------------------- |
| **Priced to buy**    | $25,000 | 28,712 ≥ 25,000                                 | Buy    | `OFFER_AT_OR_ABOVE_ASKING` |
| **Close to asking**  | $29,500 | 28,712 < 29,500, but ≥ 29,500×0.95 = 28,025     | Check  | `OFFER_CLOSE_TO_ASKING`    |
| **Overpriced**       | $38,000 | 28,712 < 38,000×0.95 = 36,100                   | Pass   | `OFFER_BELOW_ASKING`       |
| **Finance owing**    | any     | history flag short-circuits before price (step 3)| Check | `HISTORY_FINANCE_OWING`    |
| **Stolen**           | any     | hard stop at step 1                             | Pass   | `HISTORY_STOLEN`           |
| **No valuation**     | any     | wholesale is null → max offer null → step 4     | Check  | `VALUATION_MISSING`        |

### 4.6 The engine code, annotated

```ts
export function assess(input: PricingInput): PricingResult {
  const riskBufferRate = input.riskBufferRate ?? RISK_BUFFER_RATE; // default 5%
  const closeBandRate  = input.closeBandRate  ?? CLOSE_BAND_RATE;  // default 5%
  const { selectedWholesaleValue } = input.valuation;

  // Max Offer = wholesale − repairs − (5% of wholesale). null if no valuation.
  const { maxOffer, riskBuffer } = calculateMaxOffer(
    selectedWholesaleValue, input.repairCost, riskBufferRate,
  );

  // ... build a `breakdown` object capturing every number used ...

  // First-match-wins decision. Order = precedence.
  if (input.history.stolen)      return result("pass",  HISTORY_STOLEN);       // 1
  if (input.history.writtenOff)  return result("pass",  HISTORY_WRITTEN_OFF);  // 2
  if (input.history.financeOwing)return result("check", HISTORY_FINANCE_OWING);// 3
  if (maxOffer === null)         return result("check", VALUATION_MISSING);    // 4

  const asking = input.sellerAskingPrice;
  if (maxOffer >= asking)        return result("buy",   OFFER_AT_OR_ABOVE_ASKING); // 5

  const closeThreshold = asking * (1 - closeBandRate);              // asking × 0.95
  if (maxOffer >= closeThreshold)return result("check", OFFER_CLOSE_TO_ASKING);    // 6

  return result("pass", OFFER_BELOW_ASKING);                                       // 7
}
```

`calculateMaxOffer` is the arithmetic, kept separate and pure:

```ts
export function calculateMaxOffer(selectedWholesaleValue, repairCost, riskBufferRate) {
  if (selectedWholesaleValue === null) return { maxOffer: null, riskBuffer: null };
  const riskBuffer = Math.round(selectedWholesaleValue * riskBufferRate);
  const maxOffer   = Math.round(selectedWholesaleValue - repairCost - riskBuffer);
  return { maxOffer, riskBuffer };
}
```

### 4.7 Why "deterministic" and "no AI" matter here

- **Deterministic** = same inputs always produce the same output. No randomness,
  no clock, no network. You can reason about it, test it exhaustively, and trust
  it. (The engine has unit tests covering every branch above.)
- **No AI in the decision** = the recommendation is a rule a human wrote and can
  audit. An LLM could *explain* or *assist*, but if it *decided* the price you
  couldn't defend or reproduce the number. For a tool that influences real money
  decisions, that auditability is the point.

### 4.8 Provisional (price-only) mode — the two-phase tie-in

The same `assess()` function powers both phases. Its `history` input can be
`null`, meaning "PPSR not run yet": when it's null the engine **skips the three
history hard-stops** (steps 1–3) and decides on price alone, returning
`provisional: true`. Phase 2 calls `assess()` again with the real history to
produce the final verdict. So the engine has one decision path; "provisional"
just means a history check hasn't been folded in yet. (Code: `src/lib/assess/
service.ts` — `runPriceAssessment` calls the engine with `history: null`;
`runHistoryCheck` re-runs it with the PPSR result and updates the saved row.)

---

## 5. The mock data sources (adapters)

Real integrations (RedBook for valuations, PPSR for history) aren't wired up
yet. Instead, `src/lib/adapters/` provides **deterministic mocks**: given the
same car, they always return the same valuation/history — no randomness — so
tests and demos are repeatable.

- **valuation.mock.ts** depreciates from a $45,000 anchor by the car's age and
  kilometres, plus a small stable per-car "jitter" derived from a hash of its
  identity, then clamps to a sensible range. That's how a 2018/90k Corolla
  deterministically lands on $30,750.
- **history.mock.ts** returns "all clear" unless a scenario token is present.

### Scenario tokens (how to force any outcome)

The mocks look for **magic substrings** in the plate or VIN (case-insensitive).
This lets you demo any path by typing a token into the plate:

| Token      | Effect                                          |
| ---------- | ----------------------------------------------- |
| `STOLEN`   | history says stolen → Pass                      |
| `WOVR`     | history says written off → Pass                 |
| `FINANCE`  | history says finance owing → Check              |
| `NOVAL`    | valuation returns no value → Check              |
| `FAILVAL`  | valuation service "outage" → 503 (nothing saved)|
| `FAILHIST` | history service "outage" → 503 (nothing saved)  |

**Outage vs. missing data are different:** a token like `FAILVAL` makes the
adapter *throw* an `AdapterError` (simulating the service being down) → the API
returns **503** and saves nothing. `NOVAL` makes the adapter *succeed* but report
"no valuation found" → the engine handles that as a **Check**. The service runs
both lookups *before* writing anything, so an outage never leaves half-saved
data.

---

## 6. The other layers (briefly)

### Validation (`src/lib/validation/schema.ts`)
Uses **zod** to define what a valid car submission is (year range, non-negative
km, positive asking price, at least a plate or a VIN, etc.). `parseCarInput()`
returns either clean typed data or a map of field → error message. The same
rules guard the API (server-side) — the client form just surfaces the errors
nicely.

### Auth & security
- **`src/proxy.ts`** — in Next.js 16 the old "middleware" file is renamed
  **"proxy"**. It refreshes the login session on each request and redirects
  signed-out users to `/login`. (It deliberately skips `/api`, which checks auth
  itself.)
- **`src/lib/auth/dal.ts`** — `getUser()` / `requireUser()` are the
  database-backed auth checks used inside pages and the API.
- **Row Level Security (RLS)** — defined in the SQL migrations. The database
  itself enforces access, regardless of app code; anonymous access is denied.
  **Per-user isolation** (migration `0005`): every row is owned via `created_by`
  (default `auth.uid()`), and the policies scope read/update to the owner, so a
  user sees and edits only their own assessments (and their cars/valuations/
  history). The app never filters by `created_by` — RLS does. No roles / shared
  view yet. (Slice 1 originally let any logged-in user read everything; `0005`
  tightened it.)

### Database (`supabase/migrations/0001_init.sql`)
Four tables: **cars**, **valuations**, **history_checks**, **assessments**. The
`assessments` row stores the engine's full output — `recommendation`,
`max_offer`, `risk_buffer`, the `reason_codes`, the human-readable `reasoning`,
and a `breakdown` (JSON) capturing every number — plus the PPSR/review lifecycle
fields (`history_status`, `review_status`, `reviewed_by`, `reviewed_at`,
`reviewer_note`). That stored `breakdown` is what lets the detail page redraw the
exact same offer card later, plus the purchase record (`purchase_price`,
`purchased_at`, `purchase_note`). Schema changes are versioned migrations applied
via the Supabase MCP: `0001_init`, `0002_history_status`, `0003_reviewer_note`,
`0004_purchase`.

### The UI
- **Duplicate-VIN guard** — a car's VIN is unique, so it can't be assessed twice
  (per-user). On VIN blur the form calls `GET /api/cars/vin-check`; if the user
  already has that VIN it shows an amber notice + "View that assessment" link.
  `runPriceAssessment` re-checks on submit and returns `409 duplicate_vin` rather
  than creating a duplicate. The mock valuation jitters off the vehicle *spec*
  (not the VIN), so distinct VINs don't change the valuation.
- **Car photos** — the assess form uploads photos client-side (`assess/photo-
  upload.tsx`, browser Supabase client) to a **private** `car-photos` bucket under
  `<userId>/<uuid>/…` (storage RLS: own folder only); the paths are stored on
  `cars.photos`. The list shows the first as a thumbnail (`assessments/car-thumb.tsx`)
  and the detail page a gallery — both via server-side **signed URLs**
  (`assessments/_photos.ts`, 1 h TTL). Nothing is public.
- **Responsive list** — `/assessments` streams its results behind a keyed
  `<Suspense>` (`assessments-results.tsx` + `results-skeleton.tsx`) so every
  filter/sort/search shows a skeleton; the toolbar shows an `isPending` spinner.
- **assess-form.tsx** collects the car and POSTs to `/api/assess`. The result
  shows in the right column with an **"Assess another"** button on top that
  resets the form for the next car (and is auto-focused after a verdict). Editing
  a field after a verdict marks it **stale** — the offer card dims and its
  actions are withdrawn behind an "Inputs changed — re-run" note — so a shown
  verdict never looks like it matches freshly-typed inputs. On **desktop** the
  form and result sit side by side; on **mobile** they're two steps (form →
  result), with "← Edit details" to go back without losing the entered car.
- **verdict.tsx** renders the result as an "appraisal docket": a colored
  Buy/Pass/Check band, the max offer, and a **subtraction ledger** showing
  `wholesale − repairs − buffer = max offer` so the number is checkable at a
  glance. It also shows a **Source data** panel — the RedBook wholesale/retail
  ranges + selected value, and the PPSR checks as Clear/Flagged — so the inputs
  behind the verdict are visible and cross-referenceable. The same component is
  reused on the assessment detail page.
- **`assessments/` (the working queue)** lists every saved verdict as a sortable,
  filterable, searchable table (cards on mobile) with summary stat cards. All
  state lives in the URL (`?verdict=&status=&q=&sort=&dir=`), so views are
  shareable and the back button works. Filtering/sorting happen in the shared DB
  query (`assessments/_query.ts` → `fetchFilteredAssessments`); stats in
  `assessments/_stats.ts`; the small pure helpers in `assessments/_shared.ts`.
  **Export CSV** streams the *current filtered view* via
  `GET /api/assessments/export` (so the Purchased filter → a deals export).
- **`dashboard/`** is the supervisor reports page: the Deals money story
  (Purchased · Total spent · Saved vs asking), a verdict breakdown with CSS bars,
  and pipeline counts — reusing `getAssessmentStats`. `/assessments` stays the
  working queue.
- **Review & buy** — the detail page puts the actions in a **top bar above the
  verdict**: PPSR, **Mark reviewed**, and **Record purchase** are buttons that
  open popup dialogs (`record-purchase-dialog.tsx` / `mark-reviewed-dialog.tsx` →
  the `assessments/actions.ts` server actions); state shows as badges with a
  saved-vs-asking line. **Dark mode** (system preference + a header toggle), route
  **loading skeletons**, and **not-found / error** boundaries round out the polish.

---

## 7. Glossary (domain terms)

- **Wholesale value** — what a dealer pays for a car (trade price), lower than
  the retail price a customer would pay.
- **Retail value** — the sticker price a consumer pays.
- **RedBook** — an Australian vehicle valuation data provider (mocked here).
- **PPSR** — Personal Property Securities Register; the Australian check for
  finance owing, stolen status, and write-offs (mocked here).
- **WOVR** — Written-Off Vehicle Register.
- **Encumbrance / finance owing** — money still owed on the car by the seller; if
  unpaid it can follow the car to the new owner, hence the "Check".
- **Risk buffer** — the 5% margin held back from the offer for safety.
- **Deterministic** — same input → same output, every time.
- **RLS (Row Level Security)** — database-enforced access rules.

---

## 8. How to use this with ChatGPT

Paste this whole file in and try prompts like:
- "Walk me through what happens, step by step, when I submit a car on /assess."
- "Re-derive the max offer and recommendation for a $30,750 wholesale car with
  $1,200 repairs and a $26,000 asking price. Which reason code fires?"
- "Why is the decision order important? What would break if finance-owing were
  checked *after* the price comparison?"
- "Explain why the pricing engine avoids AI and what trade-offs that makes."
- "If I wanted to change the risk buffer to 7%, what's the single line to edit
  and what else would I need to update (tests, docs)?"

**What to paste (priority order):** (1) **this whole file** — it includes the
function map in §9; (2) **`PLAN.md`**; (3) the engine trio
`src/lib/pricing/{engine,reason-codes,explain}.ts`; (4) optionally
`src/lib/assess/service.ts` (the two-phase orchestration) and
`src/lib/validation/schema.ts`. With those, ChatGPT can answer line-level
questions, not just conceptual ones.

---

## 9. Function & file map (inspect it yourself)

The fastest way to verify any claim above — open these.

**Pricing engine (the decision):**
- `assess(input)` → `src/lib/pricing/engine.ts` — the whole verdict (max offer + Buy/Pass/Check + reason codes + `provisional`).
- `calculateMaxOffer(...)` → `src/lib/pricing/engine.ts` — the arithmetic; `RISK_BUFFER_RATE` / `CLOSE_BAND_RATE` constants live here too.
- `REASON_CODE`, `Recommendation` → `src/lib/pricing/reason-codes.ts`.
- `explain(result)`, `formatAud(n)` → `src/lib/pricing/explain.ts`.

**Mock data sources:**
- `mockValuationAdapter.getValuation(car)` → `src/lib/adapters/valuation.mock.ts`.
- `mockHistoryAdapter.getHistory(car)` → `src/lib/adapters/history.mock.ts`.
- `TRIGGER`, `hasTrigger`, `hashString`, `specKey` (valuation jitter keys off the vehicle spec, not the VIN) → `src/lib/adapters/mock-triggers.ts`; `AdapterError` + interfaces → `src/lib/adapters/types.ts`.

**Validation:** `carInputSchema`, `parseCarInput(input)` → `src/lib/validation/schema.ts`.

**Orchestration (two-phase):** `runPriceAssessment({…})` (phase 1) and `runHistoryCheck({…})` (phase 2 / PPSR), plus the `AssessmentResponse` payload type → `src/lib/assess/service.ts`.

**API routes:** `POST /api/assess` → `src/app/api/assess/route.ts`; `POST /api/assessments/[id]/ppsr` → `src/app/api/assessments/[id]/ppsr/route.ts`; `GET /api/assessments/export` (filter-aware CSV) → `src/app/api/assessments/export/route.ts`; `GET /api/cars/vin-check` (duplicate-VIN lookup) → `src/app/api/cars/vin-check/route.ts`.

**Auth & data access:** `getUser()` / `requireUser()` → `src/lib/auth/dal.ts`; `updateSession(req)` → `src/lib/supabase/session.ts`; route gate `proxy()` → `src/proxy.ts`; Supabase clients → `src/lib/supabase/{server,client}.ts`; `login` → `src/app/login/actions.ts`; `logout` → `src/app/(app)/actions.ts`; `markReviewed` / `recordPurchase` → `src/app/(app)/assessments/actions.ts`; deal/savings helper `purchaseSavings` → `assessments/_shared.ts`.

**UI:** offer card `Verdict` → `src/app/(app)/assess/verdict.tsx` (colours in `src/lib/verdict-style.ts`); form `buildPayload`/`validateField`/`runAssess` → `assess/assess-form.tsx`; `PpsrButton` → `assess/ppsr-button.tsx`; presets → `assess/presets.ts`; queue query `fetchFilteredAssessments` → `assessments/_query.ts`, stats `getAssessmentStats` → `assessments/_stats.ts`, CSV `csvCell`/`assessmentsToCsv` → `assessments/_csv.ts`; table/cards/toolbar/stat-cards in that folder; pure helpers `needsPpsr`/`buildSortHref`/`rowStatus`/`carLabel`/`purchaseSavings` → `assessments/_shared.ts`; detail action bar + dialogs → `assessments/[id]/page.tsx` (+ `record-purchase-dialog.tsx`, `mark-reviewed-dialog.tsx`); reports → `(app)/dashboard/page.tsx`; nav/theme → `(app)/main-nav.tsx`, `(app)/theme-toggle.tsx`.

**Data model:** row types → `src/types/db.ts`; schema + RLS → `supabase/migrations/0001_init.sql` (+ `0002_history_status`, `0003_reviewer_note`, `0004_purchase`, `0005_per_user_isolation`, `0006_car_photos`). Car photos live in the private `car-photos` Storage bucket (own-folder RLS), not a table.
