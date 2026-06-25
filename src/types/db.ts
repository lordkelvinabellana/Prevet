/**
 * Database row types for the Car Pre-Vetting Tool.
 *
 * Hand-maintained to mirror supabase/migrations/0001_init.sql. (Can later be
 * replaced by generated types from `supabase gen types`.)
 */
import type { Recommendation, ReasonCode } from "@/lib/pricing/reason-codes";

export interface CarRow {
  id: string;
  plate: string | null;
  vin: string | null;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  kilometres: number;
  seller_asking_price: number;
  created_by: string;
  created_at: string;
}

export interface ValuationRow {
  id: string;
  car_id: string;
  source: string;
  wholesale_low: number | null;
  wholesale_high: number | null;
  retail_low: number | null;
  retail_high: number | null;
  selected_wholesale_value: number | null;
  created_at: string;
}

export interface HistoryCheckRow {
  id: string;
  car_id: string;
  finance_owing: boolean;
  stolen: boolean;
  written_off: boolean;
  source: string;
  notes: string | null;
  created_at: string;
}

export interface AssessmentRow {
  id: string;
  car_id: string;
  valuation_id: string | null;
  history_check_id: string | null;
  repair_cost: number;
  risk_buffer: number | null;
  max_offer: number | null;
  recommendation: Recommendation;
  reasoning: string;
  reason_codes: ReasonCode[];
  breakdown: unknown | null;
  history_status: "not_checked" | "checked";
  review_status: "pending" | "reviewed";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_by: string;
  created_at: string;
}
