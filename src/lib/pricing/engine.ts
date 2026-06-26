import {
  REASON_CODE,
  type ReasonCode,
  type Recommendation,
} from "./reason-codes";

/**
 * Deterministic pricing engine for the Car Pre-Vetting Tool.
 *
 * This is the heart of the product. It answers ONE question:
 *   "What is the most the buyer should pay for this car?"
 *
 * It is a PURE function — no I/O, no database, no AI. Given the same inputs it
 * always returns the same output, and every result carries reason codes so the
 * recommendation is fully explainable and checkable.
 *
 * AI MUST NOT be used to compute price or decide the recommendation.
 */

/** 5% of selected wholesale value, held back as a risk buffer. */
export const RISK_BUFFER_RATE = 0.05;

/**
 * A max offer within this fraction *below* the asking price is "close" enough
 * to flag for human Check rather than an outright Pass.
 * e.g. 0.05 => within 5% below asking => Check; more than 5% below => Pass.
 */
export const CLOSE_BAND_RATE = 0.05;

export interface ValuationFacts {
  /** Selected wholesale value (AUD). `null` means valuation is unavailable. */
  selectedWholesaleValue: number | null;
}

export interface HistoryFacts {
  financeOwing: boolean;
  stolen: boolean;
  writtenOff: boolean;
}

export interface PricingInput {
  sellerAskingPrice: number;
  repairCost: number;
  valuation: ValuationFacts;
  /** Known history facts, or `null` when the PPSR check hasn't been run yet
   *  (the price-only / provisional phase). */
  history: HistoryFacts | null;
  /** Optional overrides — default to the module constants. */
  riskBufferRate?: number;
  closeBandRate?: number;
}

export interface PricingBreakdown {
  selectedWholesaleValue: number | null;
  repairCost: number;
  riskBuffer: number | null;
  maxOffer: number | null;
  sellerAskingPrice: number;
  riskBufferRate: number;
  closeBandRate: number;
}

export interface PricingResult {
  maxOffer: number | null;
  recommendation: Recommendation;
  /** Deciding code first; any additional contributing codes follow. */
  reasonCodes: ReasonCode[];
  breakdown: PricingBreakdown;
  /** True when produced without a history check (price-only). Becomes false
   *  once PPSR history is incorporated in the final assessment. */
  provisional: boolean;
}

/** Round to whole AUD dollars. */
function roundAud(value: number): number {
  return Math.round(value);
}

/**
 * Max Offer = Selected Wholesale Value − Repair Cost − Risk Buffer
 * Returns `null` when no valuation is available.
 */
export function calculateMaxOffer(
  selectedWholesaleValue: number | null,
  repairCost: number,
  riskBufferRate: number = RISK_BUFFER_RATE,
): { maxOffer: number | null; riskBuffer: number | null } {
  if (selectedWholesaleValue === null) {
    return { maxOffer: null, riskBuffer: null };
  }
  const riskBuffer = roundAud(selectedWholesaleValue * riskBufferRate);
  const maxOffer = roundAud(selectedWholesaleValue - repairCost - riskBuffer);
  return { maxOffer, riskBuffer };
}

/**
 * Run the full deterministic assessment.
 *
 * Decision order (first match wins — Pass-causing conditions are listed first,
 * so this ordering also encodes precedence):
 *   1. stolen          -> Pass
 *   2. written off     -> Pass
 *   3. finance owing   -> Check
 *   4. no valuation    -> Check
 *   5. max offer <= 0  -> Pass (repairs + buffer exceed the car's value)
 *   6. offer >= ask    -> Buy
 *   7. offer within close band below ask -> Check
 *   8. offer clearly below ask -> Pass
 */
export function assess(input: PricingInput): PricingResult {
  const riskBufferRate = input.riskBufferRate ?? RISK_BUFFER_RATE;
  const closeBandRate = input.closeBandRate ?? CLOSE_BAND_RATE;
  const { selectedWholesaleValue } = input.valuation;

  const { maxOffer, riskBuffer } = calculateMaxOffer(
    selectedWholesaleValue,
    input.repairCost,
    riskBufferRate,
  );

  const breakdown: PricingBreakdown = {
    selectedWholesaleValue,
    repairCost: input.repairCost,
    riskBuffer,
    maxOffer,
    sellerAskingPrice: input.sellerAskingPrice,
    riskBufferRate,
    closeBandRate,
  };

  // Provisional when we haven't run a history (PPSR) check yet.
  const provisional = input.history === null;

  const result = (
    recommendation: Recommendation,
    ...reasonCodes: ReasonCode[]
  ): PricingResult => ({
    maxOffer,
    recommendation,
    reasonCodes,
    breakdown,
    provisional,
  });

  // 1–3: hard stops from history — only once history has been checked. In the
  // price-only phase (history === null) we skip these and decide on price alone.
  if (input.history) {
    if (input.history.stolen) {
      return result("pass", REASON_CODE.HISTORY_STOLEN);
    }
    if (input.history.writtenOff) {
      return result("pass", REASON_CODE.HISTORY_WRITTEN_OFF);
    }
    if (input.history.financeOwing) {
      return result("check", REASON_CODE.HISTORY_FINANCE_OWING);
    }
  }

  // 4: cannot price without a valuation.
  if (maxOffer === null) {
    return result("check", REASON_CODE.VALUATION_MISSING);
  }

  // 5: repairs + risk buffer exceed the car's value — no viable offer.
  if (maxOffer <= 0) {
    return result("pass", REASON_CODE.OFFER_NON_VIABLE);
  }

  // 6/7/8: compare max offer against the seller's asking price.
  const asking = input.sellerAskingPrice;
  if (maxOffer >= asking) {
    return result("buy", REASON_CODE.OFFER_AT_OR_ABOVE_ASKING);
  }

  const closeThreshold = asking * (1 - closeBandRate);
  if (maxOffer >= closeThreshold) {
    return result("check", REASON_CODE.OFFER_CLOSE_TO_ASKING);
  }

  return result("pass", REASON_CODE.OFFER_BELOW_ASKING);
}
