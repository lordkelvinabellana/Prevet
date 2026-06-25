import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runAssessment } from "@/lib/assess/service";
import { mockValuationAdapter } from "@/lib/adapters/valuation.mock";
import { mockHistoryAdapter } from "@/lib/adapters/history.mock";
import type { CarInput } from "@/lib/validation/schema";

/**
 * Minimal fake Supabase query builder. Each `from(table).insert(...).select(...)
 * .single()` resolves to `{ data: { id: "<table>-id" }, error: null }` unless an
 * override forces an error, letting us exercise persistence ordering and the
 * 500 path without a real database.
 */
function fakeSupabase(errorTable?: string): {
  client: SupabaseClient;
  inserted: Record<string, unknown>;
} {
  const inserted: Record<string, unknown> = {};
  const client = {
    from(table: string) {
      return {
        insert(row: unknown) {
          inserted[table] = row;
          return {
            select() {
              return {
                async single() {
                  if (table === errorTable) {
                    return { data: null, error: { message: "boom" } };
                  }
                  return { data: { id: `${table}-id` }, error: null };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, inserted };
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

describe("runAssessment", () => {
  it("runs engine, persists all four rows, and returns the offer payload", async () => {
    const { client, inserted } = fakeSupabase();
    const result = await runAssessment({ supabase: client, input: input() });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.assessmentId).toBe("assessments-id");
    expect(result.data.carId).toBe("cars-id");
    expect(["buy", "pass", "check"]).toContain(result.data.recommendation);
    expect(result.data.reasoning.length).toBeGreaterThan(0);

    // All four tables were written, and the assessment links them.
    expect(inserted.cars).toBeDefined();
    expect(inserted.valuations).toBeDefined();
    expect(inserted.history_checks).toBeDefined();
    expect(inserted.assessments).toMatchObject({
      car_id: "cars-id",
      valuation_id: "valuations-id",
      history_check_id: "history_checks-id",
      recommendation: result.data.recommendation,
    });
  });

  it("matches the engine: a stolen car (trigger token) is a Pass", async () => {
    const { client } = fakeSupabase();
    const result = await runAssessment({
      supabase: client,
      input: input({ plate: "STOLEN1" }),
    });
    expect(result.ok && result.data.recommendation).toBe("pass");
    // A stolen car still has a computed max offer; the hard stop is the reason.
    expect(result.ok && typeof result.data.maxOffer).toBe("number");
  });

  it("returns 503 on a valuation adapter outage without persisting", async () => {
    const { client, inserted } = fakeSupabase();
    const result = await runAssessment({
      supabase: client,
      input: input({ plate: "FAILVAL1" }),
      historyAdapter: mockHistoryAdapter,
      valuationAdapter: mockValuationAdapter,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(503);
    expect(result.code).toBe("valuation_unavailable");
    expect(inserted.cars).toBeUndefined();
  });

  it("returns 503 on a history adapter outage without persisting", async () => {
    const { client, inserted } = fakeSupabase();
    const result = await runAssessment({
      supabase: client,
      input: input({ plate: "FAILHIST1" }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(503);
    expect(result.code).toBe("history_unavailable");
    expect(inserted.cars).toBeUndefined();
  });

  it("flows a succeeded-but-empty valuation through to a Check", async () => {
    const { client } = fakeSupabase();
    const result = await runAssessment({
      supabase: client,
      input: input({ plate: "NOVAL1" }),
    });
    expect(result.ok && result.data.recommendation).toBe("check");
    expect(result.ok && result.data.maxOffer).toBeNull();
  });

  it("returns 500 when a persistence step fails", async () => {
    const { client } = fakeSupabase("assessments");
    const result = await runAssessment({ supabase: client, input: input() });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(500);
  });
});
