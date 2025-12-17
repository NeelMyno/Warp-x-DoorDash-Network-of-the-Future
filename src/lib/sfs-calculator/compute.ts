/**
 * SFS Route Economics Calculator - Compute Engine
 * Pure function implementing exact formulas from docs/calc/SFS calculator 1.pdf.
 */

import type {
  SfsCalculatorInputs,
  SfsRateCard,
  SfsStop,
  SfsAnchorResult,
  VehicleType,
} from "./types";

/**
 * Vehicle cubic capacities (cubic inches) per PDF.
 */
const VEHICLE_CUBIC_CAPACITY: Record<VehicleType, number> = {
  "Cargo Van": 650000,
  "26' Box Truck": 2700000,
};

export function getVehicleCubicCapacity(vehicleType: VehicleType): number {
  return VEHICLE_CUBIC_CAPACITY[vehicleType];
}

function ceilDiv(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return Math.ceil(numerator / denominator);
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);
}

/**
 * Computes per-anchor results for Ship From Store Route Economics.
 * All formulas match the PDF pseudocode exactly.
 */
export function computeSfsEconomics(
  inputs: SfsCalculatorInputs,
  stops: SfsStop[],
  rateCard: SfsRateCard,
): SfsAnchorResult[] {
  const base_fee = rateCard.base_fee;
  const cost_per_mile = rateCard.per_mile_rate;
  const stop_fee = rateCard.per_stop_rate;
  const vehicle_cubic_capacity = getVehicleCubicCapacity(inputs.vehicle_type);

  const anchors = new Map<string, SfsStop[]>();
  for (const stop of stops) {
    if (!anchors.has(stop.anchor_id)) anchors.set(stop.anchor_id, []);
    anchors.get(stop.anchor_id)!.push(stop);
  }

  const results: SfsAnchorResult[] = [];

  for (const [anchor_id, anchorStopsAll] of anchors.entries()) {
    const anchor_stops = anchorStopsAll.filter((s) => s.stop_type === "Anchor");
    const satellite_stops = anchorStopsAll.filter((s) => s.stop_type === "Satellite");

    const issues: string[] = [];
    if (anchor_stops.length === 0) issues.push("Missing Anchor stop row for this anchor_id.");

    const anchor_packages = sum(anchor_stops.map((s) => s.packages));
    const satellite_packages = sum(satellite_stops.map((s) => s.packages));
    const total_packages = anchor_packages + satellite_packages;
    const total_stops = anchorStopsAll.length;

    const total_cube = sum(
      anchorStopsAll.map((s) => {
        const cubePerPkg =
          typeof s.avg_cubic_inches_per_package === "number" && s.avg_cubic_inches_per_package > 0
            ? s.avg_cubic_inches_per_package
            : inputs.default_avg_cubic_inches_per_package;
        return s.packages * cubePerPkg;
      }),
    );

    const vehicles_by_cube = ceilDiv(total_cube, vehicle_cubic_capacity);

    const latest_start = Math.max(...anchorStopsAll.map((s) => s.pickup_window_start_minutes));
    const earliest_end = Math.min(...anchorStopsAll.map((s) => s.pickup_window_end_minutes));
    const pickup_overlap_minutes = Math.max(0, earliest_end - latest_start);

    const service_minutes = sum(
      anchorStopsAll.map((s) => {
        const service =
          typeof s.service_time_minutes === "number" && Number.isFinite(s.service_time_minutes)
            ? s.service_time_minutes
            : inputs.default_service_time_minutes;
        return service;
      }),
    );

    const routing_minutes = total_stops * inputs.avg_routing_time_per_stop_minutes;
    const pickup_minutes_required = service_minutes + routing_minutes;

    const hub_travel_minutes = (inputs.miles_to_hub_or_spoke / inputs.avg_speed_mph) * 60;
    const total_minutes_required = pickup_minutes_required + hub_travel_minutes;

    const drivers_by_time = ceilDiv(total_minutes_required, inputs.max_driver_time_minutes);
    const drivers_required = Math.max(vehicles_by_cube, drivers_by_time);

    const window_feasible = pickup_overlap_minutes >= pickup_minutes_required;

    const total_route_miles = inputs.miles_to_hub_or_spoke;
    const distance_cost = cost_per_mile * total_route_miles;
    const stop_cost = stop_fee * satellite_stops.length;
    const anchor_route_cost = base_fee + distance_cost;

    const anchor_cpp = anchor_packages > 0 ? anchor_route_cost / anchor_packages : 0;
    const blended_cost = anchor_route_cost + stop_cost;
    const blended_cpp = total_packages > 0 ? blended_cost / total_packages : 0;

    results.push({
      anchor_id,
      anchor_packages,
      satellite_packages,
      satellite_stops: satellite_stops.length,
      total_packages,
      total_stops,
      total_cube,
      vehicles_required_by_cube: vehicles_by_cube,
      pickup_overlap_minutes,
      pickup_minutes_required,
      service_minutes,
      routing_minutes,
      hub_travel_minutes,
      total_minutes_required,
      drivers_by_time,
      drivers_required,
      window_feasible,
      anchor_route_cost,
      blended_cost,
      anchor_cpp,
      blended_cpp,
      issues: issues.length ? issues : undefined,
      isValid: issues.length === 0,
    });
  }

  return results;
}
