import type { SupabaseClient } from "@supabase/supabase-js";
import { assess, type PricingBreakdown } from "@/lib/pricing/engine";
import { explain } from "@/lib/pricing/explain";
import type { Recommendation, ReasonCode } from "@/lib/pricing/reason-codes";
import {
  AdapterError,
  type CarIdentity,
  type HistoryAdapter,
  type HistoryResult,
  type ValuationAdapter,
  type ValuationResult,
} from "@/lib/adapters/types";
import { mockValuationAdapter } from "@/lib/adapters/valuation.mock";
import { mockHistoryAdapter } from "@/lib/adapters/history.mock";
import type { CarInput } from "@/lib/validation/schema";

/**
 * Assessment is a two-phase flow so we never pay for a PPSR search on a car
 * we'll Pass on anyway:
 *
 *   Phase 1 — runPriceAssessment(): valuation + a *provisional*, price-only
 *             verdict. No PPSR. Persists the car/valuation/assessment.
 *   Phase 2 — runHistoryCheck(): only when the user opts in. Runs the (paid)
 *             PPSR check, re-runs the engine with history, and finalizes the
 *             assessment in place (a Buy can flip to Pass/Check).
 *
 * The deterministic engine remains the sole decider of price/recommendation.
 */
export interface AssessmentResponse {
  assessmentId: string;
  carId: string;
  recommendation: Recommendation;
  maxOffer: number | null;
  riskBuffer: number | null;
  reasonCodes: ReasonCode[];
  reasoning: string;
  breakdown: PricingBreakdown;
  valuation: ValuationResult;
  /** Null until a PPSR history check has been run (phase 2). */
  history: HistoryResult | null;
  /** True until PPSR history has been incorporated. */
  provisional: boolean;
  /** True when a (paid) PPSR check is worth offering: still provisional,
   *  priced, and a Buy/Check. A price Pass is never PPSR-eligible. */
  ppsrEligible: boolean;
}

export type AssessmentServiceResult =
  | { ok: true; data: AssessmentResponse }
  | {
      ok: false;
      status: number;
      error: string;
      code?: string;
      /** Set on a duplicate-VIN 409 — the user's existing assessment to link to. */
      existingAssessmentId?: string;
    };

/**
 * Per-user duplicate-VIN guard. Returns the user's most recent assessment id for
 * a car with this VIN, or null. RLS scopes this to the signed-in user, so it only
 * ever finds (and links to) their own listing. Case-insensitive match.
 */
