import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { SfsStoreLocationsDict } from "./types";
import { FALLBACK_STORE_LOCATIONS } from "./store-locations";

type StoreLocationRow = {
  store_id: string;
  store_name: string | null;
  market: string | null;
  lat: number | string;
  lon: number | string;
  is_active?: boolean | null;
};

type Cached<T> = { value: T; fetchedAt: number };

const TTL_MS = 60_000;
let cache: Cached<SfsStoreLocationsDict> | null = null;

function isMissingTableError(message: string): boolean {
  const lc = message.toLowerCase();
  return (
    lc.includes("could not find the table") ||
    lc.includes("schema cache") ||
    (lc.includes("relation") && lc.includes("does not exist"))
  );
}

export type SfsStoreLocationsResult = {
  locations: SfsStoreLocationsDict;
  usedFallback: boolean;
  adminWarning?: string;
};

export async function getSfsStoreLocations(
  supabase: SupabaseClient,
  options?: { isAdmin?: boolean },
): Promise<SfsStoreLocationsResult> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < TTL_MS) {
    return { locations: cache.value, usedFallback: false };
  }

  try {
    const { data, error } = await supabase
      .from("sfs_store_locations")
      .select("store_id, store_name, market, lat, lon, is_active")
      .eq("is_active", true);

    if (error) {
      const fallback: SfsStoreLocationsResult = {
        locations: FALLBACK_STORE_LOCATIONS,
        usedFallback: true,
      };

      if (options?.isAdmin) {
        fallback.adminWarning = isMissingTableError(error.message)
          ? "Store locations table not found. Run supabase/sql/11_sfs_store_locations.sql (using fallback dictionary for now)."
          : "Unable to read store locations from DB (using fallback dictionary for now).";
      }
      return fallback;
    }

    const rows = Array.isArray(data) ? (data as StoreLocationRow[]) : [];
    const locations: SfsStoreLocationsDict = {};

    for (const row of rows) {
      const store_id = String(row.store_id ?? "").trim();
      const lat = typeof row.lat === "string" ? Number(row.lat) : row.lat;
      const lon = typeof row.lon === "string" ? Number(row.lon) : row.lon;
      if (!store_id) continue;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      locations[store_id] = {
        lat,
        lon,
        store_name: row.store_name ?? null,
        market: row.market ?? null,
      };
    }

    // If the DB returns nothing, keep fallback to avoid breaking existing templates.
    if (Object.keys(locations).length === 0) {
      const fallback: SfsStoreLocationsResult = {
        locations: FALLBACK_STORE_LOCATIONS,
        usedFallback: true,
      };
      if (options?.isAdmin) {
        fallback.adminWarning =
          "No active store locations found in DB. Add locations in Admin → Setup (using fallback dictionary for now).";
      }
      return fallback;
    }

    cache = { value: locations, fetchedAt: now };
    return { locations, usedFallback: false };
  } catch {
    const fallback: SfsStoreLocationsResult = {
      locations: FALLBACK_STORE_LOCATIONS,
      usedFallback: true,
    };
    if (options?.isAdmin) {
      fallback.adminWarning =
        "Unexpected error loading store locations (using fallback dictionary for now).";
    }
    return fallback;
  }
}
