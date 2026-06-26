import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { StatCards, type AssessmentStats } from "./stat-cards";
import { AssessmentsToolbar } from "./assessments-toolbar";
import { AssessmentsTable } from "./assessments-table";
import { AssessmentCard } from "./assessment-card";
import { needsPpsr, SORT_COLS, type AssessmentListItem, type SortCol } from "./_shared";
import type { Recommendation } from "@/lib/pricing/reason-codes";

export const metadata: Metadata = {
  title: "Assessments · Car Pre-Vetting Tool",
};

const RESULT_CAP = 500;

type SearchParams = Record<string, string | undefined>;

function parseSort(v: string | undefined): SortCol {
  return SORT_COLS.includes(v as SortCol) ? (v as SortCol) : "created_at";
}

interface StatRow {
  recommendation: Recommendation;
  history_status: "not_checked" | "checked";
  review_status: "pending" | "reviewed";
  max_offer: number | string | null;
  purchase_price: number | string | null;
  cars: { seller_asking_price: number | string | null } | null;
}

function computeStats(rows: StatRow[]): AssessmentStats {
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

export default async function AssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const verdict = (["buy", "check", "pass"].includes(sp.verdict ?? "")
    ? sp.verdict
    : undefined) as Recommendation | undefined;
  const status = (["needs_ppsr", "needs_review", "purchased"].includes(
    sp.status ?? "",
  )
    ? sp.status
    : undefined) as "needs_ppsr" | "needs_review" | "purchased" | undefined;
  const sort = parseSort(sp.sort);
  const dir =
    sp.dir === "asc" ? "asc" : sp.dir === "desc" ? "desc" : sort === "created_at" ? "desc" : "asc";
  const q = (sp.q ?? "").trim();

  const supabase = await createClient();

  // Stats are global (all verdicts), independent of the active filter.
  const { data: statData } = await supabase
    .from("assessments")
    .select(
      "recommendation, history_status, review_status, max_offer, purchase_price, cars(seller_asking_price)",
    );
  const stats = computeStats((statData ?? []) as unknown as StatRow[]);

  // Main query: DB-side filter + sort + cap. Text search is applied in memory
  // (over the joined car) since it spans an embedded resource and the set is small.
  let query = supabase
    .from("assessments")
    .select(
      "id, created_at, recommendation, max_offer, history_status, review_status, purchase_price, cars(year, make, model, plate, seller_asking_price)",
    )
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
    const needle = q.toLowerCase();
    rows = rows.filter((r) => {
      const c = r.cars;
      return (
        !!c &&
        [c.make, c.model, c.plate ?? ""].some((s) =>
          s.toLowerCase().includes(needle),
        )
      );
    });
  }

  const filtersActive = Boolean(verdict || status || q);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Assessments</h1>
          <p className="text-muted-foreground">
            Every pre-vetted car — sort, filter, and search the queue.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/assess">New assessment</Link>
        </Button>
      </header>

      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn&apos;t load assessments. Try again.
        </p>
      ) : stats.total === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-12 text-center">
          <p className="font-medium">No assessments yet</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Pre-vet a car and it&apos;ll show up here for review.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-1">
            <Link href="/assess">Create the first one</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <StatCards stats={stats} />

          <Suspense fallback={null}>
            <AssessmentsToolbar />
          </Suspense>

          <p className="text-sm text-muted-foreground">
            {rows.length === stats.total
              ? `${stats.total} assessment${stats.total === 1 ? "" : "s"}`
              : `${rows.length} of ${stats.total}`}
            {rows.length === RESULT_CAP ? ` (showing first ${RESULT_CAP})` : ""}
          </p>

          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-12 text-center">
              <p className="font-medium">No matches</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                No assessments match the current filters.
              </p>
              {filtersActive && (
                <Button asChild variant="outline" size="sm" className="mt-1">
                  <Link href="/assessments">Clear filters</Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <AssessmentsTable rows={rows} params={sp} />
              </div>
              <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border md:hidden">
                {rows.map((row) => (
                  <AssessmentCard key={row.id} row={row} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
