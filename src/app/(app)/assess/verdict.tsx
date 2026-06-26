import { formatAud } from "@/lib/pricing/explain";
import type { AssessmentResponse } from "@/lib/assess/service";
import {
  VERDICT_LABEL,
  VERDICT_BLURB,
  VERDICT_BAND,
  VERDICT_TEXT,
} from "@/lib/verdict-style";

/**
 * The offer card — the product's hero. Renders the deterministic engine's
 * verdict as a stamped appraisal docket: a colored recommendation band, the
 * max-offer figure in tabular monospace, and the calculation as a subtraction
 * ledger so the number is checkable at a glance.
 */

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

function SourceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}

function HistoryCheck({
  label,
  flagged,
  tone = "rose",
}: {
  label: string;
  flagged: boolean;
  tone?: "rose" | "amber";
}) {
  const flaggedCls =
    tone === "amber"
      ? "text-amber-700 dark:text-amber-500"
      : "text-rose-700 dark:text-rose-400";
  return (
    <div className="flex items-center justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {flagged ? (
        <span className={flaggedCls}>⚠ Flagged</span>
      ) : (
        <span className="text-emerald-700 dark:text-emerald-500">✓ Clear</span>
      )}
    </div>
  );
}

export function Verdict({ result }: { result: AssessmentResponse }) {
  const rec = result.recommendation;
  const { breakdown, valuation, history } = result;
  const hasValuation = breakdown.maxOffer !== null;

  const flags: { tone: "rose" | "amber"; text: string }[] = [];
  if (history) {
    if (history.stolen) flags.push({ tone: "rose", text: "Reported stolen" });
    if (history.writtenOff) flags.push({ tone: "rose", text: "Written off" });
    if (history.financeOwing)
      flags.push({ tone: "amber", text: "Finance owing" });
  }

  return (
    <div className="@container flex flex-col gap-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      {result.provisional && (
        <div className="rounded-lg border border-amber-600/30 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-500">
          Provisional — based on price only. Run a PPSR history check to confirm
          the car isn&apos;t stolen, written off, or under finance.
        </div>
      )}

      {/* Verdict band — the one bold element. */}
      <div
        className={`flex items-start justify-between gap-4 rounded-xl border p-5 ${VERDICT_BAND[rec]}`}
      >
        <div>
          <p className="text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
            Recommendation
          </p>
          <p className={`mt-0.5 text-3xl font-bold tracking-tight ${VERDICT_TEXT[rec]}`}>
            {VERDICT_LABEL[rec]}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {VERDICT_BLURB[rec]}
          </p>
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

      {/* Source data — the mock RedBook / PPSR inputs behind the verdict,
          so the result can be cross-referenced. */}
      <div className="grid gap-3 @lg:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <p className="mb-2 text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
            Valuation · {valuation.source}
          </p>
          {valuation.selectedWholesaleValue !== null ? (
            <>
              {valuation.wholesaleLow !== null &&
                valuation.wholesaleHigh !== null && (
                  <SourceRow
                    label="Wholesale"
                    value={`${formatAud(valuation.wholesaleLow)} – ${formatAud(valuation.wholesaleHigh)}`}
                  />
                )}
              {valuation.retailLow !== null &&
                valuation.retailHigh !== null && (
                  <SourceRow
                    label="Retail"
                    value={`${formatAud(valuation.retailLow)} – ${formatAud(valuation.retailHigh)}`}
                  />
                )}
              <SourceRow
                label="Selected"
                value={formatAud(valuation.selectedWholesaleValue)}
              />
            </>
          ) : (
            <p className="py-1 text-sm text-muted-foreground">
              No valuation available.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border p-4">
          <p className="mb-1 text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
            History · {history ? history.source : "PPSR"}
          </p>
          {history ? (
            <>
              <HistoryCheck label="Stolen" flagged={history.stolen} />
              <HistoryCheck label="Written off" flagged={history.writtenOff} />
              <HistoryCheck
                label="Finance owing"
                flagged={history.financeOwing}
                tone="amber"
              />
              {history.notes && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {history.notes}
                </p>
              )}
            </>
          ) : (
            <p className="py-1 text-sm text-muted-foreground">
              Not checked yet — run the PPSR check.
            </p>
          )}
        </div>
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
        <p>Saved for review.</p>
      </div>
    </div>
  );
}
