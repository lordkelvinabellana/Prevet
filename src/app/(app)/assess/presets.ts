import type { Recommendation } from "@/lib/pricing/reason-codes";

/**
 * One-click demo scenarios. The mock adapters are fully deterministic, so these
 * land on a known verdict every time.
 *
 * The shared SPEC (2018 Corolla Ascent Sport, 90,000 km, $500 repairs) prices to:
 * wholesale $29,950 − repairs $500 − 5% buffer $1,497.50 = max offer $27,952.50
 * (the mock valuation jitters off the spec, not the VIN, so every preset values
 * the same despite their distinct VINs). The asking price lands each pricing
 * verdict; scenario tokens in the PLATE (STOLEN / FINANCE / FAILVAL …) force the
 * history/outage paths. Each preset carries a DISTINCT VIN so they don't trip the
 * duplicate-VIN guard against one another.
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
    values: {
      ...BASE,
      plate: "1ABC123",
      vin: "JTDBR32E160000011",
      sellerAskingPrice: "25000",
    },
  },
  {
    id: "check-close",
    tag: "Close to asking",
    outcome: "check",
    values: {
      ...BASE,
      plate: "1DEF456",
      vin: "JTDBR32E160000022",
      sellerAskingPrice: "28700",
    },
  },
  {
    id: "check-finance",
    tag: "Finance owing",
    outcome: "check",
    values: {
      ...BASE,
      plate: "FINANCE-1",
      vin: "JTDBR32E160000033",
      sellerAskingPrice: "25000",
    },
  },
  {
    id: "pass-price",
    tag: "Overpriced",
    outcome: "pass",
    values: {
      ...BASE,
      plate: "1GHI789",
      vin: "JTDBR32E160000044",
      sellerAskingPrice: "38000",
    },
  },
  {
    id: "pass-stolen",
    tag: "Stolen",
    outcome: "pass",
    values: {
      ...BASE,
      plate: "STOLEN-1",
      vin: "JTDBR32E160000055",
      sellerAskingPrice: "25000",
    },
  },
  {
    id: "outage",
    tag: "Service outage",
    outcome: "outage",
    values: {
      ...BASE,
      plate: "FAILVAL-1",
      vin: "JTDBR32E160000066",
      sellerAskingPrice: "25000",
    },
  },
];

export const DOT: Record<Preset["outcome"], string> = {
  buy: "bg-emerald-500",
  check: "bg-amber-500",
  pass: "bg-rose-500",
  outage: "bg-muted-foreground",
};
