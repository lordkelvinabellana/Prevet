/**
 * Adapter interfaces for external vehicle data.
 *
 * The MVP ships MOCK implementations only (no live RedBook / PPSR / Apify).
 * Real integrations later implement these same interfaces and drop in without
 * touching the pricing engine or API orchestration.
 */

/** The car identity used to look up valuation and history. */
export interface CarIdentity {
  plate?: string | null;
  vin?: string | null;
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  kilometres: number;
}

/** RedBook-style valuation result. Range fields are null when unavailable. */
export interface ValuationResult {
  source: string;
  wholesaleLow: number | null;
  wholesaleHigh: number | null;
  retailLow: number | null;
  retailHigh: number | null;
  /** The single wholesale figure the engine prices against. Null = no valuation. */
  selectedWholesaleValue: number | null;
}

/** PPSR-style history check result. */
export interface HistoryResult {
  source: string;
  financeOwing: boolean;
  stolen: boolean;
  writtenOff: boolean;
  notes: string | null;
}

export interface ValuationAdapter {
  getValuation(car: CarIdentity): Promise<ValuationResult>;
}

export interface HistoryAdapter {
  getHistory(car: CarIdentity): Promise<HistoryResult>;
}

/** Thrown when an adapter cannot complete a lookup (simulated outage, etc.). */
export class AdapterError extends Error {
  constructor(
    message: string,
    readonly code: "valuation_unavailable" | "history_unavailable",
  ) {
    super(message);
    this.name = "AdapterError";
  }
}
