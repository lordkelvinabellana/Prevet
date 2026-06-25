"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Verdict } from "./verdict";
import { PpsrButton } from "./ppsr-button";
import { Guide } from "./guide";
import { EMPTY_FORM, PRESETS, DOT, type FormValues } from "./presets";
import type { AssessmentResponse } from "@/lib/assess/service";

type FieldErrors = Record<string, string>;

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
const text = (s: string) => (s.trim() === "" ? undefined : s.trim());

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
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssessmentResponse | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const set =
    (name: keyof FormValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [name]: e.target.value }));

  async function runAssess(v: FormValues) {
    setLoading(true);
    setFieldErrors({});
    setFormError(null);

    const payload = {
      plate: text(v.plate),
      vin: text(v.vin),
      year: num(v.year),
      make: text(v.make),
      model: text(v.model),
      trim: text(v.trim),
      kilometres: num(v.kilometres),
      sellerAskingPrice: num(v.sellerAskingPrice),
      repairCost: num(v.repairCost),
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

  function applyPreset(v: FormValues) {
    setValues(v);
    setResult(null);
    void runAssess(v);
  }

  function clearForm() {
    setValues(EMPTY_FORM);
    setResult(null);
    setFieldErrors({});
    setFormError(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar: quick-fill scenarios + guide. */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
            Quick fill a scenario
          </span>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.values)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
              >
                <span className={`size-1.5 rounded-full ${DOT[p.outcome]}`} />
                {p.tag}
              </button>
            ))}
          </div>
        </div>
        <Guide />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runAssess(values);
          }}
          noValidate
          className="flex flex-col gap-8"
        >
          <section>
            <Eyebrow>Identity</Eyebrow>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Plate" name="plate" error={fieldErrors.plate}>
                <Input
                  id="plate"
                  name="plate"
                  value={values.plate}
                  onChange={set("plate")}
                  placeholder="1ABC123"
                  autoCapitalize="characters"
                  aria-invalid={Boolean(fieldErrors.plate)}
                />
              </Field>
              <Field label="VIN" name="vin" error={fieldErrors.vin}>
                <Input
                  id="vin"
                  name="vin"
                  value={values.vin}
                  onChange={set("vin")}
                  placeholder="WVWZZZ…"
                  autoCapitalize="characters"
                  aria-invalid={Boolean(fieldErrors.vin)}
                />
              </Field>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Provide at least one. See{" "}
              <span className="text-foreground">How to fill this in</span> for
              scenario tokens.
            </p>
          </section>

          <section>
            <Eyebrow>Vehicle</Eyebrow>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Make" name="make" error={fieldErrors.make}>
                <Input
                  id="make"
                  name="make"
                  value={values.make}
                  onChange={set("make")}
                  placeholder="Toyota"
                  aria-invalid={Boolean(fieldErrors.make)}
                />
              </Field>
              <Field label="Model" name="model" error={fieldErrors.model}>
                <Input
                  id="model"
                  name="model"
                  value={values.model}
                  onChange={set("model")}
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
                  value={values.year}
                  onChange={set("year")}
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
                  value={values.kilometres}
                  onChange={set("kilometres")}
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
                <Input
                  id="trim"
                  name="trim"
                  value={values.trim}
                  onChange={set("trim")}
                  placeholder="Ascent Sport"
                />
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
                  value={values.sellerAskingPrice}
                  onChange={set("sellerAskingPrice")}
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
                  value={values.repairCost}
                  onChange={set("repairCost")}
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

          <div className="flex gap-3">
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? "Assessing…" : "Get verdict"}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="ghost"
              onClick={clearForm}
              disabled={loading}
            >
              Clear
            </Button>
          </div>
        </form>

        {/* Result */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          {result ? (
            <div className="flex flex-col gap-4">
              <Verdict result={result} />
              {result.ppsrEligible && (
                <PpsrButton
                  assessmentId={result.assessmentId}
                  onResult={setResult}
                />
              )}
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-8 text-center">
              <p className="font-medium">
                {loading ? "Assessing…" : "No verdict yet"}
              </p>
              <p className="max-w-xs text-sm text-muted-foreground">
                {loading
                  ? "Running valuation, history check, and the pricing engine."
                  : "Fill in the car or pick a scenario to get a deterministic Buy / Pass / Check."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
