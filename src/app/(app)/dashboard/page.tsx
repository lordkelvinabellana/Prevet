import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { getAssessmentStats } from "../assessments/_stats";
import { formatAud } from "@/lib/pricing/explain";
import { VERDICT_DOT, VERDICT_LABEL } from "@/lib/verdict-style";
import type { Recommendation } from "@/lib/pricing/reason-codes";

export const metadata: Metadata = {
  title: "Dashboard · Car Pre-Vetting Tool",
};

function BigStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
          accent ? "text-emerald-700 dark:text-emerald-500" : ""
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const stats = await getAssessmentStats(supabase);

  const verdicts: { rec: Recommendation; count: number }[] = [
    { rec: "buy", count: stats.buy },
    { rec: "check", count: stats.check },
    { rec: "pass", count: stats.pass },
  ];
  const maxVerdict = Math.max(1, stats.buy, stats.check, stats.pass);
  const purchaseRate = stats.total
    ? Math.round((stats.purchased / stats.total) * 100)
    : 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Deals and pipeline at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="lg">
            <a href="/api/assessments/export">Export CSV</a>
          </Button>
          <Button asChild size="lg">
            <Link href="/assess">New assessment</Link>
          </Button>
        </div>
      </header>

      {stats.total === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-12 text-center">
          <p className="font-medium">No data yet</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Pre-vet and buy some cars — the numbers will show up here.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-1">
            <Link href="/assess">New assessment</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Deals — the money story. */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <BigStat
              label="Purchased"
              value={String(stats.purchased)}
              sub={`${purchaseRate}% of ${stats.total} assessed`}
            />
            <BigStat label="Total spent" value={formatAud(stats.totalSpent)} />
            <BigStat
              label="Saved vs asking"
              value={formatAud(stats.totalSaved)}
              accent
            />
          </section>

          {/* Verdict breakdown with simple bars. */}
          <section className="rounded-xl border border-border p-5">
            <p className="mb-4 text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
              Verdicts
            </p>
            <div className="flex flex-col gap-3">
              {verdicts.map(({ rec, count }) => (
                <div key={rec} className="flex items-center gap-3">
                  <span className="w-12 text-sm">{VERDICT_LABEL[rec]}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${VERDICT_DOT[rec]}`}
                      style={{ width: `${(count / maxVerdict) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-sm tabular-nums">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Pipeline. */}
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <BigStat label="Total assessed" value={String(stats.total)} />
            <BigStat label="Awaiting PPSR" value={String(stats.awaitingPpsr)} />
            <BigStat
              label="Awaiting review"
              value={String(stats.awaitingReview)}
            />
          </section>
        </div>
      )}
    </div>
  );
}
