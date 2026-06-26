/**
 * Explainable reason codes for the pricing engine.
 *
 * Every recommendation the engine produces is justified by one or more of these
 * codes. They make each decision auditable and let the UI render a stable,
 * template-based explanation WITHOUT any AI involvement.
 */
export const REASON_CODE = {
  HISTORY_STOLEN: "HISTORY_STOLEN",
  HISTORY_WRITTEN_OFF: "HISTORY_WRITTEN_OFF",
  HISTORY_FINANCE_OWING: "HISTORY_FINANCE_OWING",
  VALUATION_MISSING: "VALUATION_MISSING",
  OFFER_NON_VIABLE: "OFFER_NON_VIABLE",
  OFFER_AT_OR_ABOVE_ASKING: "OFFER_AT_OR_ABOVE_ASKING",
  OFFER_CLOSE_TO_ASKING: "OFFER_CLOSE_TO_ASKING",
  OFFER_BELOW_ASKING: "OFFER_BELOW_ASKING",
} as const;

export type ReasonCode = (typeof REASON_CODE)[keyof typeof REASON_CODE];

export type Recommendation = "buy" | "pass" | "check";
