import type { CarIdentity, ValuationAdapter, ValuationResult } from "./types";
import { AdapterError } from "./types";
import { TRIGGER, hasTrigger, specKey, hashString } from "./mock-triggers";

/** Fixed reference year so values are deterministic and not clock-dependent. */
const REFERENCE_YEAR = 2025;
const SOURCE = "mock-redbook";

/** Round to the nearest $50 for tidy, realistic figures. */
function round50(value: number): number {
  return Math.round(value / 50) * 50;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Mock RedBook-style valuation.
 *
 * Deterministic: depreciates from a $45k anchor by age and kilometres, plus a
 * stable per-spec jitter derived from the vehicle spec hash (NOT the VIN/plate,
 * so identical specs value the same regardless of VIN). Wholesale/retail ranges
 * are derived from the selected wholesale value.
 */
export const mockValuationAdapter: ValuationAdapter = {
  async getValuation(car: CarIdentity): Promise<ValuationResult> {
    if (hasTrigger(car, TRIGGER.FAIL_VALUATION)) {
      throw new AdapterError("Valuation service unavailable", "valuation_unavailable");
    }

    if (hasTrigger(car, TRIGGER.NO_VALUATION)) {
      return {
        source: SOURCE,
        wholesaleLow: null,
        wholesaleHigh: null,
        retailLow: null,
        retailHigh: null,
        selectedWholesaleValue: null,
      };
    }

    const agePenalty = Math.max(0, REFERENCE_YEAR - car.year) * 1800;
    const kmPenalty = (car.kilometres / 1000) * 40;
    const jitter = hashString(specKey(car)) % 2000;

    const selected = round50(clamp(45000 - agePenalty - kmPenalty + jitter, 3000, 60000));

    return {
      source: SOURCE,
      wholesaleLow: round50(selected * 0.95),
      wholesaleHigh: round50(selected * 1.05),
      retailLow: round50(selected * 1.12),
      retailHigh: round50(selected * 1.22),
      selectedWholesaleValue: selected,
    };
  },
};
