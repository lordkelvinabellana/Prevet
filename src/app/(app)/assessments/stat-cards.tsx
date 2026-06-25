import { VERDICT_DOT } from "./_shared";

export interface AssessmentStats {
  total: number;
  buy: number;
  check: number;
  pass: number;
  awaitingPpsr: number;
  awaitingReview: number;
}

export function StatCards({ stats }: { stats: AssessmentStats }) {
  const cards: { label: string; value: number; dot?: string }[] = [
    { label: "Total", value: stats.total },
    { label: "Buy", value: stats.buy, dot: VERDICT_DOT.buy },
    { label: "Check", value: stats.check, dot: VERDICT_DOT.check },
    { label: "Pass", value: stats.pass, dot: VERDICT_DOT.pass },
    { label: "Awaiting PPSR", value: stats.awaitingPpsr },
    { label: "Awaiting review", value: stats.awaitingReview },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-border p-3">
          <div className="flex items-center gap-1.5">
            {c.dot && <span className={`size-1.5 rounded-full ${c.dot}`} />}
            <span className="text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
              {c.label}
            </span>
          </div>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}
