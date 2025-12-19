/**
 * SFS Route Economics Calculator - Compute Engine
 * V3: Distance-band density discounts (SFS calculator 3.pdf spec via prompt).
 * V4: Removed store location DB dependency - uses distance_miles from CSV or distance assumptions.
 */

import type {
  DistanceAssumptions,
  SfsCalculatorInputs,
  SfsDensityTier,
  SfsRateCard,
  SfsStop,
  SfsAnchorResult,
  VehicleType,
} from "./types";
import type { SfsStopWithDistance } from "./types";
import {
  computeDensityDiscount,
  DEFAULT_DENSITY_TIERS,
  formatTierLabel,
  tierForDistance,
  validateDensityTiers,
} from "./density";

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

/** Default distance assumptions: average 15 miles. */
export const DEFAULT_DISTANCE_ASSUMPTIONS: DistanceAssumptions = {
  mode: "average",
  avgMiles: 15,
};

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
 * Computes distance for a satellite stop based on distance assumptions.
 * Priority: 1) CSV distance_miles, 2) average miles, 3) tier mix (returns 0, handled separately).
 */
function getDistanceForStop(
  stop: SfsStop,
  distanceAssumptions: DistanceAssumptions,
): number {
  // If CSV has distance_miles, use it
  if (
    typeof stop.distance_miles === "number" &&
    Number.isFinite(stop.distance_miles) &&
    stop.distance_miles >= 0
  ) {
    return stop.distance_miles;
  }

  // If mode is average, use avgMiles
  if (distanceAssumptions.mode === "average" && typeof distanceAssumptions.avgMiles === "number") {
    return distanceAssumptions.avgMiles;
  }

  // For tier_mix mode, we don't assign individual distances - handled separately
  // Return 0 as placeholder (tier distribution is computed from shares)
  return 0;
}

/**
 * Computes per-anchor results for Ship From Store Route Economics.
 * V4: Uses distance_miles from CSV or distance assumptions (no store location DB required).
 */
