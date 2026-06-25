import type { CarIdentity, HistoryAdapter, HistoryResult } from "./types";
import { AdapterError } from "./types";
import { TRIGGER, hasTrigger } from "./mock-triggers";

const SOURCE = "mock-ppsr";

/**
 * Mock PPSR-style history check.
 *
 * Deterministic: all flags are false (clean) unless a trigger token is present
 * in the plate or VIN. See {@link TRIGGER} for the token convention.
 */
export const mockHistoryAdapter: HistoryAdapter = {
  async getHistory(car: CarIdentity): Promise<HistoryResult> {
    if (hasTrigger(car, TRIGGER.FAIL_HISTORY)) {
      throw new AdapterError("History service unavailable", "history_unavailable");
    }

    const stolen = hasTrigger(car, TRIGGER.STOLEN);
    const writtenOff = hasTrigger(car, TRIGGER.WRITTEN_OFF);
    const financeOwing = hasTrigger(car, TRIGGER.FINANCE);

    const flags: string[] = [];
    if (stolen) flags.push("Reported stolen.");
    if (writtenOff) flags.push("Listed on the Written-Off Vehicle Register.");
    if (financeOwing) flags.push("Finance owing — encumbrance recorded.");

    return {
      source: SOURCE,
      stolen,
      writtenOff,
      financeOwing,
      notes: flags.length ? flags.join(" ") : "No adverse history found.",
    };
  },
};
