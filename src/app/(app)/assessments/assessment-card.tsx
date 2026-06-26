import Link from "next/link";
import { formatAud } from "@/lib/pricing/explain";
import { Badge } from "@/components/ui/badge";
import { CarThumb } from "./car-thumb";
import { DeleteAssessmentDialog } from "./delete-assessment-dialog";
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
  const purchasePrice =
    row.purchase_price == null ? null : Number(row.purchase_price);
  return (
    <div className="relative flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50">
      {/* Full-card navigation overlay (kept a sibling so the delete button isn't
          nested inside an anchor). */}
      <Link
        href={`/assessments/${row.id}`}
        aria-label={carLabel(row.cars)}
        className="absolute inset-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Badge className={`w-16 shrink-0 ${VERDICT_PILL[row.recommendation]}`}>
        {VERDICT_LABEL[row.recommendation]}
      </Badge>
      <CarThumb url={row.thumbnailUrl} className="size-10" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{carLabel(row.cars)}</span>
        <span className="block text-xs text-muted-foreground">
          {dateFmt.format(new Date(row.created_at))}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-mono text-sm font-semibold tabular-nums text-foreground">
          {row.max_offer == null ? "—" : formatAud(Number(row.max_offer))}
        </span>
        {purchasePrice !== null ? (
          <span className="block text-xs font-medium text-emerald-700 dark:text-emerald-500">
            Bought {formatAud(purchasePrice)}
          </span>
        ) : (
          <span className={`block text-xs ${TONE_TEXT[status.tone]}`}>
            {status.label}
          </span>
        )}
      </span>
      <DeleteAssessmentDialog assessmentId={row.id} iconOnly />
    </div>
  );
}
