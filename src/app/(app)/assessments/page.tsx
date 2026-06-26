import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { StatCards } from "./stat-cards";
import { AssessmentsToolbar } from "./assessments-toolbar";
import { AssessmentsTable } from "./assessments-table";
import { AssessmentCard } from "./assessment-card";
import { getAssessmentStats } from "./_stats";
import { fetchFilteredAssessments, RESULT_CAP } from "./_query";

export const metadata: Metadata = {
  title: "Assessments · Car Pre-Vetting Tool",
};

type SearchParams = Record<string, string | undefined>;

function exportHref(sp: SearchParams): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) p.set(k, v);
  const qs = p.toString();
  return `/api/assessments/export${qs ? `?${qs}` : ""}`;
}

export default async function AssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const stats = await getAssessmentStats(supabase);
  const { rows, error } = await fetchFilteredAssessments(supabase, sp);
  const filtersActive = Boolean(sp.verdict || sp.status || sp.q);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Assessments</h1>
          <p className="text-muted-foreground">
            Every pre-vetted car — sort, filter, and search the queue.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.total > 0 && (
            <Button asChild variant="outline" size="lg">
              <a href={exportHref(sp)}>Export CSV</a>
            </Button>
          )}
          <Button asChild size="lg">
            <Link href="/assess">New assessment</Link>
          </Button>
        </div>
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
