import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/dal";
import { Verdict } from "../../assess/verdict";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PpsrButton } from "../../assess/ppsr-button";
import { RecordPurchaseDialog } from "../record-purchase-dialog";
import { MarkReviewedDialog } from "../mark-reviewed-dialog";
import { DeleteAssessmentDialog } from "../delete-assessment-dialog";
import { purchaseSavings } from "../_shared";
import { signPhotoUrls } from "../_photos";
import { formatAud } from "@/lib/pricing/explain";
import type { PricingBreakdown } from "@/lib/pricing/engine";
import type { Recommendation, ReasonCode } from "@/lib/pricing/reason-codes";
import type { AssessmentResponse } from "@/lib/assess/service";

export const metadata: Metadata = {
  title: "Assessment · Car Pre-Vetting Tool",
};

interface DetailRow {
  id: string;
  car_id: string;
  recommendation: Recommendation;
  max_offer: number | string | null;
  risk_buffer: number | string | null;
  reasoning: string;
  reason_codes: ReasonCode[];
  breakdown: PricingBreakdown | null;
  history_status: "not_checked" | "checked";
  review_status: "pending" | "reviewed";
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewer_note: string | null;
  purchase_price: number | string | null;
  purchased_at: string | null;
  purchase_note: string | null;
  created_at: string;
  cars: {
    year: number;
    make: string;
    model: string;
    trim: string | null;
    plate: string | null;
    vin: string | null;
    kilometres: number;
    photos: string[] | null;
  } | null;
  valuations: {
    source: string;
    wholesale_low: number | string | null;
    wholesale_high: number | string | null;
    retail_low: number | string | null;
    retail_high: number | string | null;
    selected_wholesale_value: number | string | null;
  } | null;
  history_checks: {
    source: string;
    finance_owing: boolean;
    stolen: boolean;
    written_off: boolean;
    notes: string | null;
  } | null;
}

const dateFmt = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "short",
});

const numOrNull = (x: number | string | null | undefined): number | null =>
  x == null ? null : Number(x);

const OK_BADGE =
  "border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-400";