export function computeSfsEconomics(
  inputs: SfsCalculatorInputs,
  stops: SfsStop[],
  rateCard: SfsRateCard,
  options?: {
    densityTiers?: SfsDensityTier[];
    distanceAssumptions?: DistanceAssumptions;
  },
): SfsAnchorResult[] {
  const base_fee = rateCard.base_fee;
  const per_mile_rate = rateCard.per_mile_rate;
  const per_stop_rate = rateCard.per_stop_rate;
  const vehicle_cubic_capacity = getVehicleCubicCapacity(inputs.vehicle_type);

  const densityTiersRaw = options?.densityTiers ?? DEFAULT_DENSITY_TIERS;
  const tierValidation = validateDensityTiers(densityTiersRaw);
  const densityTiers = tierValidation.ok ? densityTiersRaw : DEFAULT_DENSITY_TIERS;

  const distanceAssumptions = options?.distanceAssumptions ?? DEFAULT_DISTANCE_ASSUMPTIONS;

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
    if (anchor_stops.length > 1) issues.push("Multiple Anchor stop rows for this anchor_id.");

    const anchor_packages = sum(anchor_stops.map((s) => s.packages));
    const satellite_packages = sum(satellite_stops.map((s) => s.packages));
    const total_packages = anchor_packages + satellite_packages;
    const total_stops = anchorStopsAll.length;

    const stops_with_distance: SfsStopWithDistance[] = anchorStopsAll.map((s) => {
      if (s.stop_type === "Anchor") {
        return {
          ...s,
          distance_to_anchor_miles: 0,
          tier_label: "Anchor",
          tier_discount_pct: 0,
          tier_sort_order: 0,
        };
      }

      const distance = getDistanceForStop(s, distanceAssumptions);
      const tier = tierForDistance(distance, densityTiers);

      return {
        ...s,
        distance_to_anchor_miles: distance,
        tier_label: formatTierLabel(tier),
        tier_discount_pct: tier.discountPct,
        tier_sort_order: tier.sortOrder,
      };
    });

    // Compute density discount based on mode
    let density: ReturnType<typeof computeDensityDiscount>;

    if (distanceAssumptions.mode === "tier_mix" && distanceAssumptions.tierMix) {
      // Tier mix mode: compute discount directly from user-provided shares
      const tierMix = distanceAssumptions.tierMix;
      const shares = [tierMix.le10, tierMix.le20, tierMix.le30, tierMix.gt30];
      const totalShare = shares.reduce((a, b) => a + b, 0);

      // Normalize shares to sum to 1
      const normalizedShares = totalShare > 0 ? shares.map((s) => s / totalShare) : [0.25, 0.25, 0.25, 0.25];

      // Build synthetic satellite distances based on tier midpoints
      const tierMidpoints = [5, 15, 25, 40]; // midpoints for each tier
      const syntheticSatellites: Array<{ packages: number; distance_to_anchor_miles: number }> = [];

      for (let i = 0; i < 4; i++) {
        const pkgsForTier = Math.round(satellite_packages * normalizedShares[i]);
        if (pkgsForTier > 0) {
          syntheticSatellites.push({
            packages: pkgsForTier,
            distance_to_anchor_miles: tierMidpoints[i],
          });
        }
      }

      density = computeDensityDiscount(syntheticSatellites, densityTiers);
    } else {
      // Per-store or average mode: use actual distances from stops
      const satelliteDistances = stops_with_distance
        .filter((s) => s.stop_type === "Satellite")
        .map((s) => ({ packages: s.packages, distance_to_anchor_miles: s.distance_to_anchor_miles }));

      density = computeDensityDiscount(satelliteDistances, densityTiers);
    }

    const total_cube = sum(
      anchorStopsAll.map((s) => {
        const cubePerPkg =
          typeof s.avg_cubic_inches_per_package === "number" && s.avg_cubic_inches_per_package > 0
            ? s.avg_cubic_inches_per_package
            : inputs.default_avg_cubic_inches_per_package;
        return s.packages * cubePerPkg;
      }),
    );

    const vehicles_by_cube = Math.max(1, ceilDiv(total_cube, vehicle_cubic_capacity));

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

    const drivers_by_time = Math.max(1, ceilDiv(total_minutes_required, inputs.max_driver_time_minutes));
    const drivers_required = Math.max(vehicles_by_cube, drivers_by_time);

    const window_feasible = pickup_overlap_minutes >= pickup_minutes_required;

    const base_portion_before_density = base_fee + per_mile_rate * inputs.miles_to_hub_or_spoke;
    const base_portion_after_density =
      base_portion_before_density * (1 - density.density_discount_pct);
    const stop_fees_total = per_stop_rate * satellite_stops.length;

    const anchor_route_cost = base_portion_after_density;

    const anchor_cpp = anchor_packages > 0 ? anchor_route_cost / anchor_packages : 0;
    const blended_cost = anchor_route_cost + stop_fees_total;
    const blended_cpp = total_packages > 0 ? blended_cost / total_packages : 0;
    const effective_density_savings_pct =
      anchor_cpp > 0 ? Math.max(0, (anchor_cpp - blended_cpp) / anchor_cpp) : 0;

    results.push({
      anchor_id,
      anchor_packages,
      satellite_packages,
      satellite_stops: satellite_stops.length,
      total_packages,
      total_stops,
      stops_with_distance,
      density_tiers: density.breakdown,
      density_discount_pct: density.density_discount_pct,
      density_discount_cap_pct: density.density_discount_cap_pct,
      base_portion_before_density,
      base_portion_after_density,
      stop_fees_total,
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
      effective_density_savings_pct,
      issues: issues.length ? issues : undefined,
      isValid: issues.length === 0,
    });
  }

  return results;
}
