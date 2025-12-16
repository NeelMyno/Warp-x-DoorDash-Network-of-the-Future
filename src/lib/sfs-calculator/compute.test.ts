/**
 * Unit tests for SFS Route Economics Calculator compute function.
 * Run with: npx tsx src/lib/sfs-calculator/compute.test.ts
 */

import { computeSfsEconomics } from "./compute";
import { formatCurrency, formatPercent, formatNumber } from "./format";
import type { SfsCalculatorInputs, SfsRateCard } from "./types";

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

// Test data
const chicagoCargoVan: SfsRateCard = {
  id: "test-1",
  market: "Chicago",
  vehicle_type: "Cargo Van",
  base_cost: 0,
  cost_per_mile: 0.85,
  stop_fee: 0,
  driver_cost: 315,
};

const chicagoBoxTruck: SfsRateCard = {
  id: "test-2",
  market: "Chicago",
  vehicle_type: "Box Truck",
  base_cost: 0,
  cost_per_mile: 1.40,
  stop_fee: 0,
  driver_cost: 450,
};

// Scenario 1: Basic Cargo Van calculation with density eligible
console.log("\n=== Scenario 1: Cargo Van, Density Eligible ===");
{
  const inputs: SfsCalculatorInputs = {
    market: "Chicago",
    vehicle_type: "Cargo Van",
    anchor_packages: 500,
    anchor_stops: 100,
    avg_cubic_inches_per_package: 400,
    pickup_route_miles: 50,
    satellite_extra_miles: 10,
    miles_to_hub_or_spoke: 20,
    max_driver_time_minutes: 480,
    avg_routing_time_per_stop: 3,
    pickup_window_minutes: 90, // <= 120, eligible
    satellite_packages: 80, // <= 100, eligible
    satellite_stores: 4, // 4 stores, 10 extra miles = 2.5 mi/store <= 5, eligible
    max_satellite_miles_allowed: 5,
    max_satellite_packages_allowed: 100,
  };

  const result = computeSfsEconomics(inputs, chicagoCargoVan);

  // Verify cubic capacity for Cargo Van = 260000
  assert(result.cubic_capacity === 260000, "Cargo Van cubic capacity is 260000");

  // Verify density eligibility
  assert(result.density_eligible === true, "Should be density eligible");

  // Verify total packages = anchor + satellite
  assert(result.total_packages === 580, "Total packages = 500 + 80 = 580");

  // Verify total stops = anchor_stops + satellite_stores
  assert(result.total_stops === 104, "Total stops = 100 + 4 = 104");

  // Verify drivers calculation
  // drivers_by_volume = ceil(500 * 400 / 260000) = ceil(0.769) = 1
  // drivers_by_time = ceil((100 * 3 + 50 + 10 + 20) / 480) = ceil(380/480) = 1
  assert(result.drivers_required >= 1, "At least 1 driver required");

  // Verify anchor route cost = drivers * driver_cost + total_miles * cost_per_mile
  // total_miles = 50 + 10 + 20 = 80
  // anchor_route_cost = 1 * 315 + 80 * 0.85 = 315 + 68 = 383
  assertApprox(result.anchor_route_cost, 383, 1, "Anchor route cost calculation");

  // Verify anchor CPP = anchor_route_cost / anchor_packages
  assertApprox(result.anchor_cpp, 383 / 500, 0.01, "Anchor CPP calculation");

  // Verify blended CPP is lower than anchor CPP (satellite adds packages at marginal cost)
  assert(result.blended_cpp < result.anchor_cpp, "Blended CPP should be lower than anchor CPP");

  // Verify savings are positive
  assert(result.savings_absolute > 0, "Savings should be positive");
  assert(result.savings_percent > 0, "Savings percent should be positive");
}

// Scenario 2: Box Truck, NOT density eligible (pickup window too long)
console.log("\n=== Scenario 2: Box Truck, NOT Density Eligible ===");
{
  const inputs: SfsCalculatorInputs = {
    market: "Chicago",
    vehicle_type: "Box Truck",
    anchor_packages: 1000,
    anchor_stops: 200,
    avg_cubic_inches_per_package: 400,
    pickup_route_miles: 80,
    satellite_extra_miles: 15,
    miles_to_hub_or_spoke: 30,
    max_driver_time_minutes: 480,
    avg_routing_time_per_stop: 3,
    pickup_window_minutes: 150, // > 120, NOT eligible
    satellite_packages: 100,
    satellite_stores: 5,
    max_satellite_miles_allowed: 5,
    max_satellite_packages_allowed: 100,
  };

  const result = computeSfsEconomics(inputs, chicagoBoxTruck);

  // Verify cubic capacity for Box Truck = 520000
  assert(result.cubic_capacity === 520000, "Box Truck cubic capacity is 520000");

  // Verify NOT density eligible (pickup window > 120)
  assert(result.density_eligible === false, "Should NOT be density eligible (pickup window > 120)");

  // Verify total packages still calculated
  assert(result.total_packages === 1100, "Total packages = 1000 + 100 = 1100");

  // Verify Box Truck uses higher cost per mile
  // total_miles = 80 + 15 + 30 = 125
  // With Box Truck at $1.40/mile vs Cargo Van at $0.85/mile
  assertApprox(result.total_route_miles, 125, 0.1, "Total route miles");
  assertApprox(result.distance_cost, 125 * 1.40, 0.1, "Distance cost at $1.40/mile");

  // Verify driver cost is higher for Box Truck ($450 vs $315)
  assert(result.anchor_route_cost > 0, "Anchor route cost should be positive");
}

