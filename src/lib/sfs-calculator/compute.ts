/**
 * SFS Route Economics Calculator - Compute Engine
 * Pure function implementing exact formulas from spec.
 */

import type {
  SfsCalculatorInputs,
  SfsEconomicsResult,
  SfsRateCard,
} from "./types";

/**
 * Computes SFS route economics based on inputs and rate card.
 * All formulas match the spec exactly.
 */
export function computeSfsEconomics(
  inputs: SfsCalculatorInputs,
  rateCard: SfsRateCard
): SfsEconomicsResult {
  // Apply overrides if provided
  const base_cost = inputs.override_base_cost ?? rateCard.base_cost;
  const cost_per_mile = inputs.override_cost_per_mile ?? rateCard.cost_per_mile;
  const stop_fee = inputs.override_stop_fee ?? rateCard.stop_fee;
  const driver_cost = inputs.override_driver_cost ?? rateCard.driver_cost;

  // 3.1 Capacity
  const cubic_capacity = inputs.vehicle_type === "Cargo Van" ? 260000 : 520000;
  const max_packages_per_vehicle =
    inputs.avg_cubic_inches_per_package > 0
      ? cubic_capacity / inputs.avg_cubic_inches_per_package
      : cubic_capacity;

  // 3.2 Drivers
  const total_packages = inputs.anchor_packages + inputs.satellite_packages;
  const total_stops = inputs.anchor_stops + inputs.satellite_stores;

  const drivers_by_volume =
    max_packages_per_vehicle > 0
      ? Math.ceil(total_packages / max_packages_per_vehicle)
      : 1;

  const drivers_by_time =
    inputs.max_driver_time_minutes > 0
      ? Math.ceil(
          (total_stops * inputs.avg_routing_time_per_stop) /
            inputs.max_driver_time_minutes
        )
      : 1;

  const drivers_required = Math.max(drivers_by_volume, drivers_by_time, 1);

  // 3.3 Distance
  const total_route_miles =
    inputs.pickup_route_miles +
    inputs.satellite_extra_miles +
    inputs.miles_to_hub_or_spoke;

  // 3.4 Anchor economics
  const distance_cost = cost_per_mile * total_route_miles;
  const driver_block_cost = driver_cost * drivers_required;
  const anchor_route_cost = base_cost + distance_cost + driver_block_cost;
  const anchor_cpp =
    inputs.anchor_packages > 0
      ? anchor_route_cost / inputs.anchor_packages
      : 0;

  // 3.5 Density eligibility
  const avg_satellite_distance =
    inputs.satellite_stores > 0
      ? inputs.satellite_extra_miles / inputs.satellite_stores
      : 0;

  const density_eligible =
    inputs.pickup_window_minutes <= 120 &&
    avg_satellite_distance <= inputs.max_satellite_miles_allowed &&
    inputs.satellite_packages <= inputs.max_satellite_packages_allowed;

  // 3.6 Satellite economics
  const satellite_incremental_cost =
    cost_per_mile * inputs.satellite_extra_miles +
    stop_fee * inputs.satellite_stores;

  // Satellite CPP: if density eligible, use incremental/satellite_packages, else anchor_cpp
  let satellite_cpp: number | null = null;
  if (inputs.satellite_packages > 0) {
    if (density_eligible) {
      satellite_cpp = satellite_incremental_cost / inputs.satellite_packages;
    } else {
      satellite_cpp = anchor_cpp;
    }
  }

  // 3.7 Blended outputs
  const total_cost = anchor_route_cost + satellite_incremental_cost;
  const blended_cpp = total_packages > 0 ? total_cost / total_packages : 0;
  const savings_absolute = anchor_cpp - blended_cpp;
  const savings_percent = anchor_cpp > 0 ? savings_absolute / anchor_cpp : 0;

  return {
    cubic_capacity,
    max_packages_per_vehicle,
    total_packages,
    total_stops,
    drivers_by_volume,
    drivers_by_time,
    drivers_required,
    total_route_miles,
    distance_cost,
    driver_block_cost,
    anchor_route_cost,
    anchor_cpp,
    avg_satellite_distance,
    density_eligible,
    satellite_incremental_cost,
    satellite_cpp,
    total_cost,
    blended_cpp,
    savings_absolute,
    savings_percent,
    rate_card: { base_cost, cost_per_mile, stop_fee, driver_cost },
  };
}

