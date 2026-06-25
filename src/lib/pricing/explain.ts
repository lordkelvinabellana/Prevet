import { REASON_CODE, type ReasonCode } from "./reason-codes";
import type { PricingResult } from "./engine";

/** Format a number as whole-dollar AUD, e.g. 15900 -> "$15,900". */
export function formatAud(value: number | null): string {
  if (value === null) return "N/A";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Plain-English explanation for a single reason code.
 *
 * Template-based ONLY. No AI. The text is derived deterministically from the
 * already-calculated values so the reasoning is stable and checkable.
 */
function explainCode(code: ReasonCode, result: PricingResult): string {
  const { breakdown } = result;
  switch (code) {
    case REASON_CODE.HISTORY_STOLEN:
      return "History check reports this vehicle as stolen. Do not buy.";
    case REASON_CODE.HISTORY_WRITTEN_OFF:
      return "History check reports this vehicle as written off. Do not buy.";
    case REASON_CODE.HISTORY_FINANCE_OWING:
      return "Finance is owing on this vehicle. Verify the payout amount and clear the encumbrance before proceeding.";
    case REASON_CODE.VALUATION_MISSING:
      return "No valuation is available for this vehicle, so a max offer cannot be calculated. Obtain a valuation before deciding.";
    case REASON_CODE.OFFER_AT_OR_ABOVE_ASKING:
      return `Max offer of ${formatAud(breakdown.maxOffer)} is at or above the seller's asking price of ${formatAud(breakdown.sellerAskingPrice)}.`;
    case REASON_CODE.OFFER_CLOSE_TO_ASKING:
      return `Max offer of ${formatAud(breakdown.maxOffer)} is close to (within ${Math.round(breakdown.closeBandRate * 100)}% below) the asking price of ${formatAud(breakdown.sellerAskingPrice)}. Negotiation may close the gap.`;
    case REASON_CODE.OFFER_BELOW_ASKING:
      return `Max offer of ${formatAud(breakdown.maxOffer)} is clearly below the asking price of ${formatAud(breakdown.sellerAskingPrice)}.`;
  }
}

/**
 * Build the full template explanation: a short summary line plus the breakdown
 * math, all from already-calculated values.
 */
export function explain(result: PricingResult): string {
  const lines = result.reasonCodes.map((code) => explainCode(code, result));
  const { breakdown } = result;

  if (breakdown.maxOffer !== null) {
    lines.push(
      `Calculation: ${formatAud(breakdown.selectedWholesaleValue)} wholesale ` +
        `− ${formatAud(breakdown.repairCost)} repairs ` +
        `− ${formatAud(breakdown.riskBuffer)} risk buffer ` +
        `= ${formatAud(breakdown.maxOffer)} max offer.`,
    );
  }

  if (result.provisional) {
    lines.push("Provisional — history (PPSR) not yet checked.");
  }

  return lines.join(" ");
}
