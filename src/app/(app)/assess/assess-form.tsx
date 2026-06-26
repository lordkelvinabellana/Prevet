"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Verdict } from "./verdict";
import { PpsrButton } from "./ppsr-button";
import { PhotoUpload } from "./photo-upload";
import { Guide } from "./guide";
import { EMPTY_FORM, PRESETS, DOT, type FormValues } from "./presets";
import { parseCarInput } from "@/lib/validation/schema";
import type { AssessmentResponse } from "@/lib/assess/service";

type FieldErrors = Record<string, string>;

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
const text = (s: string) => (s.trim() === "" ? undefined : s.trim());

const dupDateFmt = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" });

/** A car with this VIN the user has already assessed. */
type Duplicate = { assessmentId: string; createdAt?: string };

const isMobile = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 1023px)").matches;

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Focus on the next tick, after the state-driven re-render has mounted the target.
function focusById(id: string) {
  setTimeout(() => document.getElementById(id)?.focus(), 0);
}

// On stacked (mobile) layouts the columns sit one above the other, so bring the
// target into view; on desktop the sticky result is already visible.
function scrollIntoViewById(id: string) {
  if (!isMobile()) return;
  const behavior: ScrollBehavior = reducedMotion() ? "auto" : "smooth";
  setTimeout(
    () => document.getElementById(id)?.scrollIntoView({ behavior, block: "start" }),
    0,
  );
}

