import type { SupabaseClient } from "@supabase/supabase-js";
import type { SfsRateCard, VehicleType } from "./types";

interface RateCardRow {
  id: string;
  market: string;
  vehicle_type: string;
  base_cost: string | number;
  cost_per_mile: string | number;
  stop_fee: string | number;
  driver_cost: string | number;
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
      .select("id, market, vehicle_type, base_cost, cost_per_mile, stop_fee, driver_cost")
      .order("market")
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
      market: row.market,
      vehicle_type: row.vehicle_type as VehicleType,
      base_cost: parseFloat(String(row.base_cost)) || 0,
      cost_per_mile: parseFloat(String(row.cost_per_mile)) || 0,
      stop_fee: parseFloat(String(row.stop_fee)) || 0,
      driver_cost: parseFloat(String(row.driver_cost)) || 0,
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

