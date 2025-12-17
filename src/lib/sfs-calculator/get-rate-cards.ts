import type { SupabaseClient } from "@supabase/supabase-js";
import type { SfsRateCard, VehicleType } from "./types";

interface RateCardRow {
  id: string;
  vehicle_type: string;
  base_fee: string | number;
  per_mile_rate: string | number;
  per_stop_rate: string | number;
  created_at?: string | null;
  updated_at?: string | null;
}

/** Reason codes for fetch failures */
export type SfsRateCardsErrorReason = "MISSING_TABLE" | "RLS" | "UNKNOWN";

/** Successful result with rate cards */
export interface SfsRateCardsSuccess {
  ok: true;
  rateCards: SfsRateCard[];
}

/** Failed result with reason */
export interface SfsRateCardsError {
  ok: false;
  reason: SfsRateCardsErrorReason;
  message: string;
}

export type SfsRateCardsResult = SfsRateCardsSuccess | SfsRateCardsError;

/**
 * Detects if the error indicates a missing table or schema cache issue.
 */
function isMissingTableError(message: string): boolean {
  const lc = message.toLowerCase();
  return (
    lc.includes("could not find the table") ||
    lc.includes("schema cache") ||
    lc.includes("relation") && lc.includes("does not exist")
  );
}

/**
 * Fetches all SFS rate cards from the database.
 * Returns a structured result to distinguish empty data vs configuration errors.
 */
export async function getSfsRateCards(
  supabase: SupabaseClient
): Promise<SfsRateCardsResult> {
  try {
    const { data, error } = await supabase
      .from("sfs_rate_cards")
      .select("id, vehicle_type, base_fee, per_mile_rate, per_stop_rate, created_at, updated_at")
      .order("vehicle_type");

    if (error) {
      // Detect missing table / schema cache issue (do not console.error to avoid Next overlay)
      if (isMissingTableError(error.message)) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[sfs-rate-cards] Table not found. Run supabase/sql/05_sfs_rate_cards.sql");
        }
        return {
          ok: false,
          reason: "MISSING_TABLE",
          message: "Rate cards table not configured. Run the migration.",
        };
      }

      // RLS or permission error
      if (error.code === "42501" || error.message.toLowerCase().includes("permission")) {
        console.warn("[sfs-rate-cards] RLS/permission error:", error.message);
        return {
          ok: false,
          reason: "RLS",
          message: "Permission denied accessing rate cards.",
        };
      }

      // Unknown error - warn instead of error to avoid Next overlay
      console.warn("[sfs-rate-cards] Fetch failed:", error.message);
      return {
        ok: false,
        reason: "UNKNOWN",
        message: error.message,
      };
    }

    if (!data || !Array.isArray(data)) {
      return { ok: true, rateCards: [] };
    }

    const rateCards = (data as RateCardRow[]).map((row) => ({
      id: row.id,
      vehicle_type: row.vehicle_type as VehicleType,
      base_fee: parseFloat(String(row.base_fee)) || 0,
      per_mile_rate: parseFloat(String(row.per_mile_rate)) || 0,
      per_stop_rate: parseFloat(String(row.per_stop_rate)) || 0,
      created_at: typeof row.created_at === "string" ? row.created_at : undefined,
      updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
    }));

    return { ok: true, rateCards };
  } catch (err) {
    // Catch-all for unexpected errors
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn("[sfs-rate-cards] Unexpected error:", message);
    return {
      ok: false,
      reason: "UNKNOWN",
      message,
    };
  }
}