function buildPayload(v: FormValues) {
  return {
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
}

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
  // Set when the form is edited after a verdict — the shown verdict no longer
  // matches the inputs, so it's dimmed and its actions disabled until re-run.
  const [stale, setStale] = useState(false);
  // On phones the form and result are two steps (the columns can't sit side by
  // side). `editing` lets "Edit details" reveal the form again over a result
  // without wiping it. On desktop (lg) both columns always show, so it's moot.
  const [editing, setEditing] = useState(false);

  // Uploaded car-photo storage paths (uploaded client-side by <PhotoUpload>).
  const [photos, setPhotos] = useState<string[]>([]);
  // Bumped on reset to remount <PhotoUpload> and clear its previews.
  const [photoKey, setPhotoKey] = useState(0);
  // The user's existing assessment for the entered VIN, if any (duplicate guard).
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null);
  // Guards the async VIN check against races (a later edit supersedes an earlier check).
  const vinCheckSeq = useRef("");

  // Mobile shows the result step once there's a verdict and we're not editing.
  const showResultStep = result !== null && !editing;

  const set =
    (name: keyof FormValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setValues((v) => ({ ...v, [name]: value }));
      // Editing after a verdict makes that verdict stale.
      if (result && !loading) setStale(true);
      // Changing the VIN invalidates any duplicate notice.
      if (name === "vin") setDuplicate(null);
      // Clear a field's error as soon as the user starts fixing it.
      setFieldErrors((errs) => {
        if (!errs[name]) return errs;
        const next = { ...errs };
        delete next[name];
        return next;
      });
    };

  // On VIN blur: has the user already assessed this VIN? Advisory only — the
  // server re-checks on submit. Race-guarded so a stale response can't reappear.
  async function checkVin(rawVin: string) {
    const vin = rawVin.trim().toUpperCase();
    vinCheckSeq.current = vin;
    if (!vin) {
      setDuplicate(null);
      return;
    }
    try {
      const res = await fetch(`/api/cars/vin-check?vin=${encodeURIComponent(vin)}`);
      if (!res.ok || vinCheckSeq.current !== vin) return;
      const body = await res.json();
      setDuplicate(
        body.exists
          ? { assessmentId: body.assessmentId, createdAt: body.createdAt }
          : null,
      );
    } catch {
      // Advisory check — ignore network errors; the submit guard is authoritative.
    }
  }

  // Validate a single field on blur (server validation stays authoritative).
  function validateField(name: string) {
    if (!(name in values)) return;
    const res = parseCarInput(buildPayload(values));
    setFieldErrors((errs) => {
      const next = { ...errs };
      if (!res.ok && res.errors[name]) next[name] = res.errors[name];
      else delete next[name];
      return next;
    });
  }

  async function runAssess(v: FormValues, photoPaths: string[]) {
    setLoading(true);
    setFieldErrors({});
    setFormError(null);

    const payload = { ...buildPayload(v), photos: photoPaths };

    try {
      const res = await fetch("/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();

      if (res.ok) {
        setResult(body as AssessmentResponse);
        setStale(false);
        setEditing(false); // a fresh verdict ends any edit step
        // Land on the next-car action; bring the result into view on mobile.
        focusById("assess-another");
        scrollIntoViewById("result");
      } else if (res.status === 400 && body.fields) {
        setFieldErrors(body.fields as FieldErrors);
        setFormError("Check the highlighted fields.");
      } else if (res.status === 409 && body.code === "duplicate_vin") {
        setDuplicate({ assessmentId: body.existingAssessmentId });
        scrollIntoViewById("vin-duplicate");
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
    setStale(false);
    setEditing(false);
    setDuplicate(null);
    setPhotos([]);
    setPhotoKey((k) => k + 1);
    void runAssess(v, []);
  }

  function clearForm() {
    setValues(EMPTY_FORM);
    setResult(null);
    setFieldErrors({});
    setFormError(null);
    setStale(false);
    setEditing(false);
    setDuplicate(null);
    setPhotos([]);
    setPhotoKey((k) => k + 1);
  }

  // "Assess another" — wipe the form and jump back to the first field.
  function resetForNext() {
    clearForm();
    focusById("plate");
    scrollIntoViewById("plate");
  }

  // "Edit details" (mobile) — reveal the form over the current result, values
  // intact, so a typo fix doesn't mean re-entering the whole car.
  function editDetails() {
    setEditing(true);
    focusById("plate");
    scrollIntoViewById("plate");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar: quick-fill scenarios + guide. Belongs to intake, so it's
          hidden on the mobile result step (still always shown on desktop). */}
      <div
        className={`${
          showResultStep ? "hidden lg:flex" : "flex"
        } flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between`}
      >
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
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50"
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
            void runAssess(values, photos);
          }}
          onBlur={(e) => {
            const el = e.target as unknown as HTMLInputElement;
            validateField(el.name);
            if (el.name === "vin") void checkVin(el.value);
          }}
          noValidate
          className={`${
            showResultStep ? "hidden lg:flex" : "flex"
          } flex-col gap-8`}
        >
          <section>
            <Eyebrow>Identity</Eyebrow>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

            {duplicate && (
              <div
                id="vin-duplicate"
                role="alert"
                className="mt-3 flex flex-col gap-2 rounded-lg border border-amber-600/40 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-amber-800 dark:text-amber-300">
                  You&apos;ve already assessed this VIN
                  {duplicate.createdAt
                    ? ` on ${dupDateFmt.format(new Date(duplicate.createdAt))}`
                    : ""}
                  .
                </span>
                <Button asChild size="sm" className="shrink-0">
                  <Link href={`/assessments/${duplicate.assessmentId}`}>
                    View that assessment
                  </Link>
                </Button>
              </div>
            )}
          </section>

          <section>
            <Eyebrow>Vehicle</Eyebrow>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  className="font-mono tabular-nums"
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
                  className="font-mono tabular-nums"
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Seller asking"
                name="sellerAskingPrice"
                error={fieldErrors.sellerAskingPrice}
              >
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="sellerAskingPrice"
                    name="sellerAskingPrice"
                    type="number"
                    inputMode="numeric"
                    value={values.sellerAskingPrice}
                    onChange={set("sellerAskingPrice")}
                    placeholder="17,000"
                    aria-invalid={Boolean(fieldErrors.sellerAskingPrice)}
                    className="pl-7 font-mono tabular-nums"
                  />
                </div>
              </Field>
              <Field
                label="Est. repairs"
                name="repairCost"
                error={fieldErrors.repairCost}
              >
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="repairCost"
                    name="repairCost"
                    type="number"
                    inputMode="numeric"
                    value={values.repairCost}
                    onChange={set("repairCost")}
                    placeholder="500"
                    aria-invalid={Boolean(fieldErrors.repairCost)}
                    className="pl-7 font-mono tabular-nums"
                  />
                </div>
              </Field>
            </div>
          </section>

          <section>
            <Eyebrow>Photos</Eyebrow>
            <PhotoUpload key={photoKey} onChange={setPhotos} />
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
        <div
          id="result"
          role="status"
          aria-live="polite"
          className={`${
            showResultStep ? "block" : "hidden lg:block"
          } lg:sticky lg:top-6 lg:self-start`}
        >
          {result ? (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="flex-1 lg:hidden"
                  onClick={editDetails}
                >
                  ← Edit details
                </Button>
                <Button
                  id="assess-another"
                  size="lg"
                  className="flex-1"
                  onClick={resetForNext}
                >
                  Assess another
                </Button>
              </div>
              {stale && (
                <p className="text-xs text-amber-700 dark:text-amber-500">
                  Inputs changed — re-run for an up-to-date verdict.
                </p>
              )}
              <div
                className={`transition-opacity ${
                  stale ? "pointer-events-none opacity-60" : ""
                }`}
              >
                <Verdict result={result} />
              </div>
              {!stale && result.ppsrEligible && (
                <PpsrButton
                  assessmentId={result.assessmentId}
                  onResult={setResult}
                />
              )}
              {!stale && (
                <Button asChild variant="outline" size="lg">
                  <Link href={`/assessments/${result.assessmentId}`}>
                    Open & record purchase
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-8 text-center">
              <p className="font-medium">
                {loading
                  ? "Assessing…"
                  : formError
                    ? "Couldn't get a verdict"
                    : "No verdict yet"}
              </p>
              <p className="max-w-xs text-sm text-muted-foreground">
                {loading
                  ? "Running valuation, history check, and the pricing engine."
                  : formError
                    ? "Check the form and try again."
                    : "Fill in the car or pick a scenario to get a deterministic Buy / Pass / Check."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
