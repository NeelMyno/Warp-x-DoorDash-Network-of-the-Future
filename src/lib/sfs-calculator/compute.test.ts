/**
 * Unit tests for Ship From Store Route Economics compute function (PDF v2).
 * Run with: npx tsx src/lib/sfs-calculator/compute.test.ts
 */

import { computeSfsEconomics } from "./compute";
import type { SfsCalculatorInputs, SfsRateCard, SfsStop, StopType } from "./types";

// Test utilities
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`✓ ${message}`);
  } else {
    failed++;
    console.error(`✗ ${message}`);
  }
}

function assertApprox(actual: number, expected: number, tolerance: number, message: string) {
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    passed++;
    console.log(`✓ ${message} (${actual.toFixed(4)} ≈ ${expected.toFixed(4)})`);
  } else {
    failed++;
    console.error(`✗ ${message}: expected ${expected}, got ${actual} (diff: ${diff})`);
  }
}

// Test data (PDF v2 rating values)
const cargoVanRate: SfsRateCard = {
  id: "test-1",
  vehicle_type: "Cargo Van",
  base_fee: 95,
  per_mile_rate: 1.5,
  per_stop_rate: 20,
};

const boxTruckRate: SfsRateCard = {
  id: "test-2",
  vehicle_type: "26' Box Truck",
  base_fee: 175,
  per_mile_rate: 2.2,
  per_stop_rate: 50,
};

function makeStop(input: {
  anchorId: string;
  stopType: StopType;
  packages: number;
  startMin: number;
  endMin: number;
  avgCube?: number | null;
  service?: number | null;
}): SfsStop {
  return {
    route_id: "R1",
    anchor_id: input.anchorId,
    stop_type: input.stopType,
    store_name: input.stopType === "Anchor" ? "Anchor Store" : "Satellite Store",
    address: "1 Main St",
    city: "Chicago",
    state: "IL",
    zip: "60601",
    packages: input.packages,
    avg_cubic_inches_per_package: input.avgCube ?? null,
    pickup_window_start_time: "",
    pickup_window_end_time: "",
    service_time_minutes: input.service ?? null,
    pickup_window_start_minutes: input.startMin,
    pickup_window_end_minutes: input.endMin,
  };
}

function findResult(results: ReturnType<typeof computeSfsEconomics>, anchorId: string) {
  const hit = results.find((r) => r.anchor_id === anchorId);
  if (!hit) throw new Error(`Missing result for anchor_id=${anchorId}`);
  return hit;
}

// 1) Cube calculation with default avg cube fallback + service minutes fallback
console.log("\n=== Scenario 1: Cube + service fallback ===");
{
  const inputs: SfsCalculatorInputs = {
    market: "Chicago",
    vehicle_type: "Cargo Van",
    miles_to_hub_or_spoke: 10,
    avg_routing_time_per_stop_minutes: 5,
    default_service_time_minutes: 4,
    max_driver_time_minutes: 60,
    avg_speed_mph: 30,
    default_avg_cubic_inches_per_package: 1000,
  };

  const stops: SfsStop[] = [
    // Anchor stop: missing cube + service → should fall back to defaults
    makeStop({ anchorId: "A1", stopType: "Anchor", packages: 10, startMin: 480, endMin: 600 }),
    // Satellite stop: explicit cube + service
    makeStop({
      anchorId: "A1",
      stopType: "Satellite",
      packages: 5,
      startMin: 540,
      endMin: 660,
      avgCube: 2000,
      service: 2,
    }),
  ];

  const results = computeSfsEconomics(inputs, stops, cargoVanRate);
  const result = findResult(results, "A1");

  // Cube calculation with default avg cube fallback
  assertApprox(result.total_cube, 10 * 1000 + 5 * 2000, 0.001, "Total cube uses default + explicit avg cube");

  // Service minutes fallback
  assertApprox(result.service_minutes, 4 + 2, 0.001, "Service minutes uses default when missing");
}

// 2) Pickup overlap calculation (including no overlap case)
console.log("\n=== Scenario 2: Pickup overlap ===");
{
  const inputs: SfsCalculatorInputs = {
    market: "Chicago",
    vehicle_type: "Cargo Van",
    miles_to_hub_or_spoke: 0,
    avg_routing_time_per_stop_minutes: 1,
    default_service_time_minutes: 1,
    max_driver_time_minutes: 480,
    avg_speed_mph: 25,
    default_avg_cubic_inches_per_package: 1000,
  };

  const stops: SfsStop[] = [
    makeStop({ anchorId: "A2", stopType: "Anchor", packages: 1, startMin: 480, endMin: 540 }),
    makeStop({ anchorId: "A2", stopType: "Satellite", packages: 1, startMin: 600, endMin: 660 }),
  ];

  const results = computeSfsEconomics(inputs, stops, cargoVanRate);
  const result = findResult(results, "A2");

  assertApprox(result.pickup_overlap_minutes, 0, 0.001, "Overlap minutes clamps to 0");
  assert(result.window_feasible === false, "Window infeasible when overlap < required");
}

