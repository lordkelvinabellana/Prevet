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
import { CarThumb } from "./car-thumb";
import { DeleteAssessmentDialog } from "./delete-assessment-dialog";
import {
  VERDICT_PILL,
  VERDICT_LABEL,
  needsPpsr,
  buildSortHref,
  carLabel,
  type AssessmentListItem,
  type SortCol,
} from "./_shared";

// Compact AU date + time in Perth (WA) time — "27/06/26, 1:23 pm". Pinning the
// zone also keeps the server-rendered value stable (no hydration mismatch).
const dateFmt = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Australia/Perth",
});

type Params = Record<string, string | undefined>;

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

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
  const active = (params.sort ?? "updated_at") === col;
  const dir = active
    ? (params.dir ?? (col === "updated_at" ? "desc" : "asc"))
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
            <TableHead className="w-full">Car</TableHead>
            <SortHead col="max_offer" label="Max offer" params={params} className="text-right" />
            <TableHead className="text-right">Asking</TableHead>
            <TableHead>PPSR</TableHead>
            <TableHead>Status</TableHead>
            <SortHead col="updated_at" label="Updated" params={params} />
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
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
              <TableCell className="w-full">
                <div className="flex items-center gap-3">
                  <CarThumb url={row.thumbnailUrl} className="size-9" />
                  <div className="min-w-0">
                    <Link
                      href={`/assessments/${row.id}`}
                      className="whitespace-nowrap rounded-sm font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {carLabel(row.cars)}
                    </Link>
                    {row.cars?.plate && (
                      <span className="block whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {row.cars.plate}
                      </span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right font-mono font-semibold tabular-nums text-foreground">
                {row.max_offer == null ? "—" : formatAud(Number(row.max_offer))}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                {row.cars?.seller_asking_price == null
                  ? "—"
                  : formatAud(Number(row.cars.seller_asking_price))}
              </TableCell>
              <TableCell>
                {row.history_status === "checked" ? (
                  <span
                    title="PPSR checked"
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-500"
                  >
                    <CheckIcon />
                    <span className="hidden lg:inline">Checked</span>
                    <span className="sr-only">PPSR checked</span>
                  </span>
                ) : needsPpsr(row) ? (
                  <span
                    title="PPSR pending"
                    className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-500"
                  >
                    <ClockIcon />
                    <span className="hidden lg:inline">Pending</span>
                    <span className="sr-only">PPSR pending</span>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground" title="PPSR not needed">
                    —
                  </span>
                )}
              </TableCell>
              <TableCell>
                {row.purchase_price != null ? (
                  <span
                    title={`Bought for ${formatAud(Number(row.purchase_price))}`}
                    className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-emerald-700 dark:text-emerald-500"
                  >
                    <CheckIcon />
                    {formatAud(Number(row.purchase_price))}
                  </span>
                ) : row.review_status === "reviewed" ? (
                  <span
                    title="Reviewed"
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-500"
                  >
                    <CheckIcon />
                    <span className="hidden lg:inline">Reviewed</span>
                    <span className="sr-only">Reviewed</span>
                  </span>
                ) : (
                  <span
                    title="Pending review"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                  >
                    <ClockIcon />
                    <span className="hidden lg:inline">Pending</span>
                    <span className="sr-only">Pending review</span>
                  </span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {dateFmt.format(new Date(row.updated_at))}
              </TableCell>
              <TableCell className="text-right">
                <DeleteAssessmentDialog assessmentId={row.id} iconOnly />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