export default async function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getUser();
  const { data } = await supabase
    .from("assessments")
    .select(
      "*, cars(year, make, model, trim, plate, vin, kilometres, photos), valuations(source, wholesale_low, wholesale_high, retail_low, retail_high, selected_wholesale_value), history_checks(source, finance_owing, stolen, written_off, notes)",
    )
    .eq("id", id)
    .maybeSingle();

  const row = data as DetailRow | null;
  if (!row || !row.breakdown) {
    notFound();
  }

  const car = row.cars;
  const hist = row.history_checks;

  // Signed URLs for the car's photos, in order (first = thumbnail).
  const photoPaths = car?.photos ?? [];
  const signed = await signPhotoUrls(supabase, photoPaths);
  const photoUrls = photoPaths
    .map((p) => signed[p])
    .filter((u): u is string => Boolean(u));

  // Rebuild the offer payload so the detail view renders identically to /assess.
  const result: AssessmentResponse = {
    assessmentId: row.id,
    carId: row.car_id,
    recommendation: row.recommendation,
    maxOffer: row.breakdown.maxOffer,
    riskBuffer: row.breakdown.riskBuffer,
    reasonCodes: row.reason_codes,
    reasoning: row.reasoning,
    breakdown: row.breakdown,
    valuation: {
      source: row.valuations?.source ?? "unknown",
      wholesaleLow: numOrNull(row.valuations?.wholesale_low),
      wholesaleHigh: numOrNull(row.valuations?.wholesale_high),
      retailLow: numOrNull(row.valuations?.retail_low),
      retailHigh: numOrNull(row.valuations?.retail_high),
      selectedWholesaleValue:
        numOrNull(row.valuations?.selected_wholesale_value) ??
        row.breakdown.selectedWholesaleValue,
    },
    history: hist
      ? {
          source: hist.source,
          financeOwing: hist.finance_owing,
          stolen: hist.stolen,
          writtenOff: hist.written_off,
          notes: hist.notes,
        }
      : null,
    provisional: row.history_status === "not_checked",
    ppsrEligible:
      row.history_status === "not_checked" &&
      row.breakdown.maxOffer !== null &&
      (row.recommendation === "buy" || row.recommendation === "check"),
  };

  const asking = row.breakdown.sellerAskingPrice;
  const purchasePrice = numOrNull(row.purchase_price);
  const savings =
    purchasePrice !== null ? purchaseSavings(asking, purchasePrice) : null;
  const reviewed = row.review_status === "reviewed";
  const reviewedByYou = row.reviewed_by != null && user?.id === row.reviewed_by;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <Link
        href="/assessments"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← All assessments
      </Link>

      <header className="mb-4 mt-4 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {car ? `${car.year} ${car.make} ${car.model}` : "Assessment"}
        </h1>
        <p className="font-mono text-sm break-words text-muted-foreground">
          {[
            car?.trim,
            car?.kilometres != null
              ? `${car.kilometres.toLocaleString("en-AU")} km`
              : null,
            car?.plate,
            car?.vin,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      {photoUrls.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photoUrls.map((url, i) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={`block overflow-hidden rounded-lg border border-border bg-muted ${
                i === 0 ? "col-span-2 sm:col-span-3" : ""
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Car photo ${i + 1}`}
                className={`w-full object-cover ${
                  i === 0 ? "max-h-72" : "h-32 sm:h-28"
                }`}
              />
            </a>
          ))}
        </div>
      )}

      {/* Action bar — quick updates, kept on top. */}
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {result.ppsrEligible ? (
            <PpsrButton assessmentId={row.id} size="sm" />
          ) : row.history_status === "checked" ? (
            <Badge className="border-border text-muted-foreground">
              PPSR checked
            </Badge>
          ) : null}

          {reviewed ? (
            <Badge className={OK_BADGE}>
              ✓ Reviewed{reviewedByYou ? " by you" : ""}
            </Badge>
          ) : (
            <MarkReviewedDialog assessmentId={row.id} />
          )}

          {purchasePrice !== null ? (
            <span className="inline-flex items-center gap-2">
              <Badge className={OK_BADGE}>
                Bought {formatAud(purchasePrice)}
              </Badge>
              <RecordPurchaseDialog
                assessmentId={row.id}
                triggerLabel="Edit"
                triggerVariant="ghost"
                defaultPrice={purchasePrice}
                defaultNote={row.purchase_note}
              />
            </span>
          ) : (
            <RecordPurchaseDialog assessmentId={row.id} />
          )}

          <Button asChild variant="outline" size="sm" className="ml-auto">
            <Link href={`/assessments/${row.id}/edit`}>Edit</Link>
          </Button>
          <DeleteAssessmentDialog assessmentId={row.id} redirectAfter />
        </div>

        {purchasePrice !== null && (
          <p className="text-xs text-muted-foreground">
            {row.purchased_at
              ? `Purchased ${dateFmt.format(new Date(row.purchased_at))} — `
              : ""}
            {savings?.label === "saved" ? (
              <span className="text-emerald-700 dark:text-emerald-500">
                saved {formatAud(savings.amount)} vs asking ({formatAud(asking)})
              </span>
            ) : savings?.label === "over" ? (
              <span className="text-rose-700 dark:text-rose-400">
                {formatAud(savings.amount)} over asking ({formatAud(asking)})
              </span>
            ) : (
              <span>paid the asking price ({formatAud(asking)})</span>
            )}
            .
          </p>
        )}
      </div>

      <Verdict result={result} />

      {/* Recorded notes. */}
      {(row.reviewer_note || row.purchase_note) && (
        <div className="mt-6 flex flex-col gap-3">
          {row.reviewer_note && (
            <div className="rounded-xl border border-border p-4">
              <p className="mb-1 text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
                Reviewer note
              </p>
              <p className="whitespace-pre-wrap text-sm text-foreground/80">
                {row.reviewer_note}
              </p>
            </div>
          )}
          {row.purchase_note && (
            <div className="rounded-xl border border-border p-4">
              <p className="mb-1 text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
                Purchase note
              </p>
              <p className="whitespace-pre-wrap text-sm text-foreground/80">
                {row.purchase_note}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
