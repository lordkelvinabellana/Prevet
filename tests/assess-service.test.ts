import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  runPriceAssessment,
  runHistoryCheck,
} from "@/lib/assess/service";
import type { CarInput } from "@/lib/validation/schema";

/**
 * Minimal fake Supabase query builder covering the chains the service uses:
 *   insert(row).select(col).single()            (phase 1 + history insert)
 *   select(cols).eq(col, val).maybeSingle()     (phase 2 load)
 *   update(row).eq(col, val)                     (phase 2 finalize)
 */
function fakeSupabase(
  opts: {
    insertErrorTable?: string;
    selectRow?: unknown;
    updateError?: boolean;
    /** Simulate an existing assessment for the submitted VIN (duplicate guard). */
    dupRow?: { id: string } | null;
  } = {},
) {
  const inserted: Record<string, unknown> = {};
  let updated: Record<string, unknown> | null = null;
  const client = {
    from(table: string) {
      return {
        insert(row: unknown) {
          inserted[table] = row;
          return {
            select() {
              return {
                async single() {
                  if (table === opts.insertErrorTable) {
                    return { data: null, error: { message: "boom" } };
                  }
                  return { data: { id: `${table}-id` }, error: null };
                },
              };
            },
          };
        },
        // Chainable read builder. Covers both the phase-2 load
        // (.select().eq().maybeSingle()) and the dedup check
        // (.select().ilike().order().limit().maybeSingle()).
        select() {
          const builder = {
            eq: () => builder,
            ilike: () => builder,
            order: () => builder,
            limit: () => builder,
            async maybeSingle() {
              return {
                data: opts.dupRow ?? opts.selectRow ?? null,
                error: null,
              };
            },
          };
          return builder;
        },
        update(row: unknown) {
          updated = row as Record<string, unknown>;
          return {
            async eq() {
              return { error: opts.updateError ? { message: "boom" } : null };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, inserted, getUpdated: () => updated };
}

function input(overrides: Partial<CarInput> = {}): CarInput {
  return {
    plate: "1ABC123",
    vin: "WVWZZZ1KZAW000001",
    year: 2018,
    make: "Toyota",
    model: "Corolla",
    trim: "Ascent",
    kilometres: 90000,
    sellerAskingPrice: 12000,
    repairCost: 500,
    ...overrides,
  } as CarInput;
}

/** A persisted phase-1 assessment, as returned by the phase-2 load query. */
function storedAssessment(
  overrides: { plate?: string; history_status?: "not_checked" | "checked" } = {},
) {
  return {
    id: "assess-1",
    car_id: "car-1",
    history_status: overrides.history_status ?? "not_checked",
    breakdown: {
      selectedWholesaleValue: 30750,
      repairCost: 500,
      riskBuffer: 1538,
      maxOffer: 28712,
      sellerAskingPrice: 25000,
      riskBufferRate: 0.05,
      closeBandRate: 0.05,
    },
    cars: {
      plate: overrides.plate ?? "1ABC123",
      vin: null,
      year: 2018,
      make: "Toyota",
      model: "Corolla",
      trim: "Ascent",
      kilometres: 90000,
    },
    valuations: { source: "mock-redbook" },
  };
}

describe("runPriceAssessment (phase 1 — price only, no PPSR)", () => {
  it("prices, persists as not_checked, and returns a PPSR-eligible provisional Buy", async () => {
    const { client, inserted } = fakeSupabase();
    const result = await runPriceAssessment({ supabase: client, input: input() });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.recommendation).toBe("buy");
    expect(result.data.provisional).toBe(true);
    expect(result.data.ppsrEligible).toBe(true);
    expect(result.data.history).toBeNull();

    // No history row in phase 1; assessment recorded as not_checked.
    expect(inserted.history_checks).toBeUndefined();
    expect(inserted.assessments).toMatchObject({
      history_status: "not_checked",
      history_check_id: null,
      recommendation: "buy",
    });
  });

  it("a price Pass is NOT PPSR-eligible (don't pay to check a car we'll reject)", async () => {
    const { client } = fakeSupabase();
    const result = await runPriceAssessment({
      supabase: client,
      input: input({ sellerAskingPrice: 40000 }),
    });
    expect(result.ok && result.data.recommendation).toBe("pass");
    expect(result.ok && result.data.ppsrEligible).toBe(false);
  });

  it("a no-valuation Check is not eligible (resolve valuation first)", async () => {
    const { client } = fakeSupabase();
    const result = await runPriceAssessment({
      supabase: client,
      input: input({ plate: "NOVAL1" }),
    });
    expect(result.ok && result.data.recommendation).toBe("check");
    expect(result.ok && result.data.maxOffer).toBeNull();
    expect(result.ok && result.data.ppsrEligible).toBe(false);
  });

  it("valuation outage → 503, nothing persisted", async () => {
    const { client, inserted } = fakeSupabase();
    const result = await runPriceAssessment({
      supabase: client,
      input: input({ plate: "FAILVAL1" }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(503);
    expect(inserted.cars).toBeUndefined();
  });

  it("500 when a persistence step fails", async () => {
    const { client } = fakeSupabase({ insertErrorTable: "assessments" });
    const result = await runPriceAssessment({ supabase: client, input: input() });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(500);
  });

  it("blocks a duplicate VIN: 409 + existing assessment id, nothing persisted", async () => {
    const { client, inserted } = fakeSupabase({ dupRow: { id: "existing-1" } });
    const result = await runPriceAssessment({ supabase: client, input: input() });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(result.code).toBe("duplicate_vin");
    expect(result.existingAssessmentId).toBe("existing-1");
    expect(inserted.cars).toBeUndefined();
  });

  it("skips the duplicate check when no VIN is provided (plate only)", async () => {
    // dupRow is set but must be ignored — the guard only runs when a VIN exists.
    const { client } = fakeSupabase({ dupRow: { id: "ignored" } });
    const result = await runPriceAssessment({
      supabase: client,
      input: input({ vin: undefined, plate: "1ABC123" }),
    });
    expect(result.ok).toBe(true);
  });
});

describe("runHistoryCheck (phase 2 — PPSR + finalize)", () => {
  it("finalizes a clean car: Buy stays Buy, history populated, row updated", async () => {
    const { client, inserted, getUpdated } = fakeSupabase({
      selectRow: storedAssessment(),
    });
    const result = await runHistoryCheck({ supabase: client, assessmentId: "assess-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.recommendation).toBe("buy");
    expect(result.data.provisional).toBe(false);
    expect(result.data.ppsrEligible).toBe(false);
    expect(result.data.history?.stolen).toBe(false);

    expect(inserted.history_checks).toBeDefined();
    expect(getUpdated()).toMatchObject({
      history_status: "checked",
      history_check_id: "history_checks-id",
      recommendation: "buy",
    });
  });

  it("flips a provisional Buy to Pass when PPSR reports stolen", async () => {
    const { client, getUpdated } = fakeSupabase({
      selectRow: storedAssessment({ plate: "STOLEN-1" }),
    });
    const result = await runHistoryCheck({ supabase: client, assessmentId: "assess-1" });
    expect(result.ok && result.data.recommendation).toBe("pass");
    expect(getUpdated()).toMatchObject({ recommendation: "pass" });
  });

  it("history outage → 503, nothing finalized", async () => {
    const { client, inserted, getUpdated } = fakeSupabase({
      selectRow: storedAssessment({ plate: "FAILHIST-1" }),
    });
    const result = await runHistoryCheck({ supabase: client, assessmentId: "assess-1" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(503);
    expect(result.code).toBe("history_unavailable");
    expect(inserted.history_checks).toBeUndefined();
    expect(getUpdated()).toBeNull();
  });

  it("rejects a second PPSR run (409)", async () => {
    const { client } = fakeSupabase({
      selectRow: storedAssessment({ history_status: "checked" }),
    });
    const result = await runHistoryCheck({ supabase: client, assessmentId: "assess-1" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
  });

  it("404 when the assessment doesn't exist", async () => {
    const { client } = fakeSupabase({ selectRow: null });
    const result = await runHistoryCheck({ supabase: client, assessmentId: "nope" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });
});
