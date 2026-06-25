import { formatAud } from "@/lib/pricing/explain";
import type { Recommendation } from "@/lib/pricing/reason-codes";
import type { AssessmentResponse } from "@/lib/assess/service";

/**
 * The offer card — the product's hero. Renders the deterministic engine's
 * verdict as a stamped appraisal docket: a colored recommendation band, the
 * max-offer figure in tabular monospace, and the calculation as a subtraction
 * ledger so the number is checkable at a glance.
 */

const VERDICT: Record<
  Recommendation,
  { label: string; blurb: string; band: string; text: string }
> = {
  buy: {
    label: "Buy",
    blurb: "Within budget — clear to proceed.",
    band: "border-emerald-600/30 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  check: {
    label: "Check",
    blurb: "Needs a human look before buying.",
    band: "border-amber-600/30 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-500",
  },
  pass: {
    label: "Pass",
    blurb: "Walk away from this one.",
    band: "border-rose-600/30 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-950/30",
    text: "text-rose-700 dark:text-rose-400",
  },
};

function LedgerRow({
  label,
  value,
  sign,
  strong,
}: {
  label: string;
  value: string;
  sign?: "minus";
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-1.5 ${
        strong ? "font-semibold text-foreground" : "text-muted-foreground"
      }`}
    >
      <span className="text-sm">{label}</span>
      <span className="font-mono text-sm tabular-nums">
        {sign === "minus" && <span className="mr-1 opacity-60">−</span>}
        {value}
      </span>
    </div>
  );
}

function Flag({ tone, children }: { tone: "rose" | "amber"; children: string }) {
  const cls =
    tone === "rose"
      ? "border-rose-600/30 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-950/30 dark:text-rose-400"
      : "border-amber-600/30 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-500";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

export function Verdict({ result }: { result: AssessmentResponse }) {
  const v = VERDICT[result.recommendation];
  const { breakdown, valuation, history } = result;
  const hasValuation = breakdown.maxOffer !== null;

  const flags: { tone: "rose" | "amber"; text: string }[] = [];
  if (history.stolen) flags.push({ tone: "rose", text: "Reported stolen" });
  if (history.writtenOff) flags.push({ tone: "rose", text: "Written off" });
  if (history.financeOwing) flags.push({ tone: "amber", text: "Finance owing" });

  return (
    <div className="flex flex-col gap-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      {/* Verdict band — the one bold element. */}
      <div className={`flex items-start justify-between gap-4 rounded-xl border p-5 ${v.band}`}>
        <div>
          <p className="text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
            Recommendation
          </p>
          <p className={`mt-0.5 text-3xl font-bold tracking-tight ${v.text}`}>
            {v.label}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{v.blurb}</p>
        </div>
        <div className="text-right">
          <p className="text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
            Max offer
          </p>
          <p className="mt-0.5 font-mono text-3xl font-semibold tabular-nums">
            {hasValuation ? formatAud(breakdown.maxOffer) : "—"}
          </p>
        </div>
      </div>

      {flags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {flags.map((f) => (
            <Flag key={f.text} tone={f.tone}>
              {f.text}
            </Flag>
          ))}
        </div>
      )}

      {/* Calculation ledger. */}
      <div className="rounded-xl border border-border p-4">
        <p className="mb-1 text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
          How we got there
        </p>
        {hasValuation ? (
          <>
            <LedgerRow
              label="Wholesale value"
              value={formatAud(breakdown.selectedWholesaleValue)}
            />
            <LedgerRow
              label="Repairs"
              value={formatAud(breakdown.repairCost)}
              sign="minus"
            />
            <LedgerRow
              label={`Risk buffer (${Math.round(breakdown.riskBufferRate * 100)}%)`}
              value={formatAud(breakdown.riskBuffer)}
              sign="minus"
            />
            <div className="my-1 border-t border-border" />
            <LedgerRow
              label="Max offer"
              value={formatAud(breakdown.maxOffer)}
              strong
            />
            <LedgerRow
              label="Seller asking"
              value={formatAud(breakdown.sellerAskingPrice)}
            />
          </>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">
            No valuation available, so a max offer can&apos;t be calculated. Get
            a valuation before deciding.
          </p>
        )}
      </div>

      {/* Plain-English reasoning, straight from the engine. */}
      <p className="text-sm leading-relaxed text-foreground/80">
        {result.reasoning}
      </p>

      {/* Provenance — sources + reason codes + saved state. */}
      <div className="flex flex-col gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-1.5">
          {result.reasonCodes.map((code) => (
            <span
              key={code}
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.7rem]"
            >
              {code}
            </span>
          ))}
        </div>
        <p>
          Valuation: {valuation.source} · History: {history.source} · Saved for
          review.
        </p>
      </div>
    </div>
  );
}
