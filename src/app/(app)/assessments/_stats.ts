import type { SupabaseClient } from "@supabase/supabase-js";
import type { Recommendation } from "@/lib/pricing/reason-codes";
import { needsPpsr } from "./_shared";

export interface AssessmentStats {
  total: number;
  buy: number;
  check: number;
  pass: number;
  awaitingPpsr: number;
  awaitingReview: number;
  purchased: number;
  totalSpent: number;
  totalSaved: number;
}

interface StatRow {
  recommendation: Recommendation;
  history_status: "not_checked" | "checked";
  review_status: "pending" | "reviewed";
  max_offer: number | string | null;
  purchase_price: number | string | null;
  cars: { seller_asking_price: number | string | null } | null;
}

/** Global assessment stats (all rows, RLS-scoped) — used by the dashboard and
 *  the assessments queue. */
export async function getAssessmentStats(
  supabase: SupabaseClient,
): Promise<AssessmentStats> {
  const { data } = await supabase
    .from("assessments")
    .select(
      "recommendation, history_status, review_status, max_offer, purchase_price, cars(seller_asking_price)",
    );
  const rows = (data ?? []) as unknown as StatRow[];
  const s: AssessmentStats = {
    total: rows.length,
    buy: 0,
    check: 0,
    pass: 0,
    awaitingPpsr: 0,
    awaitingReview: 0,
    purchased: 0,
    totalSpent: 0,
    totalSaved: 0,
  };
  for (const r of rows) {
    if (r.recommendation === "buy") s.buy++;
    else if (r.recommendation === "check") s.check++;
    else if (r.recommendation === "pass") s.pass++;
    if (needsPpsr(r)) s.awaitingPpsr++;
    if (r.review_status === "pending") s.awaitingReview++;
    const price = r.purchase_price == null ? null : Number(r.purchase_price);
    if (price !== null) {
      s.purchased++;
      s.totalSpent += price;
      const asking =
        r.cars?.seller_asking_price == null
          ? null
          : Number(r.cars.seller_asking_price);
      if (asking !== null) s.totalSaved += asking - price;
    }
  }
  return s;
}
