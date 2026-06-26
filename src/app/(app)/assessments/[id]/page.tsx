import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/dal";
import { Verdict } from "../../assess/verdict";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PpsrButton } from "../../assess/ppsr-button";
import { markReviewed } from "../actions";
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
  created_at: string;
  cars: {
    year: number;
    make: string;
    model: string;
    trim: string | null;
    plate: string | null;
    vin: string | null;
    kilometres: number;
  } | null;
  valuations: { source: string } | null;
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
      "*, cars(year, make, model, trim, plate, vin, kilometres), valuations(source), history_checks(source, finance_owing, stolen, written_off, notes)",
    )
    .eq("id", id)
    .maybeSingle();

  const row = data as DetailRow | null;
  if (!row || !row.breakdown) {
    notFound();
  }

  const car = row.cars;
  const hist = row.history_checks;

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
      wholesaleLow: null,
      wholesaleHigh: null,
      retailLow: null,
      retailHigh: null,
      selectedWholesaleValue: row.breakdown.selectedWholesaleValue,
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

  const review = markReviewed.bind(null, row.id);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <Link
        href="/assessments"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← All assessments
      </Link>

      <header className="mb-6 mt-4 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {car ? `${car.year} ${car.make} ${car.model}` : "Assessment"}
        </h1>
        <p className="font-mono text-sm text-muted-foreground">
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

      <Verdict result={result} />

      {/* Deferred PPSR — only offered while still in play (Buy/Check). */}
      {result.ppsrEligible && (
        <div className="mt-6 rounded-xl border border-border p-4">
          <p className="mb-2 text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
            History check
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              PPSR not yet run (~$2 per search). Run it to confirm the car
              isn&apos;t stolen, written off, or under finance.
            </p>
            <PpsrButton assessmentId={row.id} />
          </div>
        </div>
      )}

      {/* Human review */}
      <div className="mt-6 rounded-xl border border-border p-4">
        <p className="mb-2 text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
          Review
        </p>
        {row.review_status === "reviewed" ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-emerald-700 dark:text-emerald-500">
              ✓ Reviewed
              {row.reviewed_by && user?.id === row.reviewed_by ? " by you" : ""}
              {row.reviewed_at
                ? ` on ${dateFmt.format(new Date(row.reviewed_at))}`
                : ""}
              .
            </p>
            {row.reviewer_note && (
              <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm text-foreground/80">
                {row.reviewer_note}
              </p>
            )}
          </div>
        ) : (
          <form action={review} className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Awaiting human review.
            </p>
            <Textarea
              name="note"
              rows={2}
              placeholder="Add a note for the record (optional)…"
              aria-label="Reviewer note"
            />
            <div>
              <Button type="submit" size="sm">
                Mark reviewed
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
