import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssessmentListItem } from "./_shared";

export const RESULT_CAP = 500;

const LIST_SELECT =
  "id, created_at, recommendation, max_offer, history_status, review_status, purchase_price, cars(year, make, model, plate, seller_asking_price, photos)";

export type AssessmentParams = Record<string, string | undefined>;

/**
 * Fetch assessments for the dashboard/export, applying the same filter + sort +
 * (in-memory) search rules. Shared by the /assessments page and the CSV export
 * so the export reflects whatever the dashboard is showing.
 */
export async function fetchFilteredAssessments(
  supabase: SupabaseClient,
  sp: AssessmentParams,
): Promise<{ rows: AssessmentListItem[]; error: boolean }> {
  const verdict = ["buy", "check", "pass"].includes(sp.verdict ?? "")
    ? sp.verdict
    : undefined;
  const status = ["needs_ppsr", "needs_review", "purchased"].includes(
    sp.status ?? "",
  )
    ? sp.status
    : undefined;
  const sort = ["created_at", "max_offer", "recommendation"].includes(
    sp.sort ?? "",
  )
    ? (sp.sort as string)
    : "created_at";
  const dir =
    sp.dir === "asc"
      ? "asc"
      : sp.dir === "desc"
        ? "desc"
        : sort === "created_at"
          ? "desc"
          : "asc";
  const q = (sp.q ?? "").trim().toLowerCase();

  let query = supabase
    .from("assessments")
    .select(LIST_SELECT)
    .order(sort, { ascending: dir === "asc" })
    .limit(RESULT_CAP);
  if (verdict) query = query.eq("recommendation", verdict);
  if (status === "needs_ppsr") {
    query = query
      .eq("history_status", "not_checked")
      .not("max_offer", "is", null)
      .in("recommendation", ["buy", "check"]);
  }
  if (status === "needs_review") query = query.eq("review_status", "pending");
  if (status === "purchased") query = query.not("purchase_price", "is", null);

  const { data, error } = await query;
  let rows = (data ?? []) as unknown as AssessmentListItem[];
  if (q) {
    rows = rows.filter((r) => {
      const c = r.cars;
      return (
        !!c &&
        [c.make, c.model, c.plate ?? ""].some((s) =>
          s.toLowerCase().includes(q),
        )
      );
    });
  }
  return { rows, error: Boolean(error) };
}
