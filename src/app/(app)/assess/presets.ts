import type { Recommendation } from "@/lib/pricing/reason-codes";

/**
 * One-click demo scenarios. The mock adapters are fully deterministic, so these
 * land on a known verdict every time.
 *
 * The shared identity (2018 Corolla, 90,000 km, $500 repairs, fixed VIN) prices
 * to: wholesale $30,750 − repairs $500 − 5% buffer $1,538 = max offer $28,712.
 * The asking price is then chosen to land each pricing verdict; scenario tokens
 * in the PLATE (STOLEN / FINANCE / FAILVAL …) force the history/outage paths.
 */

export type FormValues = {
  plate: string;
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  kilometres: string;
  sellerAskingPrice: string;
  repairCost: string;
};

export const EMPTY_FORM: FormValues = {
  plate: "",
  vin: "",
  year: "",
  make: "",
  model: "",
  trim: "",
  kilometres: "",
  sellerAskingPrice: "",
  repairCost: "",
};

const BASE = {
  vin: "WVWZZZ1KZAW000001",
  year: "2018",
  make: "Toyota",
  model: "Corolla",
  trim: "Ascent Sport",
  kilometres: "90000",
  repairCost: "500",
};

/** `outcome` drives the chip's status dot; `null` = an adapter outage (no verdict). */
export interface Preset {
  id: string;
  tag: string;
  outcome: Recommendation | "outage";
  values: FormValues;
}

export const PRESETS: Preset[] = [
  {
    id: "buy",
    tag: "Priced to buy",
    outcome: "buy",
    values: { ...BASE, plate: "1ABC123", sellerAskingPrice: "25000" },
  },
  {
    id: "check-close",
    tag: "Close to asking",
    outcome: "check",
    values: { ...BASE, plate: "1ABC123", sellerAskingPrice: "29500" },
  },
  {
    id: "check-finance",
    tag: "Finance owing",
    outcome: "check",
    values: { ...BASE, plate: "FINANCE-1", sellerAskingPrice: "25000" },
  },
  {
    id: "pass-price",
    tag: "Overpriced",
    outcome: "pass",
    values: { ...BASE, plate: "1ABC123", sellerAskingPrice: "38000" },
  },
  {
    id: "pass-stolen",
    tag: "Stolen",
    outcome: "pass",
    values: { ...BASE, plate: "STOLEN-1", sellerAskingPrice: "25000" },
  },
  {
    id: "outage",
    tag: "Service outage",
    outcome: "outage",
    values: { ...BASE, plate: "FAILVAL-1", sellerAskingPrice: "25000" },
  },
];

export const DOT: Record<Preset["outcome"], string> = {
  buy: "bg-emerald-500",
  check: "bg-amber-500",
  pass: "bg-rose-500",
  outage: "bg-muted-foreground",
};
