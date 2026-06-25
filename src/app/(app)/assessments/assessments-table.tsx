import Link from "next/link";
import { formatAud } from "@/lib/pricing/explain";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  VERDICT_PILL,
  VERDICT_LABEL,
  needsPpsr,
  buildSortHref,
  carLabel,
  type AssessmentListItem,
  type SortCol,
} from "./_shared";

const dateFmt = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "short",
});

type Params = Record<string, string | undefined>;

function SortHead({
  col,
  label,
  params,
  className,
}: {
  col: SortCol;
  label: string;
  params: Params;
  className?: string;
}) {
  const active = (params.sort ?? "created_at") === col;
  const dir = active
    ? (params.dir ?? (col === "created_at" ? "desc" : "asc"))
    : null;
  return (
    <TableHead className={className}>
      <Link
        href={buildSortHref(params, col)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        {dir && <span aria-hidden>{dir === "asc" ? "↑" : "↓"}</span>}
      </Link>
    </TableHead>
  );
}

/** Desktop table (hidden on mobile — see the page's card fallback). */
export function AssessmentsTable({
  rows,
  params,
}: {
  rows: AssessmentListItem[];
  params: Params;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Verdict</TableHead>
            <TableHead>Car</TableHead>
            <SortHead col="max_offer" label="Max offer" params={params} className="text-right" />
            <TableHead className="text-right">Asking</TableHead>
            <TableHead>PPSR</TableHead>
            <TableHead>Review</TableHead>
            <SortHead col="created_at" label="Date" params={params} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="relative">
              <TableCell>
                <Badge className={VERDICT_PILL[row.recommendation]}>
                  {VERDICT_LABEL[row.recommendation]}
                </Badge>
              </TableCell>
              <TableCell className="max-w-0">
                <Link
                  href={`/assessments/${row.id}`}
                  className="font-medium after:absolute after:inset-0"
                >
                  {carLabel(row.cars)}
                </Link>
                {row.cars?.plate && (
                  <span className="block font-mono text-xs text-muted-foreground">
                    {row.cars.plate}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {row.max_offer == null ? "—" : formatAud(Number(row.max_offer))}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                {row.cars?.seller_asking_price == null
                  ? "—"
                  : formatAud(Number(row.cars.seller_asking_price))}
              </TableCell>
              <TableCell>
                {row.history_status === "checked" ? (
                  <span className="text-xs text-muted-foreground">Checked</span>
                ) : needsPpsr(row) ? (
                  <span className="text-xs text-amber-600 dark:text-amber-500">
                    Pending
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {row.review_status === "reviewed" ? (
                  <span className="text-xs text-emerald-600 dark:text-emerald-500">
                    Reviewed
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Pending</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {dateFmt.format(new Date(row.created_at))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
