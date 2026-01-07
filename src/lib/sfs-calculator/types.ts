/**
 * SFS Route Economics Calculator Types
 */

export type VehicleType = "Cargo Van" | "26' Box Truck";
export type StopType = "Anchor" | "Satellite";

export const SFS_VEHICLE_TYPES: VehicleType[] = ["Cargo Van", "26' Box Truck"];

/**
 * Top 10 markets list for backward compatibility.
 */
export { SFS_TOP_MARKETS as SFS_MARKETS } from "./markets";

/**
 * Get the default market name for initial state.
 */
export { getDefaultMarket } from "./markets";

/** Required upload headers for SFS calculator V3 (distance-band density discounts). */
export const SFS_STORES_UPLOAD_REQUIRED_HEADERS = [
  "route_id",
  "anchor_id",
  "stop_type",
  "store_name",
  "packages",
  "pickup_window_start_time",
  "pickup_window_end_time",
] as const;

/** Optional upload headers (accepted when present). */
export const SFS_STORES_UPLOAD_OPTIONAL_HEADERS = [
  "store_id",
  "distance_miles",
  "avg_cubic_inches_per_package",
  "service_time_minutes",
  "zip_code",
] as const;



/** Rate card row from database (v2: one row per vehicle type). */
export interface SfsRateCard {
  id: string;
  vehicle_type: VehicleType;
  base_fee: number;
  per_mile_rate: number;
  per_stop_rate: number;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_SFS_RATE_CARDS: Record<VehicleType, Omit<SfsRateCard, "id">> = {
  "Cargo Van": {
    vehicle_type: "Cargo Van",
    base_fee: 95.0,
    per_mile_rate: 1.5,
    per_stop_rate: 20.0,
  },
  "26' Box Truck": {
    vehicle_type: "26' Box Truck",
    base_fee: 175.0,
    per_mile_rate: 2.2,
    per_stop_rate: 50.0,
  },
};

export type SfsStoreLocation = {
  lat: number;
  lon: number;
  store_name?: string | null;
  market?: string | null;
};

export type SfsStoreLocationsDict = Record<string, SfsStoreLocation>;

export type SfsDensityTier = {
  id?: string;
  sortOrder: number;
  minMiles: number;
  maxMiles: number | null;
  discountPct: number;
  label?: string | null;
};

/** Calculator input values (top-level). */
export interface SfsCalculatorInputs {
  market: string;
  vehicle_type: VehicleType;
  miles_to_hub_or_spoke: number;
  avg_routing_time_per_stop_minutes: number;
  default_service_time_minutes: number;
  max_driver_time_minutes: number;
  avg_speed_mph: number;
  default_avg_cubic_inches_per_package: number;
}

export interface SfsStoreUploadRow {
  route_id: string;
  anchor_id: string;
  stop_type: StopType;
  /** Optional store_id (for backward compatibility). */
  store_id?: string;
  store_name: string;
  packages: number;
  /** Optional distance in miles from satellite to anchor (used when mode = "per_store"). */
  distance_miles?: number | null;
  avg_cubic_inches_per_package?: number | null;
  pickup_window_start_time: string;
  pickup_window_end_time: string;
  service_time_minutes?: number | null;
  /** Optional ZIP code for map visualization (5-digit normalized). */
  zip_code?: string | null;
}

export interface SfsStop extends SfsStoreUploadRow {
  pickup_window_start_minutes: number;
  pickup_window_end_minutes: number;
}

export type SfsStoreUploadError = {
  row: number;
  message: string;
  field?: keyof SfsStoreUploadRow;
};

export type SfsStopWithDistance = SfsStop & {
  distance_to_anchor_miles: number;
  tier_label: string;
  tier_discount_pct: number;
  tier_sort_order: number;
};

export type SfsDensityTierBreakdown = {
  sortOrder: number;
  minMiles: number;
  maxMiles: number | null;
  label: string;
  discountPct: number;
  satellitePackages: number;
  satelliteShare: number;
  contribution: number;
};

/** Result row for a single anchor_id (v3: distance-band density discounts). */
export type SfsAnchorResult = {
  anchor_id: string;
  anchor_packages: number;
  satellite_packages: number;
  satellite_stops: number;
  total_packages: number;
  total_stops: number;

  /** Per-stop distance to anchor and tier classification (includes the anchor row at 0 miles). */
  stops_with_distance: SfsStopWithDistance[];

  density_tiers: SfsDensityTierBreakdown[];

  density_discount_pct: number;
  density_discount_cap_pct: number;
  base_portion_before_density: number;
  base_portion_after_density: number;
  stop_fees_total: number;

  anchor_route_cost: number;
  blended_cost: number;
  anchor_cpp: number;
  blended_cpp: number;
  effective_density_savings_pct: number;

  total_cube: number;
  vehicles_required_by_cube: number;
  pickup_overlap_minutes: number;
  pickup_minutes_required: number;
  service_minutes: number;
  routing_minutes: number;
  hub_travel_minutes: number;
  total_minutes_required: number;
  drivers_by_time: number;
  drivers_required: number;
  window_feasible: boolean;
  issues?: string[];
  isValid: boolean;
};

/** Default input values (numeric-only). */
export const DEFAULT_INPUTS: Omit<SfsCalculatorInputs, "market" | "vehicle_type"> = {
  miles_to_hub_or_spoke: 10,
  avg_routing_time_per_stop_minutes: 5,
  default_service_time_minutes: 5,
  max_driver_time_minutes: 480,
  avg_speed_mph: 25,
  default_avg_cubic_inches_per_package: 1000,
};