async function findExistingAssessmentByVin(
  supabase: SupabaseClient,
  vin: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("assessments")
    .select("id, created_at, cars!inner(vin)")
    .ilike("cars.vin", vin)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

function isPpsrEligible(rec: Recommendation, maxOffer: number | null): boolean {
  return maxOffer !== null && (rec === "buy" || rec === "check");
}

/** PostgREST returns numeric columns as strings; coerce to number | null. */
const numOrNull = (x: number | string | null | undefined): number | null =>
  x == null ? null : Number(x);

// ---------------------------------------------------------------------------
// Phase 1 — price-only assessment (no PPSR)
// ---------------------------------------------------------------------------

export interface RunPriceAssessmentDeps {
  supabase: SupabaseClient;
  input: CarInput;
  /** Injectable for tests; defaults to the deterministic mock. */
  valuationAdapter?: ValuationAdapter;
}

export async function runPriceAssessment({
  supabase,
  input,
  valuationAdapter = mockValuationAdapter,
}: RunPriceAssessmentDeps): Promise<AssessmentServiceResult> {
  const identity: CarIdentity = {
    plate: input.plate ?? null,
    vin: input.vin ?? null,
    year: input.year,
    make: input.make,
    model: input.model,
    trim: input.trim ?? null,
    kilometres: input.kilometres,
  };

  // Duplicate-VIN guard: don't assess the same car twice. Per-user (RLS-scoped).
  if (identity.vin) {
    const existingId = await findExistingAssessmentByVin(supabase, identity.vin);
    if (existingId) {
      return {
        ok: false,
        status: 409,
        code: "duplicate_vin",
        error: "You've already assessed a car with this VIN.",
        existingAssessmentId: existingId,
      };
    }
  }

  // Valuation only — PPSR is deferred to a separate, user-approved step.
  let valuation: ValuationResult;
  try {
    valuation = await valuationAdapter.getValuation(identity);
  } catch (err) {
    if (err instanceof AdapterError) {
      return { ok: false, status: 503, error: err.message, code: err.code };
    }
    throw err;
  }

  // Deterministic engine, price-only (history === null => provisional).
  const pricing = assess({
    sellerAskingPrice: input.sellerAskingPrice,
    repairCost: input.repairCost,
    valuation: { selectedWholesaleValue: valuation.selectedWholesaleValue },
    history: null,
  });
  const reasoning = explain(pricing);

  const { data: car, error: carErr } = await supabase
    .from("cars")
    .insert({
      plate: identity.plate,
      vin: identity.vin,
      year: input.year,
      make: input.make,
      model: input.model,
      trim: identity.trim,
      kilometres: input.kilometres,
      seller_asking_price: input.sellerAskingPrice,
      photos: input.photos ?? [],
    })
    .select("id")
    .single();
  if (carErr || !car) {
    return { ok: false, status: 500, error: "Failed to save car." };
  }

  const { data: val, error: valErr } = await supabase
    .from("valuations")
    .insert({
      car_id: car.id,
      source: valuation.source,
      wholesale_low: valuation.wholesaleLow,
      wholesale_high: valuation.wholesaleHigh,
      retail_low: valuation.retailLow,
      retail_high: valuation.retailHigh,
      selected_wholesale_value: valuation.selectedWholesaleValue,
    })
    .select("id")
    .single();
  if (valErr || !val) {
    return { ok: false, status: 500, error: "Failed to save valuation." };
  }

  const { data: assessment, error: aErr } = await supabase
    .from("assessments")
    .insert({
      car_id: car.id,
      valuation_id: val.id,
      history_check_id: null,
      repair_cost: input.repairCost,
      risk_buffer: pricing.breakdown.riskBuffer,
      max_offer: pricing.maxOffer,
      recommendation: pricing.recommendation,
      reasoning,
      reason_codes: pricing.reasonCodes,
      breakdown: pricing.breakdown,
      history_status: "not_checked",
    })
    .select("id")
    .single();
  if (aErr || !assessment) {
    return { ok: false, status: 500, error: "Failed to save assessment." };
  }

  return {
    ok: true,
    data: {
      assessmentId: assessment.id,
      carId: car.id,
      recommendation: pricing.recommendation,
      maxOffer: pricing.maxOffer,
      riskBuffer: pricing.breakdown.riskBuffer,
      reasonCodes: pricing.reasonCodes,
      reasoning,
      breakdown: pricing.breakdown,
      valuation,
      history: null,
      provisional: true,
      ppsrEligible: isPpsrEligible(pricing.recommendation, pricing.maxOffer),
    },
  };
}

// ---------------------------------------------------------------------------
// Phase 2 — PPSR history check + finalize
// ---------------------------------------------------------------------------

interface StoredAssessment {
  id: string;
  car_id: string;
  history_status: "not_checked" | "checked";
  breakdown: PricingBreakdown | null;
  cars: {
    plate: string | null;
    vin: string | null;
    year: number;
    make: string;
    model: string;
    trim: string | null;
    kilometres: number;
  } | null;
  valuations: {
    source: string;
    wholesale_low: number | string | null;
    wholesale_high: number | string | null;
    retail_low: number | string | null;
    retail_high: number | string | null;
    selected_wholesale_value: number | string | null;
  } | null;
}

export interface RunHistoryCheckDeps {
  supabase: SupabaseClient;
  assessmentId: string;
  /** Injectable for tests; defaults to the deterministic mock. */
  historyAdapter?: HistoryAdapter;
}

export async function runHistoryCheck({
  supabase,
  assessmentId,
  historyAdapter = mockHistoryAdapter,
}: RunHistoryCheckDeps): Promise<AssessmentServiceResult> {
  const { data, error } = await supabase
    .from("assessments")
    .select(
      "id, car_id, history_status, breakdown, cars(plate, vin, year, make, model, trim, kilometres), valuations(source, wholesale_low, wholesale_high, retail_low, retail_high, selected_wholesale_value)",
    )
    .eq("id", assessmentId)
    .maybeSingle();

  const row = data as StoredAssessment | null;
  if (error || !row || !row.breakdown || !row.cars) {
    return { ok: false, status: 404, error: "Assessment not found." };
  }
  if (row.history_status === "checked") {
    return {
      ok: false,
      status: 409,
      error: "A PPSR check has already been run for this assessment.",
    };
  }

  const identity: CarIdentity = {
    plate: row.cars.plate,
    vin: row.cars.vin,
    year: row.cars.year,
    make: row.cars.make,
    model: row.cars.model,
    trim: row.cars.trim,
    kilometres: row.cars.kilometres,
  };

  // The paid PPSR lookup.
  let history: HistoryResult;
  try {
    history = await historyAdapter.getHistory(identity);
  } catch (err) {
    if (err instanceof AdapterError) {
      return { ok: false, status: 503, error: err.message, code: err.code };
    }
    throw err;
  }

  // Re-run the engine with the now-known history, reusing the stored numbers.
  const b = row.breakdown;
  const pricing = assess({
    sellerAskingPrice: b.sellerAskingPrice,
    repairCost: b.repairCost,
    valuation: { selectedWholesaleValue: b.selectedWholesaleValue },
    history: {
      financeOwing: history.financeOwing,
      stolen: history.stolen,
      writtenOff: history.writtenOff,
    },
    riskBufferRate: b.riskBufferRate,
    closeBandRate: b.closeBandRate,
  });
  const reasoning = explain(pricing);

  const { data: hist, error: histErr } = await supabase
    .from("history_checks")
    .insert({
      car_id: row.car_id,
      source: history.source,
      finance_owing: history.financeOwing,
      stolen: history.stolen,
      written_off: history.writtenOff,
      notes: history.notes,
    })
    .select("id")
    .single();
  if (histErr || !hist) {
    return { ok: false, status: 500, error: "Failed to save history check." };
  }

  const { error: updErr } = await supabase
    .from("assessments")
    .update({
      history_check_id: hist.id,
      history_status: "checked",
      recommendation: pricing.recommendation,
      max_offer: pricing.maxOffer,
      risk_buffer: pricing.breakdown.riskBuffer,
      reasoning,
      reason_codes: pricing.reasonCodes,
      breakdown: pricing.breakdown,
    })
    .eq("id", assessmentId);
  if (updErr) {
    return { ok: false, status: 500, error: "Failed to finalize the assessment." };
  }

  return {
    ok: true,
    data: {
      assessmentId: row.id,
      carId: row.car_id,
      recommendation: pricing.recommendation,
      maxOffer: pricing.maxOffer,
      riskBuffer: pricing.breakdown.riskBuffer,
      reasonCodes: pricing.reasonCodes,
      reasoning,
      breakdown: pricing.breakdown,
      valuation: {
        source: row.valuations?.source ?? "unknown",
        wholesaleLow: numOrNull(row.valuations?.wholesale_low),
        wholesaleHigh: numOrNull(row.valuations?.wholesale_high),
        retailLow: numOrNull(row.valuations?.retail_low),
        retailHigh: numOrNull(row.valuations?.retail_high),
        selectedWholesaleValue:
          numOrNull(row.valuations?.selected_wholesale_value) ??
          b.selectedWholesaleValue,
      },
      history,
      provisional: false,
      ppsrEligible: false,
    },
  };
}
