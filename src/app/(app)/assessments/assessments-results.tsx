import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { AssessmentsTable } from "./assessments-table";
import { AssessmentCard } from "./assessment-card";
import { fetchFilteredAssessments, RESULT_CAP } from "./_query";
import { signPhotoUrls } from "./_photos";

type SearchParams = Record<string, string | undefined>;

/**
 * The filtered/sorted/searched results. Lives behind a keyed <Suspense> in the
 * page so each query swaps in a skeleton (even inside the toolbar's transition)
 * rather than silently re-using the stale table. `total` (unfiltered count) comes
 * from the page so the "N of M" line can compare without a second query here.
 */
export async function AssessmentsResults({
  sp,
  total,
}: {
  sp: SearchParams;
  total: number;
}) {
  const supabase = await createClient();
  const { rows, error } = await fetchFilteredAssessments(supabase, sp);
  const filtersActive = Boolean(sp.verdict || sp.status || sp.q);

  // Sign each row's first photo (the thumbnail) in one batch.
  const thumbPaths = rows
    .map((r) => r.cars?.photos?.[0])
    .filter((p): p is string => Boolean(p));
  const signed = await signPhotoUrls(supabase, thumbPaths);
  for (const r of rows) {
    const p = r.cars?.photos?.[0];
    r.thumbnailUrl = p ? (signed[p] ?? null) : null;
  }

  if (error) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Couldn&apos;t load assessments. Try again.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        {rows.length === total
          ? `${total} assessment${total === 1 ? "" : "s"}`
          : `${rows.length} of ${total}`}
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
  );
}
