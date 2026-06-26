"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhotoUpload } from "../../assess/photo-upload";

export type EditValues = {
  plate: string;
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  kilometres: string;
  sellerAskingPrice: string;
  repairCost: string;
};

type FieldErrors = Record<string, string>;

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
const text = (s: string) => (s.trim() === "" ? undefined : s.trim());

function Field({
  label,
  name,
  error,
  className,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * Edit a car's details and re-run the deterministic engine (PATCH). The verdict
 * is recomputed server-side — never hand-edited. On success returns to the detail
 * page, where the (now provisional again) verdict shows.
 */
export function EditCarForm({
  assessmentId,
  initialValues,
  initialPhotos,
}: {
  assessmentId: string;
  initialValues: EditValues;
  initialPhotos: { path: string; url: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<EditValues>(initialValues);
  const [photos, setPhotos] = useState<string[]>(
    initialPhotos.map((p) => p.path),
  );
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const set =
    (name: keyof EditValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setValues((v) => ({ ...v, [name]: value }));
      setFieldErrors((errs) => {
        if (!errs[name]) return errs;
        const next = { ...errs };
        delete next[name];
        return next;
      });
    };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFieldErrors({});
    setFormError(null);
    const payload = {
      plate: text(values.plate),
      vin: text(values.vin),
      year: num(values.year),
      make: text(values.make),
      model: text(values.model),
      trim: text(values.trim),
      kilometres: num(values.kilometres),
      sellerAskingPrice: num(values.sellerAskingPrice),
      repairCost: num(values.repairCost),
      photos,
    };
    try {
      const res = await fetch(`/api/assessments/${assessmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (res.ok) {
        router.push(`/assessments/${assessmentId}`);
        router.refresh();
      } else if (res.status === 400 && body.fields) {
        setFieldErrors(body.fields as FieldErrors);
        setFormError("Check the highlighted fields.");
      } else if (res.status === 409 && body.code === "duplicate_vin") {
        setFormError("Another assessment already uses this VIN.");
      } else if (res.status === 503) {
        setFormError("Valuation service is unavailable right now. Try again.");
      } else {
        setFormError(body.error ?? "Couldn't save. Try again.");
      }
    } catch {
      setFormError("Couldn't reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Plate" name="plate" error={fieldErrors.plate}>
          <Input id="plate" value={values.plate} onChange={set("plate")} autoCapitalize="characters" />
        </Field>
        <Field label="VIN" name="vin" error={fieldErrors.vin}>
          <Input id="vin" value={values.vin} onChange={set("vin")} autoCapitalize="characters" />
        </Field>
        <Field label="Make" name="make" error={fieldErrors.make}>
          <Input id="make" value={values.make} onChange={set("make")} />
        </Field>
        <Field label="Model" name="model" error={fieldErrors.model}>
          <Input id="model" value={values.model} onChange={set("model")} />
        </Field>
        <Field label="Year" name="year" error={fieldErrors.year}>
          <Input id="year" type="number" inputMode="numeric" value={values.year} onChange={set("year")} className="font-mono tabular-nums" />
        </Field>
        <Field label="Kilometres" name="kilometres" error={fieldErrors.kilometres}>
          <Input id="kilometres" type="number" inputMode="numeric" value={values.kilometres} onChange={set("kilometres")} className="font-mono tabular-nums" />
        </Field>
        <Field label="Trim" name="trim" error={fieldErrors.trim} className="sm:col-span-2">
          <Input id="trim" value={values.trim} onChange={set("trim")} />
        </Field>
        <Field label="Seller asking" name="sellerAskingPrice" error={fieldErrors.sellerAskingPrice}>
          <Input id="sellerAskingPrice" type="number" inputMode="numeric" value={values.sellerAskingPrice} onChange={set("sellerAskingPrice")} className="font-mono tabular-nums" />
        </Field>
        <Field label="Est. repairs" name="repairCost" error={fieldErrors.repairCost}>
          <Input id="repairCost" type="number" inputMode="numeric" value={values.repairCost} onChange={set("repairCost")} className="font-mono tabular-nums" />
        </Field>
      </section>

      <div className="flex flex-col gap-2">
        <span className="text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
          Photos
        </span>
        <PhotoUpload onChange={setPhotos} initial={initialPhotos} />
      </div>

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" size="lg" disabled={loading}>
          {loading ? "Saving…" : "Save & re-run"}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="ghost"
          onClick={() => router.push(`/assessments/${assessmentId}`)}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Saving re-runs the pricing engine, so the verdict is recomputed and the
        PPSR check (if any) resets to pending.
      </p>
    </form>
  );
}
