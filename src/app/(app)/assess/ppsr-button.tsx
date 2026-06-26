"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { AssessmentResponse } from "@/lib/assess/service";

/**
 * Runs the deferred (paid) PPSR history check for an assessment and finalizes
 * its verdict. Used on /assess (passes `onResult` to update in place) and on the
 * assessment detail page (no `onResult` → refresh the server component).
 */
export function PpsrButton({
  assessmentId,
  onResult,
  size = "lg",
}: {
  assessmentId: string;
  onResult?: (result: AssessmentResponse) => void;
  size?: "sm" | "lg";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/ppsr`, {
        method: "POST",
      });
      const body = await res.json();
      if (res.ok) {
        if (onResult) onResult(body as AssessmentResponse);
        else router.refresh();
      } else if (res.status === 503) {
        const which =
          body.code === "history_unavailable" ? "History" : "Valuation";
        setError(`${which} service is unavailable right now. Try again.`);
      } else {
        setError(body.error ?? "Couldn't run the PPSR check.");
      }
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={run} disabled={loading} size={size}>
        {loading ? "Running PPSR check…" : "Run PPSR check (~$2)"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
