import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatAud } from "@/lib/pricing/explain";
import type { Recommendation } from "@/lib/pricing/reason-codes";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Assessments · Car Pre-Vetting Tool",
};

interface ListRow {
  id: string;
  created_at: string;
  recommendation: Recommendation;
  max_offer: number | string | null;
  review_status: "pending" | "reviewed";
  cars: { year: number; make: string; model: string } | null;
}

const PILL: Record<Recommendation, string> = {
  buy: "border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-400",
  check:
    "border-amber-600/30 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-500",
  pass: "border-rose-600/30 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-950/30 dark:text-rose-400",
};

const LABEL: Record<Recommendation, string> = {
  buy: "Buy",
  check: "Check",
  pass: "Pass",
};

const dateFmt = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AssessmentsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessments")
    .select(
      "id, created_at, recommendation, max_offer, review_status, cars(year, make, model)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as ListRow[];

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Assessments</h1>
          <p className="text-muted-foreground">
            Every pre-vetted car, most recent first.
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
      ) : rows.length === 0 ? (
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
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/assessments/${r.id}`}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <span
                  className={`inline-flex w-16 shrink-0 justify-center rounded-md border px-2 py-1 text-xs font-semibold ${PILL[r.recommendation]}`}
                >
                  {LABEL[r.recommendation]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {r.cars
                      ? `${r.cars.year} ${r.cars.make} ${r.cars.model}`
                      : "Unknown car"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {dateFmt.format(new Date(r.created_at))}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm font-medium tabular-nums">
                    {r.max_offer == null ? "—" : formatAud(Number(r.max_offer))}
                  </span>
                  <span
                    className={`block text-xs ${
                      r.review_status === "reviewed"
                        ? "text-emerald-600 dark:text-emerald-500"
                        : "text-muted-foreground"
                    }`}
                  >
                    {r.review_status === "reviewed" ? "Reviewed" : "Pending"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
