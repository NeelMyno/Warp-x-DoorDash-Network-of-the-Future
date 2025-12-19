import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { SfsDensityTier } from "./types";
import { DEFAULT_DENSITY_TIERS, validateDensityTiers } from "./density";

type TierRow = {
  id: string;
  sort_order: number;
  min_miles: number | string;
  max_miles: number | string | null;
  discount_pct: number | string;
  label: string | null;
  is_active?: boolean | null;
};

type Cached<T> = { value: T; fetchedAt: number };
const TTL_MS = 60_000;
let cache: Cached<SfsDensityTier[]> | null = null;

function isMissingTableError(message: string): boolean {
  const lc = message.toLowerCase();
  return (
    lc.includes("could not find the table") ||
    lc.includes("schema cache") ||
    (lc.includes("relation") && lc.includes("does not exist"))
  );
}

export type SfsDensityTiersResult = {
  tiers: SfsDensityTier[];
  usedFallback: boolean;
  adminWarning?: string;
};

export async function getSfsDensityTiers(
  supabase: SupabaseClient,
  options?: { isAdmin?: boolean },
): Promise<SfsDensityTiersResult> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < TTL_MS) {
    return { tiers: cache.value, usedFallback: false };
  }

  try {
    const { data, error } = await supabase
      .from("sfs_density_discount_tiers")
      .select("id, sort_order, min_miles, max_miles, discount_pct, label, is_active")
      .eq("is_active", true)
      .order("sort_order");

    if (error) {
      const fallback: SfsDensityTiersResult = {
        tiers: DEFAULT_DENSITY_TIERS,
        usedFallback: true,
      };
      if (options?.isAdmin) {
        fallback.adminWarning = isMissingTableError(error.message)
          ? "Density tiers table not found. Run supabase/sql/12_sfs_density_discount_tiers.sql (using default tiers for now)."
          : "Unable to read density tiers from DB (using default tiers for now).";
      }
      return fallback;
    }

    const rows = Array.isArray(data) ? (data as TierRow[]) : [];
    const tiers: SfsDensityTier[] = rows
      .map((r) => {
        const minMiles = typeof r.min_miles === "string" ? Number(r.min_miles) : r.min_miles;
        const maxMiles =
          r.max_miles == null
            ? null
            : typeof r.max_miles === "string"
              ? Number(r.max_miles)
              : r.max_miles;
        const discountPct =
          typeof r.discount_pct === "string" ? Number(r.discount_pct) : r.discount_pct;
        return {
          id: r.id,
          sortOrder: Number(r.sort_order),
          minMiles,
          maxMiles: Number.isFinite(maxMiles as number) ? (maxMiles as number) : maxMiles,
          discountPct,
          label: r.label ?? null,
        };
      })
      .filter((t) => Number.isFinite(t.sortOrder));

    const validation = validateDensityTiers(tiers);
    if (!validation.ok) {
      const fallback: SfsDensityTiersResult = {
        tiers: DEFAULT_DENSITY_TIERS,
        usedFallback: true,
      };
      if (options?.isAdmin) {
        fallback.adminWarning = `Density tiers invalid (${validation.reason}). Using default tiers for now.`;
      }
      return fallback;
    }

    cache = { value: tiers, fetchedAt: now };
    return { tiers, usedFallback: false };
  } catch {
    const fallback: SfsDensityTiersResult = {
      tiers: DEFAULT_DENSITY_TIERS,
      usedFallback: true,
    };
    if (options?.isAdmin) {
      fallback.adminWarning = "Unexpected error loading density tiers (using default tiers for now).";
    }
    return fallback;
  }
}
