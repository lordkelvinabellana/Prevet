import { describe, it, expect } from "vitest";
import { assess, type PricingInput } from "@/lib/pricing/engine";
import { explain, formatAud } from "@/lib/pricing/explain";

function baseInput(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    sellerAskingPrice: 15000,
    repairCost: 1200,
    valuation: { selectedWholesaleValue: 18000 },
    history: { financeOwing: false, stolen: false, writtenOff: false },
    ...overrides,
  };
}

describe("formatAud", () => {
  it("formats whole-dollar AUD", () => {
    expect(formatAud(15900)).toBe("$15,900");
  });
  it("renders N/A for null", () => {
    expect(formatAud(null)).toBe("N/A");
  });
});

describe("explain (template, no AI)", () => {
  it("explains a Buy with the calculation breakdown", () => {
    const text = explain(assess(baseInput()));
    expect(text).toContain("at or above");
    expect(text).toContain("Calculation:");
    expect(text).toContain("$15,900");
  });

  it("explains a stolen Pass without a calculation line (no valuation math needed)", () => {
    const text = explain(
      assess(baseInput({ history: { financeOwing: false, stolen: true, writtenOff: false } })),
    );
    expect(text.toLowerCase()).toContain("stolen");
  });

  it("explains a missing valuation Check", () => {
    const text = explain(assess(baseInput({ valuation: { selectedWholesaleValue: null } })));
    expect(text.toLowerCase()).toContain("no valuation");
    expect(text).not.toContain("Calculation:");
  });

  it("notes when a result is provisional (history not yet checked)", () => {
    const text = explain(assess(baseInput({ history: null })));
    expect(text.toLowerCase()).toContain("provisional");
  });

  it("explains a non-viable offer (repairs exceed value)", () => {
    const text = explain(assess(baseInput({ repairCost: 20000 })));
    expect(text.toLowerCase()).toContain("exceed");
  });
});