// 3) drivers_required = max(vehicles_by_cube, drivers_by_time)
console.log("\n=== Scenario 3: drivers_required max() ===");
{
  const baseInputs: SfsCalculatorInputs = {
    market: "Chicago",
    vehicle_type: "Cargo Van",
    miles_to_hub_or_spoke: 0,
    avg_routing_time_per_stop_minutes: 0,
    default_service_time_minutes: 0,
    max_driver_time_minutes: 60,
    avg_speed_mph: 30,
    default_avg_cubic_inches_per_package: 1000,
  };

  // Case A: cube forces 3 vehicles, time would be 0 → drivers_required should be 3
  const cubeStops: SfsStop[] = [
    makeStop({
      anchorId: "A3",
      stopType: "Anchor",
      packages: 1,
      startMin: 0,
      endMin: 1440,
      avgCube: 650000 * 3,
    }),
  ];

  const cubeResults = computeSfsEconomics(baseInputs, cubeStops, cargoVanRate);
  const cubeResult = findResult(cubeResults, "A3");
  assert(cubeResult.drivers_required === 3, "drivers_required uses vehicles_by_cube when larger");

  // Case B: time forces 2 drivers, cube is 1 → drivers_required should be 2
  const timeInputs: SfsCalculatorInputs = {
    ...baseInputs,
    miles_to_hub_or_spoke: 60, // travel = 120 mins at 30 mph
  };

  const timeStops: SfsStop[] = [
    makeStop({ anchorId: "A4", stopType: "Anchor", packages: 1, startMin: 0, endMin: 1440 }),
  ];

  const timeResults = computeSfsEconomics(timeInputs, timeStops, cargoVanRate);
  const timeResult = findResult(timeResults, "A4");
  assert(timeResult.drivers_required === 2, "drivers_required uses drivers_by_time when larger");
}

// 4) stop_cost only counts satellite stops; anchor_cpp uses anchor_packages only
console.log("\n=== Scenario 4: stop_cost + anchor_cpp denominators ===");
{
  const inputs: SfsCalculatorInputs = {
    market: "Chicago",
    vehicle_type: "Cargo Van",
    miles_to_hub_or_spoke: 10,
    avg_routing_time_per_stop_minutes: 5,
    default_service_time_minutes: 4,
    max_driver_time_minutes: 60,
    avg_speed_mph: 30,
    default_avg_cubic_inches_per_package: 1000,
  };

  const stops: SfsStop[] = [
    makeStop({ anchorId: "A5", stopType: "Anchor", packages: 10, startMin: 0, endMin: 1440 }),
    makeStop({ anchorId: "A5", stopType: "Satellite", packages: 1, startMin: 0, endMin: 1440 }),
    makeStop({ anchorId: "A5", stopType: "Satellite", packages: 1, startMin: 0, endMin: 1440 }),
  ];

  const results = computeSfsEconomics(inputs, stops, cargoVanRate);
  const result = findResult(results, "A5");

  // anchor_route_cost = 95 + 1.5*10 = 110
  assertApprox(result.anchor_route_cost, 110, 0.001, "Anchor route cost");
  // stop_cost = 20*2 satellites = 40 → blended_cost = 150
  assertApprox(result.blended_cost, 150, 0.001, "stop_cost counts satellites only");
  // anchor_cpp divides by anchor_packages only (10)
  assertApprox(result.anchor_cpp, 110 / 10, 0.0001, "anchor_cpp uses anchor_packages only");
}

// 5) Sanity: different vehicle rates apply
console.log("\n=== Scenario 5: Box truck rates apply ===");
{
  const inputs: SfsCalculatorInputs = {
    market: "Chicago",
    vehicle_type: "26' Box Truck",
    miles_to_hub_or_spoke: 10,
    avg_routing_time_per_stop_minutes: 0,
    default_service_time_minutes: 0,
    max_driver_time_minutes: 480,
    avg_speed_mph: 30,
    default_avg_cubic_inches_per_package: 1000,
  };

  const stops: SfsStop[] = [
    makeStop({ anchorId: "A6", stopType: "Anchor", packages: 10, startMin: 0, endMin: 1440 }),
    makeStop({ anchorId: "A6", stopType: "Satellite", packages: 1, startMin: 0, endMin: 1440 }),
  ];

  const results = computeSfsEconomics(inputs, stops, boxTruckRate);
  const result = findResult(results, "A6");

  // anchor_route_cost = 175 + 2.2*10 = 197
  assertApprox(result.anchor_route_cost, 197, 0.001, "Box truck anchor_route_cost");
}

// Summary
console.log("\n=== Test Summary ===");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
