import type { CarIdentity } from "./types";

/**
 * Deterministic scenario triggers for the mock adapters.
 *
 * The mocks are fully deterministic functions of the car identity — no
 * randomness — so tests are repeatable and a demo can force any scenario just
 * by typing a magic token into the plate or VIN field.
 *
 * Tokens (case-insensitive, matched as a substring of plate or VIN):
 *   STOLEN    -> history reports stolen
 *   WOVR      -> history reports written off (Written-Off Vehicle Register)
 *   FINANCE   -> history reports finance owing
 *   NOVAL     -> valuation has no selected value (missing valuation)
 *   FAILVAL   -> valuation adapter throws (simulated outage)
 *   FAILHIST  -> history adapter throws (simulated outage)
 */
export const TRIGGER = {
  STOLEN: "STOLEN",
  WRITTEN_OFF: "WOVR",
  FINANCE: "FINANCE",
  NO_VALUATION: "NOVAL",
  FAIL_VALUATION: "FAILVAL",
  FAIL_HISTORY: "FAILHIST",
} as const;

/** The combined identity string searched for trigger tokens. */
export function identityTokenSource(car: CarIdentity): string {
  return `${car.plate ?? ""} ${car.vin ?? ""}`.toUpperCase();
}

export function hasTrigger(car: CarIdentity, token: string): boolean {
  return identityTokenSource(car).includes(token);
}

/** A stable, seed-style identity key for deriving pseudo-values. */
export function identityKey(car: CarIdentity): string {
  return (
    car.vin?.trim() ||
    car.plate?.trim() ||
    `${car.make}|${car.model}|${car.trim ?? ""}|${car.year}`
  ).toUpperCase();
}

/**
 * A key derived from the vehicle *spec* only — never the VIN/plate. The mock
 * valuation jitters off this so two cars of the same spec value identically
 * regardless of their VIN; that keeps valuations stable when VINs differ (e.g.
 * the demo presets, or unique-VIN test runs) and is independent of the
 * duplicate-VIN guard.
 */
export function specKey(car: CarIdentity): string {
  return `${car.make}|${car.model}|${car.trim ?? ""}|${car.year}|${car.kilometres}`.toUpperCase();
}

/** Deterministic 32-bit FNV-1a hash of a string (no Math.random). */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
