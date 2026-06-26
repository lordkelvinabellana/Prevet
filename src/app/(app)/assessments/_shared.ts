import type { Recommendation } from "@/lib/pricing/reason-codes";

/** A row of the assessments table (joined with its car). */
export interface AssessmentListItem {
  id: string;
  created_at: string;
  recommendation: Recommendation;
  max_offer: number | string | null;
  history_status: "not_checked" | "checked";
  review_status: "pending" | "reviewed";
  cars: {
    year: number;
    make: string;
    model: string;
    plate: string | null;
    seller_asking_price: number | string | null;
  } | null;
}

// Verdict colour tokens live in one place; re-exported here for the dashboard.
export {
  VERDICT_LABEL,
  VERDICT_PILL,
  VERDICT_DOT,
} from "@/lib/verdict-style";

export type Tone = "amber" | "emerald" | "muted";

export const TONE_TEXT: Record<Tone, string> = {
  amber: "text-amber-600 dark:text-amber-500",
  emerald: "text-emerald-600 dark:text-emerald-500",
  muted: "text-muted-foreground",
};

/**
 * A car is worth a (paid) PPSR check when it's priced, still Buy/Check, and the
 * history hasn't been run yet. Mirrors the engine/service `ppsrEligible` rule.
 */
export function needsPpsr(r: {
  history_status: string;
  recommendation: Recommendation;
  max_offer: number | string | null;
}): boolean {
  return (
    r.history_status === "not_checked" &&
    r.max_offer != null &&
    (r.recommendation === "buy" || r.recommendation === "check")
  );
}

/** The review/PPSR status shown in the mobile card (table uses separate cols). */
export function rowStatus(r: AssessmentListItem): { label: string; tone: Tone } {
  if (needsPpsr(r)) return { label: "PPSR pending", tone: "amber" };
  if (r.review_status === "reviewed") return { label: "Reviewed", tone: "emerald" };
  return { label: "Pending review", tone: "muted" };
}

export type SortCol = "created_at" | "max_offer" | "recommendation";
export const SORT_COLS: readonly SortCol[] = [
  "created_at",
  "max_offer",
  "recommendation",
];

/**
 * Href that toggles sorting on `col`, preserving the other params. First click
 * on a column sorts ascending; clicking the active column flips the direction.
 */
export function buildSortHref(
  params: Record<string, string | undefined>,
  col: SortCol,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const nextDir = params.sort === col && params.dir === "asc" ? "desc" : "asc";
  sp.set("sort", col);
  sp.set("dir", nextDir);
  return `?${sp.toString()}`;
}

export function carLabel(cars: AssessmentListItem["cars"]): string {
  return cars ? `${cars.year} ${cars.make} ${cars.model}` : "Unknown car";
}
