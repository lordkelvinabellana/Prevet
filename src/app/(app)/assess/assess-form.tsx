"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Verdict } from "./verdict";
import type { AssessmentResponse } from "@/lib/assess/service";

type FieldErrors = Record<string, string>;

const asNumber = (v: FormDataEntryValue | null) => {
  const s = (v ?? "").toString().trim();
  return s === "" ? undefined : Number(s);
};
const asText = (v: FormDataEntryValue | null) => {
  const s = (v ?? "").toString().trim();
  return s === "" ? undefined : s;
};

function Field({
  label,
  name,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="mb-3 text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

export function AssessForm() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssessmentResponse | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    setFieldErrors({});
    setFormError(null);

    const payload = {
      plate: asText(fd.get("plate")),
      vin: asText(fd.get("vin")),
      year: asNumber(fd.get("year")),
      make: asText(fd.get("make")),
      model: asText(fd.get("model")),
      trim: asText(fd.get("trim")),
      kilometres: asNumber(fd.get("kilometres")),
      sellerAskingPrice: asNumber(fd.get("sellerAskingPrice")),
      repairCost: asNumber(fd.get("repairCost")),
    };

    try {
      const res = await fetch("/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();

      if (res.ok) {
        setResult(body as AssessmentResponse);
      } else if (res.status === 400 && body.fields) {
        setFieldErrors(body.fields as FieldErrors);
        setFormError("Check the highlighted fields.");
      } else if (res.status === 503) {
        const which =
          body.code === "history_unavailable" ? "History" : "Valuation";
        setFormError(`${which} service is unavailable right now. Try again.`);
      } else {
        setFormError(body.error ?? "Something went wrong. Try again.");
      }
    } catch {
      setFormError("Couldn't reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Input */}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
        <section>
          <Eyebrow>Identity</Eyebrow>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Plate" name="plate" error={fieldErrors.plate}>
              <Input
                id="plate"
                name="plate"
                placeholder="1ABC123"
                autoCapitalize="characters"
                aria-invalid={Boolean(fieldErrors.plate)}
              />
            </Field>
            <Field label="VIN" name="vin" error={fieldErrors.vin}>
              <Input
                id="vin"
                name="vin"
                placeholder="WVWZZZ…"
                autoCapitalize="characters"
                aria-invalid={Boolean(fieldErrors.vin)}
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Provide at least one. Tip: put{" "}
            <code className="font-mono">STOLEN</code>,{" "}
            <code className="font-mono">WOVR</code>,{" "}
            <code className="font-mono">FINANCE</code>,{" "}
            <code className="font-mono">NOVAL</code>,{" "}
            <code className="font-mono">FAILVAL</code> or{" "}
            <code className="font-mono">FAILHIST</code> in the plate to demo a
            scenario.
          </p>
        </section>

        <section>
          <Eyebrow>Vehicle</Eyebrow>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Make" name="make" error={fieldErrors.make}>
              <Input
                id="make"
                name="make"
                placeholder="Toyota"
                aria-invalid={Boolean(fieldErrors.make)}
              />
            </Field>
            <Field label="Model" name="model" error={fieldErrors.model}>
              <Input
                id="model"
                name="model"
                placeholder="Corolla"
                aria-invalid={Boolean(fieldErrors.model)}
              />
            </Field>
            <Field label="Year" name="year" error={fieldErrors.year}>
              <Input
                id="year"
                name="year"
                type="number"
                inputMode="numeric"
                placeholder="2018"
                aria-invalid={Boolean(fieldErrors.year)}
              />
            </Field>
            <Field
              label="Kilometres"
              name="kilometres"
              error={fieldErrors.kilometres}
            >
              <Input
                id="kilometres"
                name="kilometres"
                type="number"
                inputMode="numeric"
                placeholder="90000"
                aria-invalid={Boolean(fieldErrors.kilometres)}
              />
            </Field>
            <Field
              label="Trim"
              name="trim"
              error={fieldErrors.trim}
              className="col-span-2"
              hint="Optional"
            >
              <Input id="trim" name="trim" placeholder="Ascent Sport" />
            </Field>
          </div>
        </section>

        <section>
          <Eyebrow>Pricing</Eyebrow>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Seller asking ($)"
              name="sellerAskingPrice"
              error={fieldErrors.sellerAskingPrice}
            >
              <Input
                id="sellerAskingPrice"
                name="sellerAskingPrice"
                type="number"
                inputMode="numeric"
                placeholder="17000"
                aria-invalid={Boolean(fieldErrors.sellerAskingPrice)}
              />
            </Field>
            <Field
              label="Est. repairs ($)"
              name="repairCost"
              error={fieldErrors.repairCost}
            >
              <Input
                id="repairCost"
                name="repairCost"
                type="number"
                inputMode="numeric"
                placeholder="500"
                aria-invalid={Boolean(fieldErrors.repairCost)}
              />
            </Field>
          </div>
        </section>

        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" disabled={loading}>
          {loading ? "Assessing…" : "Get verdict"}
        </Button>
      </form>

      {/* Result */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        {result ? (
          <Verdict result={result} />
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-8 text-center">
            <p className="font-medium">
              {loading ? "Assessing…" : "No verdict yet"}
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
              {loading
                ? "Running valuation, history check, and the pricing engine."
                : "Fill in the car on the left and get a deterministic Buy / Pass / Check."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
