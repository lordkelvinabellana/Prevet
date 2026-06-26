import { VERDICT_DOT } from "./_shared";
import { formatAud } from "@/lib/pricing/explain";

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

function DealCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
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
    </div>
  );
}

export function StatCards({ stats }: { stats: AssessmentStats }) {
  const counts: { label: string; value: number; dot?: string }[] = [
    { label: "Total", value: stats.total },
    { label: "Buy", value: stats.buy, dot: VERDICT_DOT.buy },
    { label: "Check", value: stats.check, dot: VERDICT_DOT.check },
    { label: "Pass", value: stats.pass, dot: VERDICT_DOT.pass },
    { label: "Awaiting PPSR", value: stats.awaitingPpsr },
    { label: "Awaiting review", value: stats.awaitingReview },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Deals — the money story, emphasized. */}
      <div className="grid grid-cols-3 gap-3">
        <DealCard label="Purchased" value={String(stats.purchased)} />
        <DealCard label="Total spent" value={formatAud(stats.totalSpent)} />
        <DealCard
          label="Saved vs asking"
          value={formatAud(stats.totalSaved)}
          accent
        />
      </div>

      {/* Pipeline counts. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {counts.map((c) => (
          <div key={c.label} className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-1.5">
              {c.dot && <span className={`size-1.5 rounded-full ${c.dot}`} />}
              <span className="text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
                {c.label}
              </span>
            </div>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums">
              {c.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
