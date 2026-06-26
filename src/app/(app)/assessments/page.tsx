import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { StatCards } from "./stat-cards";
import { AssessmentsToolbar } from "./assessments-toolbar";
import { AssessmentsResults } from "./assessments-results";
import { ResultsSkeleton } from "./results-skeleton";
import { getAssessmentStats } from "./_stats";

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
  // Re-suspends the results (showing the skeleton) whenever a query param changes.
  const resultsKey = [sp.verdict, sp.status, sp.q, sp.sort, sp.dir].join("|");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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

      {stats.total === 0 ? (
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

          <Suspense key={resultsKey} fallback={<ResultsSkeleton />}>
            <AssessmentsResults sp={sp} total={stats.total} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
