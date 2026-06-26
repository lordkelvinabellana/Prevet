import type { Recommendation } from "@/lib/pricing/reason-codes";

/**
 * Single source of truth for how a Buy / Pass / Check verdict looks. Used by the
 * offer card, the dashboard table, the cards, and the stat cards so the status
 * colour language stays consistent everywhere.
 */

export const VERDICT_LABEL: Record<Recommendation, string> = {
  buy: "Buy",
  check: "Check",
  pass: "Pass",
};

export const VERDICT_BLURB: Record<Recommendation, string> = {
  buy: "Within budget — clear to proceed.",
  check: "Needs a human look before buying.",
  pass: "Walk away from this one.",
};

/** Status dot (solid fill) for compact contexts. */
export const VERDICT_DOT: Record<Recommendation, string> = {
  buy: "bg-emerald-500",
  check: "bg-amber-500",
  pass: "bg-rose-500",
};

/** Soft tint + border — the offer card's verdict band. */
export const VERDICT_BAND: Record<Recommendation, string> = {
  buy: "border-emerald-600/30 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-950/30",
  check: "border-amber-600/30 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-950/30",
  pass: "border-rose-600/30 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-950/30",
};

/** Foreground colour that pairs with the band. */
export const VERDICT_TEXT: Record<Recommendation, string> = {
  buy: "text-emerald-700 dark:text-emerald-400",
  check: "text-amber-700 dark:text-amber-500",
  pass: "text-rose-700 dark:text-rose-400",
};

/** Band + text — the compact pill used in the table and cards. */
export const VERDICT_PILL: Record<Recommendation, string> = {
  buy: `${VERDICT_BAND.buy} ${VERDICT_TEXT.buy}`,
  check: `${VERDICT_BAND.check} ${VERDICT_TEXT.check}`,
  pass: `${VERDICT_BAND.pass} ${VERDICT_TEXT.pass}`,
};
