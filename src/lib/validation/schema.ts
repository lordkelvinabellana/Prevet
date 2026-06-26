import { z } from "zod";

/**
 * Input validation for a car assessment request.
 *
 * Single source of truth for what a valid car submission looks like — used by
 * both the client form (inline errors) and the API route (server-side guard).
 * Validation is deterministic and explicit; it never guesses or auto-corrects.
 */

/** Upper bound for model year is REFERENCE_YEAR + 1. This is an input limit,
 *  independent of the valuation mock's depreciation anchor. */
const REFERENCE_YEAR = 2026;
const EARLIEST_YEAR = 1900;
const MAX_KILOMETRES = 2_000_000;
const MAX_PRICE = 10_000_000;
const MAX_REPAIR = 1_000_000;

/** Optional free text: trims, and treats "" as omitted. */
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

/** VIN: like optionalText but normalized to UPPERCASE so storage and the
 *  duplicate-VIN check are case-insensitive and consistent. */
const vinText = z
  .string()
  .trim()
  .toUpperCase()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const requiredText = (label: string) =>
  z
    .string({ message: `${label} is required` })
    .trim()
    .min(1, `${label} is required`);

export const carInputSchema = z
  .object({
    plate: optionalText,
    vin: vinText,
    year: z
      .number({ message: "Year is required" })
      .int("Year must be a whole number")
      .min(EARLIEST_YEAR, `Year must be ${EARLIEST_YEAR} or later`)
      .max(REFERENCE_YEAR + 1, `Year cannot be after ${REFERENCE_YEAR + 1}`),
    make: requiredText("Make"),
    model: requiredText("Model"),
    trim: optionalText,
    kilometres: z
      .number({ message: "Kilometres is required" })
      .int("Kilometres must be a whole number")
      .min(0, "Kilometres cannot be negative")
      .max(MAX_KILOMETRES, "Kilometres is unrealistically high"),
    sellerAskingPrice: z
      .number({ message: "Asking price is required" })
      .positive("Asking price must be greater than 0")
      .max(MAX_PRICE, "Asking price is unrealistically high"),
    repairCost: z
      .number({ message: "Repair cost is required" })
      .min(0, "Repair cost cannot be negative")
      .max(MAX_REPAIR, "Repair cost is unrealistically high"),
    // Storage object paths for uploaded car photos (uploaded client-side before
    // submit). Bounded; the bucket RLS is what actually enforces ownership.
    photos: z.array(z.string().min(1)).max(8).optional(),
  })
  .refine((d) => Boolean(d.plate) || Boolean(d.vin), {
    message: "Provide at least a number plate or a VIN",
    path: ["plate"],
  });

export type CarInput = z.infer<typeof carInputSchema>;

export interface ValidationFailure {
  ok: false;
  /** Field path (dot-joined) -> first error message. */
  errors: Record<string, string>;
}
export interface ValidationSuccess {
  ok: true;
  data: CarInput;
}

/** Parse unknown input into a typed CarInput or a flat field-error map. */
export function parseCarInput(input: unknown): ValidationSuccess | ValidationFailure {
  const result = carInputSchema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}
