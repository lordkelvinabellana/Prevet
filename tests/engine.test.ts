import { describe, it, expect } from "vitest";
import {
  assess,
  calculateMaxOffer,
  RISK_BUFFER_RATE,
  CLOSE_BAND_RATE,
  type PricingInput,
} from "@/lib/pricing/engine";
import { REASON_CODE } from "@/lib/pricing/reason-codes";

/** A clean baseline car: valuation present, no history flags. */
function baseInput(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    sellerAskingPrice: 15000,
    repairCost: 1200,
    valuation: { selectedWholesaleValue: 18000 },
    history: { financeOwing: false, stolen: false, writtenOff: false },
    ...overrides,
  };
}

describe("calculateMaxOffer", () => {
  it("computes Max Offer = wholesale − repair − 5% buffer (spec example)", () => {
    const { maxOffer, riskBuffer } = calculateMaxOffer(18000, 1200);
    expect(riskBuffer).toBe(900); // 5% of 18000
    expect(maxOffer).toBe(15900); // 18000 - 1200 - 900
  });

  it("returns null when no valuation is available", () => {
    expect(calculateMaxOffer(null, 1200)).toEqual({
      maxOffer: null,
      riskBuffer: null,
    });
  });

  it("rounds to whole dollars", () => {
    const { maxOffer, riskBuffer } = calculateMaxOffer(17333, 1000);
    expect(riskBuffer).toBe(Math.round(17333 * 0.05)); // 867
    expect(maxOffer).toBe(Math.round(17333 - 1000 - 867)); // 15466
  });

  it("uses the default risk buffer rate constant", () => {
    expect(RISK_BUFFER_RATE).toBe(0.05);
    expect(CLOSE_BAND_RATE).toBe(0.05);
  });
});

describe("assess — history hard stops (highest precedence)", () => {
  it("stolen => Pass", () => {
    const r = assess(baseInput({ history: { financeOwing: false, stolen: true, writtenOff: false } }));
    expect(r.recommendation).toBe("pass");
    expect(r.reasonCodes).toEqual([REASON_CODE.HISTORY_STOLEN]);
  });

  it("written off => Pass", () => {
    const r = assess(baseInput({ history: { financeOwing: false, stolen: false, writtenOff: true } }));
    expect(r.recommendation).toBe("pass");
    expect(r.reasonCodes).toEqual([REASON_CODE.HISTORY_WRITTEN_OFF]);
  });

  it("stolen overrides an otherwise-strong offer", () => {
    const r = assess(
      baseInput({
        sellerAskingPrice: 1000, // offer would easily beat this
        history: { financeOwing: false, stolen: true, writtenOff: false },
      }),
    );
    expect(r.recommendation).toBe("pass");
    expect(r.reasonCodes[0]).toBe(REASON_CODE.HISTORY_STOLEN);
  });

  it("stolen takes precedence over written off (order)", () => {
    const r = assess(baseInput({ history: { financeOwing: true, stolen: true, writtenOff: true } }));
    expect(r.reasonCodes).toEqual([REASON_CODE.HISTORY_STOLEN]);
  });
});

describe("assess — finance owing => Check", () => {
  it("flags finance owing for human check even with a good offer", () => {
    const r = assess(baseInput({ history: { financeOwing: true, stolen: false, writtenOff: false } }));
    expect(r.recommendation).toBe("check");
    expect(r.reasonCodes).toEqual([REASON_CODE.HISTORY_FINANCE_OWING]);
  });
});

describe("assess — missing valuation => Check", () => {
  it("returns Check and a null max offer when valuation is missing", () => {
    const r = assess(baseInput({ valuation: { selectedWholesaleValue: null } }));
    expect(r.recommendation).toBe("check");
    expect(r.maxOffer).toBeNull();
    expect(r.reasonCodes).toEqual([REASON_CODE.VALUATION_MISSING]);
  });
});

describe("assess — offer vs asking price", () => {
  it("max offer >= asking => Buy", () => {
    // wholesale 18000 -> maxOffer 15900; asking 15000 -> Buy
    const r = assess(baseInput({ sellerAskingPrice: 15000 }));
    expect(r.maxOffer).toBe(15900);
    expect(r.recommendation).toBe("buy");
    expect(r.reasonCodes).toEqual([REASON_CODE.OFFER_AT_OR_ABOVE_ASKING]);
  });

  it("max offer exactly equal to asking => Buy (boundary)", () => {
    const r = assess(baseInput({ sellerAskingPrice: 15900 }));
    expect(r.recommendation).toBe("buy");
  });

  it("within 5% below asking => Check (close band)", () => {
    // maxOffer 15900; asking 16500 -> threshold = 15675; 15900 >= 15675 => Check
    const r = assess(baseInput({ sellerAskingPrice: 16500 }));
    expect(r.recommendation).toBe("check");
    expect(r.reasonCodes).toEqual([REASON_CODE.OFFER_CLOSE_TO_ASKING]);
  });

  it("max offer exactly at the close threshold => Check (boundary)", () => {
    // Clean integers: asking 16000 -> threshold = 16000 * 0.95 = 15200.
    // Tune repair so maxOffer == 15200: 18000 - 900 buffer - repair = 15200 -> repair 1900.
    const r = assess(baseInput({ sellerAskingPrice: 16000, repairCost: 1900 }));
    expect(r.maxOffer).toBe(15200);
    expect(r.recommendation).toBe("check");
    expect(CLOSE_BAND_RATE).toBe(0.05);
  });

  it("clearly below asking (more than 5%) => Pass", () => {
    // maxOffer 15900; asking 20000 -> threshold 19000; 15900 < 19000 => Pass
    const r = assess(baseInput({ sellerAskingPrice: 20000 }));
    expect(r.recommendation).toBe("pass");
    expect(r.reasonCodes).toEqual([REASON_CODE.OFFER_BELOW_ASKING]);
  });

  it("just below the close threshold => Pass", () => {
    const asking = 16000;
    const threshold = asking * (1 - CLOSE_BAND_RATE); // 15200
    // force maxOffer just under threshold via wholesale tuning is complex; use repair instead
    // wholesale 18000, buffer 900; to get maxOffer = threshold - 1 = 15199 => repair = 18000-900-15199 = 1901
    const r = assess(baseInput({ sellerAskingPrice: asking, repairCost: 1901 }));
    expect(r.maxOffer).toBe(15199);
    expect(r.recommendation).toBe("pass");
  });
});

describe("assess — breakdown is always populated for auditability", () => {
  it("includes all calculation inputs and outputs", () => {
    const r = assess(baseInput());
    expect(r.breakdown).toMatchObject({
      selectedWholesaleValue: 18000,
      repairCost: 1200,
      riskBuffer: 900,
      maxOffer: 15900,
      sellerAskingPrice: 15000,
      riskBufferRate: 0.05,
      closeBandRate: 0.05,
    });
  });

  it("is deterministic — same input, same output", () => {
    const input = baseInput({ sellerAskingPrice: 16500 });
    expect(assess(input)).toEqual(assess(input));
  });
});

describe("assess — price-only / provisional (history not yet checked)", () => {
  it("skips the history hard stops and flags the result provisional", () => {
    const r = assess(baseInput({ history: null }));
    expect(r.provisional).toBe(true);
    expect(r.recommendation).toBe("buy"); // decided on price alone
  });

  it("a checked history yields a non-provisional result", () => {
    expect(assess(baseInput()).provisional).toBe(false);
  });
});