// Scenario 3: Edge case - zero satellite stores (anchor only)
console.log("\n=== Scenario 3: Zero Satellite Stores ===");
{
  const inputs: SfsCalculatorInputs = {
    market: "Chicago",
    vehicle_type: "Cargo Van",
    anchor_packages: 200,
    anchor_stops: 40,
    avg_cubic_inches_per_package: 500,
    pickup_route_miles: 25,
    satellite_extra_miles: 0,
    miles_to_hub_or_spoke: 15,
    max_driver_time_minutes: 480,
    avg_routing_time_per_stop: 4,
    pickup_window_minutes: 60,
    satellite_packages: 0,
    satellite_stores: 0,
    max_satellite_miles_allowed: 5,
    max_satellite_packages_allowed: 100,
  };

  const result = computeSfsEconomics(inputs, chicagoCargoVan);

  // Should not throw
  assert(!isNaN(result.anchor_cpp), "No NaN on anchor CPP with zero satellites");
  assert(!isNaN(result.blended_cpp), "No NaN on blended CPP with zero satellites");
  assert(result.total_packages === 200, "Total packages = anchor only");
  assert(result.total_stops === 40, "Total stops = anchor only");
  // satellite_cpp should be null when no satellite packages
  assert(result.satellite_cpp === null, "Satellite CPP is null when no satellites");
}

// Scenario 4: Edge case - pickup window at threshold boundary (exactly 120)
console.log("\n=== Scenario 4: Pickup Window at Boundary (120 min) ===");
{
  const inputs: SfsCalculatorInputs = {
    market: "Chicago",
    vehicle_type: "Cargo Van",
    anchor_packages: 300,
    anchor_stops: 60,
    avg_cubic_inches_per_package: 400,
    pickup_route_miles: 30,
    satellite_extra_miles: 5,
    miles_to_hub_or_spoke: 10,
    max_driver_time_minutes: 480,
    avg_routing_time_per_stop: 3,
    pickup_window_minutes: 120, // exactly at threshold
    satellite_packages: 50,
    satellite_stores: 3,
    max_satellite_miles_allowed: 10,
    max_satellite_packages_allowed: 100,
  };

  const result = computeSfsEconomics(inputs, chicagoCargoVan);

  // At exactly 120, should still be eligible (condition is <= 120)
  assert(result.density_eligible === true, "Eligible at exactly 120 min pickup window");
}

// Scenario 5: Edge case - very large numbers (stress test)
console.log("\n=== Scenario 5: Large Numbers ===");
{
  const inputs: SfsCalculatorInputs = {
    market: "Chicago",
    vehicle_type: "Box Truck",
    anchor_packages: 100000,
    anchor_stops: 5000,
    avg_cubic_inches_per_package: 200,
    pickup_route_miles: 500,
    satellite_extra_miles: 100,
    miles_to_hub_or_spoke: 50,
    max_driver_time_minutes: 720,
    avg_routing_time_per_stop: 2,
    pickup_window_minutes: 90,
    satellite_packages: 20000,
    satellite_stores: 100,
    max_satellite_miles_allowed: 10,
    max_satellite_packages_allowed: 50000,
  };

  const result = computeSfsEconomics(inputs, chicagoBoxTruck);

  // Should not produce Infinity
  assert(isFinite(result.anchor_cpp), "No Infinity on anchor CPP with large numbers");
  assert(isFinite(result.blended_cpp), "No Infinity on blended CPP with large numbers");
  assert(isFinite(result.total_cost), "No Infinity on total cost");
  assert(result.drivers_required > 0, "Positive drivers required");
}

// Scenario 6: Formatting utilities
console.log("\n=== Scenario 6: Format Functions ===");
{
  assert(formatCurrency(123.456) === "$123.46", "Currency formatting rounds to 2 decimals");
  assert(formatPercent(0.1234) === "12.3%", "Percent formatting with 1 decimal");
  assert(formatNumber(1234567) === "1,234,567", "Number formatting with commas");
  assert(formatNumber(3.14159, 2) === "3.14", "Number formatting with decimals");
}

// Summary
console.log("\n=== Test Summary ===");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}

