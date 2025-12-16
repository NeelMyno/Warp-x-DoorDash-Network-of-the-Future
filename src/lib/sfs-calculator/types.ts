/**
 * SFS Route Economics Calculator Types
 */

export type VehicleType = "Cargo Van" | "Box Truck";

/** Rate card row from database */
export interface SfsRateCard {
  id: string;
  market: string;
  vehicle_type: VehicleType;
  base_cost: number;
  cost_per_mile: number;
  stop_fee: number;
  driver_cost: number;
}

/** Calculator input values */
export interface SfsCalculatorInputs {
  // Required dropdowns
  market: string;
  vehicle_type: VehicleType;

  // Required numeric inputs
  anchor_packages: number;
  anchor_stops: number;
  pickup_route_miles: number;
  avg_routing_time_per_stop: number;
  pickup_window_minutes: number;
  avg_cubic_inches_per_package: number;
  satellite_stores: number;
  satellite_packages: number;
  satellite_extra_miles: number;
  miles_to_hub_or_spoke: number;
  max_satellite_packages_allowed: number;
  max_satellite_miles_allowed: number;
  max_driver_time_minutes: number;

  // Optional rate card overrides
  override_base_cost?: number;
  override_cost_per_mile?: number;
  override_stop_fee?: number;
  override_driver_cost?: number;
}

/** Computed economics result */
export interface SfsEconomicsResult {
  // Capacity
  cubic_capacity: number;
  max_packages_per_vehicle: number;

  // Drivers
  total_packages: number;
  total_stops: number;
  drivers_by_volume: number;
  drivers_by_time: number;
  drivers_required: number;

  // Distance
  total_route_miles: number;

  // Anchor economics
  distance_cost: number;
  driver_block_cost: number;
  anchor_route_cost: number;
  anchor_cpp: number;

  // Density eligibility
  avg_satellite_distance: number;
  density_eligible: boolean;

  // Satellite economics
  satellite_incremental_cost: number;
  satellite_cpp: number | null;

  // Blended outputs
  total_cost: number;
  blended_cpp: number;
  savings_absolute: number;
  savings_percent: number;

  // Rate card values used (after overrides)
  rate_card: {
    base_cost: number;
    cost_per_mile: number;
    stop_fee: number;
    driver_cost: number;
  };
}

/** Default input values */
export const DEFAULT_INPUTS: Omit<SfsCalculatorInputs, "market" | "vehicle_type"> = {
  anchor_packages: 100,
  anchor_stops: 50,
  pickup_route_miles: 20,
  avg_routing_time_per_stop: 5,
  pickup_window_minutes: 120,
  avg_cubic_inches_per_package: 1000,
  satellite_stores: 3,
  satellite_packages: 30,
  satellite_extra_miles: 5,
  miles_to_hub_or_spoke: 10,
  max_satellite_packages_allowed: 90,
  max_satellite_miles_allowed: 10,
  max_driver_time_minutes: 480,
};

