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
 * The offer payload returned to the client and used to render the offer card.
 * Everything price/recommendation-related comes straight from the deterministic
 * engine — never from an LLM.
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
  history: HistoryResult;
}

export type AssessmentServiceResult =
  | { ok: true; data: AssessmentResponse }
  | { ok: false; status: number; error: string; code?: string };

export interface RunAssessmentDeps {
  supabase: SupabaseClient;
  input: CarInput;
  /** Injectable for tests; default to the deterministic mocks. */
  valuationAdapter?: ValuationAdapter;
  historyAdapter?: HistoryAdapter;
}

/**
 * Orchestrate a single car assessment:
 *   external lookups -> deterministic engine -> persist -> offer payload.
 *
 * External lookups run BEFORE any database write so a simulated adapter outage
 * never leaves an orphaned car row. A succeeded-but-empty valuation (selected
 * value null) is a valid result and flows through to the engine as a Check;
 * only a thrown AdapterError is treated as an outage (503).
 */
export async function runAssessment({
  supabase,
  input,
  valuationAdapter = mockValuationAdapter,
  historyAdapter = mockHistoryAdapter,
}: RunAssessmentDeps): Promise<AssessmentServiceResult> {
  const identity: CarIdentity = {
    plate: input.plate ?? null,
    vin: input.vin ?? null,
    year: input.year,
    make: input.make,
    model: input.model,
    trim: input.trim ?? null,
    kilometres: input.kilometres,
  };

  // 1. External data lookups — before any writes.
  let valuation: ValuationResult;
  let history: HistoryResult;
  try {
    [valuation, history] = await Promise.all([
      valuationAdapter.getValuation(identity),
      historyAdapter.getHistory(identity),
    ]);
  } catch (err) {
    if (err instanceof AdapterError) {
      return { ok: false, status: 503, error: err.message, code: err.code };
    }
    throw err;
  }

  // 2. Deterministic engine — the ONLY thing that decides price/recommendation.
  const pricing = assess({
    sellerAskingPrice: input.sellerAskingPrice,
    repairCost: input.repairCost,
    valuation: { selectedWholesaleValue: valuation.selectedWholesaleValue },
    history: {
      financeOwing: history.financeOwing,
      stolen: history.stolen,
      writtenOff: history.writtenOff,
    },
  });
  const reasoning = explain(pricing);

  // 3. Persist car -> valuation -> history -> assessment.
  //    created_by is left to the DB default (auth.uid()), which the RLS insert
  //    policies also check against, so it matches the signed-in user.
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

  const { data: hist, error: histErr } = await supabase
    .from("history_checks")
    .insert({
      car_id: car.id,
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

  const { data: assessment, error: aErr } = await supabase
    .from("assessments")
    .insert({
      car_id: car.id,
      valuation_id: val.id,
      history_check_id: hist.id,
      repair_cost: input.repairCost,
      risk_buffer: pricing.breakdown.riskBuffer,
      max_offer: pricing.maxOffer,
      recommendation: pricing.recommendation,
      reasoning,
      reason_codes: pricing.reasonCodes,
      breakdown: pricing.breakdown,
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
      history,
    },
  };
}
