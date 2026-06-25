import Link from "next/link";
import { formatAud } from "@/lib/pricing/explain";
import { Badge } from "@/components/ui/badge";
import {
  VERDICT_PILL,
  VERDICT_LABEL,
  TONE_TEXT,
  rowStatus,
  carLabel,
  type AssessmentListItem,
} from "./_shared";

const dateFmt = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" });

/** The mobile (md:hidden) row — a tappable card. */
export function AssessmentCard({ row }: { row: AssessmentListItem }) {
  const status = rowStatus(row);
  return (
    <Link
      href={`/assessments/${row.id}`}
      className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
    >
      <Badge className={`w-16 shrink-0 ${VERDICT_PILL[row.recommendation]}`}>
        {VERDICT_LABEL[row.recommendation]}
      </Badge>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{carLabel(row.cars)}</span>
        <span className="block text-xs text-muted-foreground">
          {dateFmt.format(new Date(row.created_at))}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-mono text-sm font-medium tabular-nums">
          {row.max_offer == null ? "—" : formatAud(Number(row.max_offer))}
        </span>
        <span className={`block text-xs ${TONE_TEXT[status.tone]}`}>
          {status.label}
        </span>
      </span>
    </Link>
  );
}
