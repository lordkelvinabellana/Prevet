import { describe, it, expect } from "vitest";
import { parseCarInput, type CarInput } from "@/lib/validation/schema";

function valid(overrides: Partial<Record<keyof CarInput, unknown>> = {}) {
  return {
    plate: "1ABC123",
    vin: "WVWZZZ1KZAW000001",
    year: 2018,
    make: "Toyota",
    model: "Corolla",
    trim: "Ascent",
    kilometres: 90000,
    sellerAskingPrice: 15000,
    repairCost: 1200,
    ...overrides,
  };
}

describe("parseCarInput — happy path", () => {
  it("accepts a complete valid car", () => {
    const r = parseCarInput(valid());
    expect(r.ok).toBe(true);
  });
});

describe("parseCarInput — allowed edge cases", () => {
  it("allows missing trim", () => {
    const r = parseCarInput(valid({ trim: "" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.trim).toBeUndefined();
  });

  it("allows plate without VIN", () => {
    expect(parseCarInput(valid({ vin: "" })).ok).toBe(true);
  });

  it("allows VIN without plate", () => {
    expect(parseCarInput(valid({ plate: "" })).ok).toBe(true);
  });

  it("allows zero repair cost", () => {
    expect(parseCarInput(valid({ repairCost: 0 })).ok).toBe(true);
  });

  it("trims whitespace from text fields", () => {
    const r = parseCarInput(valid({ make: "  Mazda  " }));
    expect(r.ok && r.data.make).toBe("Mazda");
  });
});

describe("parseCarInput — negative cases (must reject)", () => {
  it("rejects when both plate and VIN are missing", () => {
    const r = parseCarInput(valid({ plate: "", vin: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.plate).toMatch(/plate or a VIN/i);
  });

  it("rejects a negative asking price", () => {
    const r = parseCarInput(valid({ sellerAskingPrice: -100 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.sellerAskingPrice).toBeTruthy();
  });

  it("rejects a zero asking price", () => {
    expect(parseCarInput(valid({ sellerAskingPrice: 0 })).ok).toBe(false);
  });

  it("rejects a negative repair cost", () => {
    const r = parseCarInput(valid({ repairCost: -50 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.repairCost).toBeTruthy();
  });

  it("rejects negative kilometres", () => {
    expect(parseCarInput(valid({ kilometres: -1 })).ok).toBe(false);
  });

  it("rejects non-integer kilometres", () => {
    expect(parseCarInput(valid({ kilometres: 90000.5 })).ok).toBe(false);
  });

  it("rejects a missing make", () => {
    const r = parseCarInput(valid({ make: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.make).toMatch(/required/i);
  });

  it("rejects an out-of-range year", () => {
    expect(parseCarInput(valid({ year: 1850 })).ok).toBe(false);
    expect(parseCarInput(valid({ year: 3000 })).ok).toBe(false);
  });

  it("rejects non-numeric numeric fields", () => {
    expect(parseCarInput(valid({ sellerAskingPrice: "lots" })).ok).toBe(false);
  });

  it("reports multiple field errors at once", () => {
    const r = parseCarInput(valid({ make: "", sellerAskingPrice: -1 }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.make).toBeTruthy();
      expect(r.errors.sellerAskingPrice).toBeTruthy();
    }
  });
});
