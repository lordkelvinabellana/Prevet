import { describe, it, expect } from "vitest";
import { mockValuationAdapter } from "@/lib/adapters/valuation.mock";
import { mockHistoryAdapter } from "@/lib/adapters/history.mock";
import { AdapterError, type CarIdentity } from "@/lib/adapters/types";

function car(overrides: Partial<CarIdentity> = {}): CarIdentity {
  return {
    plate: "1ABC123",
    vin: "WVWZZZ1KZAW000001",
    year: 2018,
    make: "Toyota",
    model: "Corolla",
    trim: "Ascent",
    kilometres: 90000,
    ...overrides,
  };
}

describe("mockValuationAdapter", () => {
  it("is deterministic — same input, same output", async () => {
    expect(await mockValuationAdapter.getValuation(car())).toEqual(
      await mockValuationAdapter.getValuation(car()),
    );
  });

  it("returns ordered, sensible ranges for a clean car", async () => {
    const v = await mockValuationAdapter.getValuation(car());
    expect(v.source).toBe("mock-redbook");
    expect(v.selectedWholesaleValue).toBeGreaterThan(0);
    expect(v.wholesaleLow!).toBeLessThanOrEqual(v.selectedWholesaleValue!);
    expect(v.wholesaleHigh!).toBeGreaterThanOrEqual(v.selectedWholesaleValue!);
    expect(v.retailLow!).toBeGreaterThan(v.wholesaleHigh!);
    expect(v.retailHigh!).toBeGreaterThan(v.retailLow!);
  });

  it("values a newer car higher than an older one (all else equal)", async () => {
    const newer = await mockValuationAdapter.getValuation(car({ year: 2022, vin: "SAMEVIN", plate: "SAME" }));
    const older = await mockValuationAdapter.getValuation(car({ year: 2014, vin: "SAMEVIN", plate: "SAME" }));
    expect(newer.selectedWholesaleValue!).toBeGreaterThan(older.selectedWholesaleValue!);
  });

  it("NOVAL trigger => missing valuation (null selected value)", async () => {
    const v = await mockValuationAdapter.getValuation(car({ plate: "NOVAL01", vin: null }));
    expect(v.selectedWholesaleValue).toBeNull();
    expect(v.wholesaleLow).toBeNull();
  });

  it("FAILVAL trigger => throws AdapterError (simulated outage)", async () => {
    await expect(
      mockValuationAdapter.getValuation(car({ plate: "FAILVAL", vin: null })),
    ).rejects.toBeInstanceOf(AdapterError);
  });
});

describe("mockHistoryAdapter", () => {
  it("clean car => all flags false", async () => {
    const h = await mockHistoryAdapter.getHistory(car());
    expect(h).toMatchObject({ stolen: false, writtenOff: false, financeOwing: false });
    expect(h.source).toBe("mock-ppsr");
    expect(h.notes).toMatch(/no adverse history/i);
  });

  it("STOLEN trigger => stolen true", async () => {
    const h = await mockHistoryAdapter.getHistory(car({ plate: "STOLEN1", vin: null }));
    expect(h.stolen).toBe(true);
    expect(h.notes).toMatch(/stolen/i);
  });

  it("WOVR trigger => written off true", async () => {
    const h = await mockHistoryAdapter.getHistory(car({ plate: "WOVR22", vin: null }));
    expect(h.writtenOff).toBe(true);
  });

  it("FINANCE trigger => finance owing true", async () => {
    const h = await mockHistoryAdapter.getHistory(car({ vin: "FINANCEVIN", plate: null }));
    expect(h.financeOwing).toBe(true);
  });

  it("FAILHIST trigger => throws AdapterError (simulated outage)", async () => {
    await expect(
      mockHistoryAdapter.getHistory(car({ plate: "FAILHIST", vin: null })),
    ).rejects.toBeInstanceOf(AdapterError);
  });
});
