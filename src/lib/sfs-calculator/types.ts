/**
 * SFS Route Economics Calculator Types
 */

export type VehicleType = "Cargo Van" | "26' Box Truck";
export type StopType = "Anchor" | "Satellite";

export const SFS_VEHICLE_TYPES: VehicleType[] = ["Cargo Van", "26' Box Truck"];

export const SFS_MARKETS = [
  "Chicago",
  "Dallas",
  "Los Angeles",
  "New York City",
  "Atlanta",
  "Seattle",
  "Miami",
  "Denver",
  "Phoenix",
  "Boston",
] as const;

export const SFS_STORES_UPLOAD_HEADERS = [
  "route_id",
  "anchor_id",
  "stop_type",
  "store_name",
  "address",
  "city",
  "state",
  "zip",
  "packages",
  "avg_cubic_inches_per_package",
  "pickup_window_start_time",
  "pickup_window_end_time",
  "service_time_minutes",
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
  store_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  packages: number;
  avg_cubic_inches_per_package?: number | null;
  pickup_window_start_time: string;
  pickup_window_end_time: string;
  service_time_minutes?: number | null;
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

/** Result row for a single anchor_id (v2 per PDF). */
export type SfsAnchorResult = {
  anchor_id: string;
  window_feasible: boolean;
  pickup_overlap_minutes: number;
  pickup_minutes_required: number;
  drivers_required: number;
  vehicles_required_by_cube: number;
  total_packages: number;
  total_stops: number;
  anchor_route_cost: number;
  blended_cost: number;
  anchor_cpp: number;
  blended_cpp: number;
  anchor_packages: number;
  satellite_packages: number;
  satellite_stops: number;
  total_cube: number;
  service_minutes: number;
  routing_minutes: number;
  hub_travel_minutes: number;
  total_minutes_required: number;
  drivers_by_time: number;
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
