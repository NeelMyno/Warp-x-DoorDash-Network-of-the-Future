import test from "node:test";
import assert from "node:assert/strict";

import { computeDensityDiscount, DEFAULT_DENSITY_TIERS, validateDensityTiers } from "../src/lib/sfs-calculator/density";
import { computeSfsEconomics } from "../src/lib/sfs-calculator/compute";
import type { SfsCalculatorInputs, SfsRateCard, SfsStop } from "../src/lib/sfs-calculator/types";
import { parseStoresUploadText, getStoresTemplateCsv } from "../src/lib/sfs-calculator/parse-stores";
import { generateErrorReportCsv, generateMissingDistanceCsv, getAffectedAnchorIdsText } from "../src/lib/sfs-calculator/error-report";
import { computeSatelliteImpacts } from "../src/lib/sfs-calculator/impact";
import { generateSalesSummaryText, makeSatelliteResultsCsv } from "../src/lib/sfs-calculator/format";
import {
  isTopMarket,
  NON_TOP_MARKET_BASE_SURCHARGE,
  canonicalizeMarket,
  normalizeMarket,
  isKnownMarket,
} from "../src/lib/sfs-calculator/markets";

function makeInputs(partial?: Partial<SfsCalculatorInputs>): SfsCalculatorInputs {
  return {
    market: "Chicago",
    vehicle_type: "Cargo Van",
    miles_to_hub_or_spoke: 10,
    avg_routing_time_per_stop_minutes: 5,
    default_service_time_minutes: 5,
    max_driver_time_minutes: 480,
    avg_speed_mph: 25,
    default_avg_cubic_inches_per_package: 1000,
    ...partial,
  };
}

const cargoVanRate: SfsRateCard = {
  id: "cargo-van",
  vehicle_type: "Cargo Van",
  base_fee: 95,
  per_mile_rate: 1.5,
  per_stop_rate: 20,
};

function makeStop(partial: Partial<SfsStop> & Pick<SfsStop, "anchor_id" | "stop_type" | "store_name">): SfsStop {
  return {
    route_id: "R-001",
    anchor_id: partial.anchor_id,
    stop_type: partial.stop_type,
    store_id: partial.store_id ?? undefined,
    store_name: partial.store_name,
    packages: partial.packages ?? 0,
    avg_cubic_inches_per_package: partial.avg_cubic_inches_per_package ?? null,
    pickup_window_start_time: partial.pickup_window_start_time ?? "08:00",
    pickup_window_end_time: partial.pickup_window_end_time ?? "12:00",
    service_time_minutes: partial.service_time_minutes ?? null,
    pickup_window_start_minutes: partial.pickup_window_start_minutes ?? 8 * 60,
    pickup_window_end_minutes: partial.pickup_window_end_minutes ?? 12 * 60,
    distance_miles: partial.distance_miles ?? null,
  };
}

test("computeDensityDiscount: weighted shares and cap at 0.05", () => {
  // Tier percentages: 5% (≤10mi), 4% (10-20mi), 3% (20-30mi), 0% (>30mi)
  const satellites = [
    { packages: 50, distance_to_anchor_miles: 5 }, // within 10 -> 5%
    { packages: 30, distance_to_anchor_miles: 15 }, // within 20 -> 4%
    { packages: 20, distance_to_anchor_miles: 25 }, // within 30 -> 3%
  ];
  const d = computeDensityDiscount(satellites, DEFAULT_DENSITY_TIERS);
  const b1 = d.breakdown.find((b) => b.sortOrder === 1)!;
  const b2 = d.breakdown.find((b) => b.sortOrder === 2)!;
  const b3 = d.breakdown.find((b) => b.sortOrder === 3)!;
  const b4 = d.breakdown.find((b) => b.sortOrder === 4)!;
  assert.equal(b1.satellitePackages, 50);
  assert.equal(b2.satellitePackages, 30);
  assert.equal(b3.satellitePackages, 20);
  assert.equal(b4.satellitePackages, 0);
  // Weighted: (50/100)*0.05 + (30/100)*0.04 + (20/100)*0.03 = 0.025 + 0.012 + 0.006 = 0.043
  assert.equal(Number(d.density_discount_pct.toFixed(3)), 0.043);

  // All satellites in ≤10mi tier -> 5% discount (capped at 5%)
  const capped = computeDensityDiscount(
    [
      { packages: 1, distance_to_anchor_miles: 1 },
      { packages: 1, distance_to_anchor_miles: 2 },
      { packages: 1, distance_to_anchor_miles: 3 },
    ],
    DEFAULT_DENSITY_TIERS,
  );
  assert.equal(capped.density_discount_pct, 0.05);
});

test("computeSfsEconomics: applies density discount only to base portion (stop fees unchanged)", () => {
  const inputs = makeInputs({ miles_to_hub_or_spoke: 10, vehicle_type: "Cargo Van" });
  const stops: SfsStop[] = [
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Anchor",
      store_name: "Chicago Anchor",
      packages: 100,
    }),
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Satellite",
      store_name: "Satellite 1",
      packages: 50,
      distance_miles: 8, // ≤10mi tier -> 5% discount
    }),
  ];

  const [r] = computeSfsEconomics(inputs, stops, cargoVanRate);
  assert.ok(r);
  // base portion: 95 + 1.5 * 10 = 110
  assert.equal(r.base_portion_before_density, 110);
  // one satellite at ≤10mi -> 5% discount
  assert.equal(r.density_discount_pct, 0.05);
  // base after discount: 110 * (1 - 0.05) = 104.5
  assert.equal(r.base_portion_after_density, 104.5);
  // stop fees should remain 20 * 1
  assert.equal(r.stop_fees_total, 20);
  assert.equal(r.anchor_route_cost, 104.5);
  assert.equal(r.blended_cost, 124.5);
});

test("computeSfsEconomics: satellite stop fees count satellites only", () => {
  const inputs = makeInputs({ miles_to_hub_or_spoke: 0 });
  const stops: SfsStop[] = [
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Anchor",
      store_name: "Chicago Anchor",
      packages: 10,
    }),
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Satellite",
      store_name: "Sat A",
      packages: 5,
      distance_miles: 8,
    }),
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Satellite",
      store_name: "Sat B",
      packages: 5,
      distance_miles: 15,
    }),
  ];

  const [r] = computeSfsEconomics(inputs, stops, cargoVanRate);
  assert.equal(r.satellite_stops, 2);
  assert.equal(r.stop_fees_total, 40);
});

test("validateDensityTiers: overlapping tiers are rejected", () => {
  const res = validateDensityTiers([
    { sortOrder: 1, minMiles: 0, maxMiles: 10, discountPct: 0.05, label: "0–10" },
    { sortOrder: 2, minMiles: 9, maxMiles: 20, discountPct: 0.04, label: "9–20" },
  ]);
  assert.equal(res.ok, false);
});

test("computeDensityDiscount: same tiers => same discount", () => {
  const satellites = [
    { packages: 10, distance_to_anchor_miles: 5 },
    { packages: 10, distance_to_anchor_miles: 15 },
    { packages: 10, distance_to_anchor_miles: 25 },
  ];
  const d1 = computeDensityDiscount(satellites, DEFAULT_DENSITY_TIERS);
  const d2 = computeDensityDiscount(
    satellites,
    DEFAULT_DENSITY_TIERS.map((t) => ({ ...t, label: null })),
  );
  assert.equal(Number(d1.density_discount_pct.toFixed(6)), Number(d2.density_discount_pct.toFixed(6)));
});

test("parseStoresUploadText: reports missing distance_miles for satellites", () => {
  const csv = [
    "route_id,anchor_id,stop_type,store_name,packages,pickup_window_start_time,pickup_window_end_time,distance_miles",
    "R-1,A-1,Anchor,Anchor Store,10,08:00,12:00,",
    "R-1,A-1,Satellite,Sat Store,5,08:30,12:00,", // missing distance_miles
  ].join("\n");

  const parsed = parseStoresUploadText(csv);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.missingDistanceErrors.length, 1);
  assert.equal(parsed.missingDistanceErrors[0]!.anchor_id, "A-1");
});

test("computeSatelliteImpacts: returns impacts with correct structure", () => {
  const inputs = makeInputs({ miles_to_hub_or_spoke: 10, vehicle_type: "Cargo Van" });
  const anchorStops: SfsStop[] = [
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Anchor",
      store_name: "Chicago Anchor",
      packages: 100,
    }),
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Satellite",
      store_name: "Satellite 1",
      packages: 50,
      distance_miles: 8, // ≤10mi tier -> 5% discount
    }),
  ];

  const { summary } = computeSatelliteImpacts({
    inputs,
    anchorId: "A-CHI-01",
    anchorStops,
    rateCard: cargoVanRate,
    densityTiers: DEFAULT_DENSITY_TIERS,
  });

  assert.equal(summary.impacts.length, 1);
  // With 5% tier discount, the stop fee ($20) exceeds the base discount savings
  // base portion: 95 + 1.5*10 = 110
  // with satellite: 5% discount => base=104.5, stop fee=20 => total=124.5
  // without satellite: base=110, stop fee=0 => total=110
  // incremental = 110 - 124.5 = -14.5 (cost increase)
  // classification = "Regular cost" when incremental <= 0
  assert.ok(typeof summary.impacts[0]!.incremental_savings === "number");
  assert.ok(["Density benefit", "Regular cost"].includes(summary.impacts[0]!.classification));
});

test("generateSalesSummaryText: includes required sections", () => {
  const inputs = makeInputs({ miles_to_hub_or_spoke: 10, vehicle_type: "Cargo Van" });
  const anchorStops: SfsStop[] = [
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Anchor",
      store_name: "Chicago Anchor",
      packages: 100,
    }),
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Satellite",
      store_name: "Satellite 1",
      packages: 50,
      distance_miles: 8,
    }),
  ];
  const [selected] = computeSfsEconomics(inputs, anchorStops, cargoVanRate, {
    densityTiers: DEFAULT_DENSITY_TIERS,
  });
  assert.ok(selected);
  const { summary } = computeSatelliteImpacts({
    inputs,
    anchorId: "A-CHI-01",
    anchorStops,
    rateCard: cargoVanRate,
    densityTiers: DEFAULT_DENSITY_TIERS,
  });

  const text = generateSalesSummaryText({ inputs, selected: selected!, summary });
  assert.ok(text.includes("SFS Density Discount Summary"));
  assert.ok(text.includes("Anchor ID: A-CHI-01"));
  assert.ok(text.includes("--- Pricing ---"));
  assert.ok(text.includes("--- Notes ---"));
  // "Top satellite impacts" section only appears if satellites have positive savings
  // With 5% tier discount, stop fee ($20) may exceed discount savings
});

test("makeSatelliteResultsCsv: includes expected headers", () => {
  const inputs = makeInputs({ miles_to_hub_or_spoke: 10, vehicle_type: "Cargo Van" });
  const anchorStops: SfsStop[] = [
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Anchor",
      store_name: "Chicago Anchor",
      packages: 100,
    }),
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Satellite",
      store_name: "Satellite 1",
      packages: 50,
      distance_miles: 8,
    }),
  ];
  const { summary } = computeSatelliteImpacts({
    inputs,
    anchorId: "A-CHI-01",
    anchorStops,
    rateCard: cargoVanRate,
    densityTiers: DEFAULT_DENSITY_TIERS,
  });
  const csv = makeSatelliteResultsCsv({ inputs, summary });
  const [header] = csv.split("\n");
  assert.equal(
    header,
    "anchor_id,market,vehicle_type,store_id,store_name,distance_mi,tier_label,packages,incremental_savings,classification",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Error report CSV generation tests
// ─────────────────────────────────────────────────────────────────────────────

test("generateErrorReportCsv produces correct CSV format", () => {
  const errors: import("../src/lib/sfs-calculator/types").SfsStoreUploadError[] = [
    { row: 2, message: "Invalid stop_type", field: "stop_type" },
    { row: 3, message: "packages must be a number", field: "packages" },
  ];
  const rows: import("../src/lib/sfs-calculator/types").SfsStoreUploadRow[] = [
    { route_id: "R1", anchor_id: "A1", stop_type: "Anchor", store_name: "Store 1", store_id: "S1", packages: 10, pickup_window_start_time: "08:00", pickup_window_end_time: "12:00", distance_miles: null },
    { route_id: "R1", anchor_id: "A1", stop_type: "Satellite", store_name: "Store 2", store_id: "S2", packages: NaN, pickup_window_start_time: "08:00", pickup_window_end_time: "12:00", distance_miles: 5 },
  ];
  const csv = generateErrorReportCsv(errors, rows);
  const lines = csv.split("\n");
  assert.equal(lines[0], "row_number,anchor_id,stop_type,field,error_message");
  assert.equal(lines[1], "2,A1,Anchor,stop_type,Invalid stop_type");
  assert.equal(lines[2], "3,A1,Satellite,packages,packages must be a number");
});

test("generateMissingDistanceCsv produces correct CSV format", () => {
  const missingErrors: import("../src/lib/sfs-calculator/parse-stores").MissingDistanceError[] = [
    { row: 3, anchor_id: "A1", store_name: "Sat Store", store_id: "S2" },
  ];
  const rows: import("../src/lib/sfs-calculator/types").SfsStoreUploadRow[] = [
    { route_id: "R1", anchor_id: "A1", stop_type: "Anchor", store_name: "Anchor Store", store_id: "S1", packages: 100, pickup_window_start_time: "08:00", pickup_window_end_time: "12:00", distance_miles: null },
    { route_id: "R1", anchor_id: "A1", stop_type: "Satellite", store_name: "Sat Store", store_id: "S2", packages: 20, pickup_window_start_time: "08:00", pickup_window_end_time: "12:00", distance_miles: null },
  ];
  const csv = generateMissingDistanceCsv(missingErrors, rows);
  const lines = csv.split("\n");
  assert.equal(lines[0], "row_number,anchor_id,stop_type,store_name,store_id,packages,pickup_window_start_time,pickup_window_end_time,distance_miles,required_fix");
  assert.ok(lines[1]?.includes("3,A1,Satellite,Sat Store,S2,20"));
  assert.ok(lines[1]?.includes("Add distance_miles"));
});

test("getAffectedAnchorIdsText returns unique anchor IDs", () => {
  const missingErrors = [
    { row: 2, anchor_id: "A1", store_name: "S1" },
    { row: 3, anchor_id: "A1", store_name: "S2" },
    { row: 4, anchor_id: "A2", store_name: "S3" },
  ];
  const text = getAffectedAnchorIdsText(missingErrors);
  assert.equal(text, "A1, A2");
});

test("template CSV includes distance_miles column with values for satellites", () => {
  const csv = getStoresTemplateCsv();
  const lines = csv.split("\n");
  const header = lines[0]!;
  assert.ok(header.includes("distance_miles"), "Header should include distance_miles");

  // Check that satellite rows have distance values
  const satelliteLines = lines.filter((l) => l.includes("Satellite"));
  assert.ok(satelliteLines.length > 0, "Should have satellite rows");
  for (const line of satelliteLines) {
    // Parse CSV with quoted values
    const parts = line.match(/"([^"]*)"/g)?.map((s) => s.replace(/^"|"$/g, "")) ?? [];
    const distanceIndex = header.split(",").indexOf("distance_miles");
    const distanceValue = parts[distanceIndex];
    assert.ok(distanceValue && !isNaN(Number(distanceValue)), `Satellite row should have numeric distance_miles: ${distanceValue}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Non-top market surcharge tests
// ─────────────────────────────────────────────────────────────────────────────

test("computeSfsEconomics: adds $30 to base fee for non-top markets", () => {
  const stops: SfsStop[] = [
    makeStop({
      anchor_id: "A-TEST-01",
      stop_type: "Anchor",
      store_name: "Test Anchor",
      packages: 100,
    }),
    makeStop({
      anchor_id: "A-TEST-01",
      stop_type: "Satellite",
      store_name: "Test Satellite",
      packages: 50,
      distance_miles: 8, // ≤10mi tier -> 5% discount
    }),
  ];

  // Top market (Chicago) - no surcharge
  const topInputs = makeInputs({ market: "Chicago", miles_to_hub_or_spoke: 10 });
  const [topResult] = computeSfsEconomics(topInputs, stops, cargoVanRate);
  assert.ok(topResult);

  // Non-top market (Cincinnati) - +$30 surcharge
  const nonTopInputs = makeInputs({ market: "Cincinnati", miles_to_hub_or_spoke: 10 });
  const [nonTopResult] = computeSfsEconomics(nonTopInputs, stops, cargoVanRate);
  assert.ok(nonTopResult);

  // Verify base portion before density is $30 higher for non-top market
  // Top: 95 + 1.5*10 = 110
  // Non-top: 95 + 30 + 1.5*10 = 140
  assert.equal(topResult.base_portion_before_density, 110);
  assert.equal(nonTopResult.base_portion_before_density, 140);
  assert.equal(
    nonTopResult.base_portion_before_density - topResult.base_portion_before_density,
    NON_TOP_MARKET_BASE_SURCHARGE,
  );

  // Verify base portion after density also increases correctly
  // Both have 5% density discount
  // Top after: 110 * 0.95 = 104.5
  // Non-top after: 140 * 0.95 = 133
  assert.equal(topResult.density_discount_pct, 0.05);
  assert.equal(nonTopResult.density_discount_pct, 0.05);
  assert.equal(topResult.base_portion_after_density, 104.5);
  assert.equal(nonTopResult.base_portion_after_density, 133);
});

test("computeSfsEconomics: market normalization (case-insensitive, trimmed)", () => {
  const stops: SfsStop[] = [
    makeStop({
      anchor_id: "A-TEST-01",
      stop_type: "Anchor",
      store_name: "Test Anchor",
      packages: 100,
    }),
  ];

  // Canonical Chicago
  const [r1] = computeSfsEconomics(makeInputs({ market: "Chicago" }), stops, cargoVanRate);
  // Lowercase
  const [r2] = computeSfsEconomics(makeInputs({ market: "chicago" }), stops, cargoVanRate);
  // With whitespace
  const [r3] = computeSfsEconomics(makeInputs({ market: " Chicago " }), stops, cargoVanRate);

  assert.ok(r1 && r2 && r3);
  // All should have same base portion (no surcharge applied)
  assert.equal(r1.base_portion_before_density, r2.base_portion_before_density);
  assert.equal(r2.base_portion_before_density, r3.base_portion_before_density);
  // base: 95 + 1.5*10 = 110 (no $30 surcharge)
  assert.equal(r1.base_portion_before_density, 110);
});

test("isTopMarket: correctly identifies top and non-top markets", () => {
  // Top markets should return true
  assert.equal(isTopMarket("Chicago"), true);
  assert.equal(isTopMarket("chicago"), true);
  assert.equal(isTopMarket(" Chicago "), true);
  assert.equal(isTopMarket("Los Angeles"), true);
  assert.equal(isTopMarket("New York"), true);
  assert.equal(isTopMarket("Washington DC"), true);

  // Non-top markets should return false
  assert.equal(isTopMarket("Cincinnati"), false);
  assert.equal(isTopMarket("San Diego"), false);
  assert.equal(isTopMarket("Boston"), false);
  assert.equal(isTopMarket("Custom City"), false);
  assert.equal(isTopMarket(""), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Canonicalization and alias tests
// ─────────────────────────────────────────────────────────────────────────────

test("canonicalizeMarket: returns canonical name for known markets", () => {
  // Exact match
  assert.equal(canonicalizeMarket("Chicago"), "Chicago");
  assert.equal(canonicalizeMarket("Los Angeles"), "Los Angeles");

  // Case-insensitive
  assert.equal(canonicalizeMarket("chicago"), "Chicago");
  assert.equal(canonicalizeMarket("LOS ANGELES"), "Los Angeles");

  // With whitespace
  assert.equal(canonicalizeMarket("  Chicago  "), "Chicago");
});

test("canonicalizeMarket: resolves aliases to canonical names", () => {
  // NYC aliases -> New York
  assert.equal(canonicalizeMarket("NYC"), "New York");
  assert.equal(canonicalizeMarket("nyc"), "New York");
  assert.equal(canonicalizeMarket("New York City"), "New York");

  // DC aliases -> Washington DC
  assert.equal(canonicalizeMarket("DC"), "Washington DC");
  assert.equal(canonicalizeMarket("Washington"), "Washington DC");
  assert.equal(canonicalizeMarket("Washington, DC"), "Washington DC");

  // LA aliases -> Los Angeles
  assert.equal(canonicalizeMarket("LA"), "Los Angeles");
  assert.equal(canonicalizeMarket("L.A."), "Los Angeles");

  // Dallas aliases
  assert.equal(canonicalizeMarket("DFW"), "Dallas");
  assert.equal(canonicalizeMarket("Dallas-Fort Worth"), "Dallas");

  // SF aliases (non-top market)
  assert.equal(canonicalizeMarket("SF"), "San Francisco");
  assert.equal(canonicalizeMarket("Bay Area"), "San Francisco");
});

test("canonicalizeMarket: returns cleaned input for unknown markets", () => {
  // Unknown market - just trim
  assert.equal(canonicalizeMarket("  Custom City  "), "Custom City");
  assert.equal(canonicalizeMarket("Some Random Place"), "Some Random Place");
});

test("isTopMarket: handles aliases correctly", () => {
  // NYC is top (alias of New York)
  assert.equal(isTopMarket("NYC"), true);
  assert.equal(isTopMarket("New York City"), true);

  // DC is top (alias of Washington DC)
  assert.equal(isTopMarket("DC"), true);
  assert.equal(isTopMarket("Washington"), true);
  assert.equal(isTopMarket("Washington, DC"), true);

  // LA is top
  assert.equal(isTopMarket("LA"), true);

  // SF is NOT top (even though it has aliases)
  assert.equal(isTopMarket("SF"), false);
  assert.equal(isTopMarket("San Francisco"), false);
  assert.equal(isTopMarket("Bay Area"), false);
});

test("isKnownMarket: identifies known vs custom markets", () => {
  // Known markets
  assert.equal(isKnownMarket("Chicago"), true);
  assert.equal(isKnownMarket("San Francisco"), true);
  assert.equal(isKnownMarket("Cincinnati"), true);

  // Known via alias
  assert.equal(isKnownMarket("NYC"), true);
  assert.equal(isKnownMarket("DC"), true);
  assert.equal(isKnownMarket("SF"), true);

  // Unknown/custom markets
  assert.equal(isKnownMarket("Custom City"), false);
  assert.equal(isKnownMarket("Random Place"), false);
});

test("normalizeMarket: handles various inputs", () => {
  // Lowercase and trim
  assert.equal(normalizeMarket("  Chicago  "), "chicago");

  // Collapse whitespace
  assert.equal(normalizeMarket("Los   Angeles"), "los angeles");

  // Strip punctuation
  assert.equal(normalizeMarket("Washington, DC"), "washington dc");
  assert.equal(normalizeMarket("L.A."), "la");
});

test("computeSfsEconomics: aliases resolve correctly for surcharge", () => {
  const stops: SfsStop[] = [
    makeStop({
      anchor_id: "A-TEST-01",
      stop_type: "Anchor",
      store_name: "Test Anchor",
      packages: 100,
    }),
  ];

  // NYC (alias for top market New York) -> no surcharge
  const [nycResult] = computeSfsEconomics(makeInputs({ market: "NYC" }), stops, cargoVanRate);
  assert.ok(nycResult);
  assert.equal(nycResult.base_portion_before_density, 110); // 95 + 1.5*10 = 110, no $30

  // SF (alias for non-top market San Francisco) -> surcharge applies
  const [sfResult] = computeSfsEconomics(makeInputs({ market: "SF" }), stops, cargoVanRate);
  assert.ok(sfResult);
  assert.equal(sfResult.base_portion_before_density, 140); // 95 + 30 + 1.5*10 = 140
});


// ─────────────────────────────────────────────────────────────────────────────
// ZIP Code Parsing Tests (for map feature)
// ─────────────────────────────────────────────────────────────────────────────

test("parseStoresUploadText: parses zip_code column correctly", () => {
  const csv = [
    "route_id,anchor_id,stop_type,store_name,packages,pickup_window_start_time,pickup_window_end_time,distance_miles,zip_code",
    "R-1,A-1,Anchor,Anchor Store,100,08:00,12:00,,60601",
    "R-1,A-1,Satellite,Sat Store 1,50,08:30,12:00,8,60611",
    "R-1,A-1,Satellite,Sat Store 2,30,09:00,12:00,15,60614-1234", // ZIP+4 format
  ].join("\n");

  const parsed = parseStoresUploadText(csv);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  assert.equal(parsed.hasAnyZipCodes, true);
  assert.equal(parsed.rows[0]?.zip_code, "60601");
  assert.equal(parsed.rows[1]?.zip_code, "60611");
  assert.equal(parsed.rows[2]?.zip_code, "60614"); // Normalized from ZIP+4
  assert.equal(parsed.zipCodeWarnings.length, 0);
});

test("parseStoresUploadText: handles missing zip_code without breaking", () => {
  const csv = [
    "route_id,anchor_id,stop_type,store_name,packages,pickup_window_start_time,pickup_window_end_time,distance_miles,zip_code",
    "R-1,A-1,Anchor,Anchor Store,100,08:00,12:00,,60601",
    "R-1,A-1,Satellite,Sat Store 1,50,08:30,12:00,8,", // missing zip
    "R-1,A-1,Satellite,Sat Store 2,30,09:00,12:00,15,60614",
  ].join("\n");

  const parsed = parseStoresUploadText(csv);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  assert.equal(parsed.hasAnyZipCodes, true);
  assert.equal(parsed.rows[1]?.zip_code, undefined); // Missing is undefined
  assert.equal(parsed.zipCodeWarnings.length, 1);
  assert.equal(parsed.zipCodeWarnings[0]?.reason, "missing");
});

test("parseStoresUploadText: warns on invalid zip_code but doesn't fail", () => {
  const csv = [
    "route_id,anchor_id,stop_type,store_name,packages,pickup_window_start_time,pickup_window_end_time,distance_miles,zip_code",
    "R-1,A-1,Anchor,Anchor Store,100,08:00,12:00,,INVALID",
    "R-1,A-1,Satellite,Sat Store 1,50,08:30,12:00,8,60611",
  ].join("\n");

  const parsed = parseStoresUploadText(csv);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  assert.equal(parsed.hasAnyZipCodes, true);
  assert.equal(parsed.rows[0]?.zip_code, undefined);
  assert.equal(parsed.zipCodeWarnings.length, 1);
  assert.equal(parsed.zipCodeWarnings[0]?.reason, "invalid");
  assert.equal(parsed.zipCodeWarnings[0]?.raw_zip, "INVALID");
});

test("parseStoresUploadText: hasAnyZipCodes is false when no zip_code column", () => {
  const csv = [
    "route_id,anchor_id,stop_type,store_name,packages,pickup_window_start_time,pickup_window_end_time,distance_miles",
    "R-1,A-1,Anchor,Anchor Store,100,08:00,12:00,",
    "R-1,A-1,Satellite,Sat Store 1,50,08:30,12:00,8",
  ].join("\n");

  const parsed = parseStoresUploadText(csv);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  assert.equal(parsed.hasAnyZipCodes, false);
  assert.equal(parsed.zipCodeWarnings.length, 0);
});

test("parseStoresUploadText: normalizes various ZIP formats correctly", () => {
  const csv = [
    "route_id,anchor_id,stop_type,store_name,packages,pickup_window_start_time,pickup_window_end_time,distance_miles,zip_code",
    "R-1,A-1,Anchor,Anchor Store,100,08:00,12:00,,60601",
    "R-1,A-1,Satellite,Sat 1,10,08:30,12:00,5,60611-1234", // ZIP+4 with dash
    "R-1,A-1,Satellite,Sat 2,10,08:30,12:00,6,60614 5678", // ZIP+4 with space
    "R-1,A-1,Satellite,Sat 3,10,08:30,12:00,7,01234", // Leading zero
  ].join("\n");

  const parsed = parseStoresUploadText(csv);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  assert.equal(parsed.rows[0]?.zip_code, "60601");
  assert.equal(parsed.rows[1]?.zip_code, "60611");
  assert.equal(parsed.rows[2]?.zip_code, "60614");
  assert.equal(parsed.rows[3]?.zip_code, "01234");
});

test("getStoresTemplateCsv: includes zip_code column", () => {
  const template = getStoresTemplateCsv();
  assert.ok(template.includes("zip_code"));
  assert.ok(template.includes("60601")); // Sample Chicago ZIP
  assert.ok(template.includes("75201")); // Sample Dallas ZIP
});

// ─────────────────────────────────────────────────────────────────────────────
// Geo module tests: normalizeZip and buildAnchorMapModel
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeZip } from "../src/lib/geo/zip";
import {
  buildAnchorMapModel,
  getUnavailableMessage,
  MAX_SATELLITES_ON_MAP,
  type MapModelReady,
} from "../src/lib/geo/map-model";

test("normalizeZip: handles 5-digit ZIPs", () => {
  assert.equal(normalizeZip("12345"), "12345");
  assert.equal(normalizeZip("00123"), "00123");
  assert.equal(normalizeZip("99999"), "99999");
});

test("normalizeZip: requires at least 5 digits", () => {
  // Short ZIPs are invalid (US ZIPs are always 5 digits)
  assert.equal(normalizeZip("123"), null);
  assert.equal(normalizeZip("1"), null);
  assert.equal(normalizeZip("1234"), null);
  // 5 digits is valid
  assert.equal(normalizeZip("01234"), "01234");
});

test("normalizeZip: handles ZIP+4 format", () => {
  assert.equal(normalizeZip("12345-6789"), "12345");
  assert.equal(normalizeZip("00123-4567"), "00123");
});

test("normalizeZip: trims whitespace", () => {
  assert.equal(normalizeZip("  12345  "), "12345");
  assert.equal(normalizeZip("\t12345\n"), "12345");
});

test("normalizeZip: returns null for invalid input", () => {
  assert.equal(normalizeZip(""), null);
  assert.equal(normalizeZip("   "), null);
  assert.equal(normalizeZip("abcde"), null);
  // 6+ digits takes first 5
  assert.equal(normalizeZip("123456"), "12345");
  // Too few digits
  assert.equal(normalizeZip("12-34"), null);
});

test("normalizeZip: handles numeric input", () => {
  assert.equal(normalizeZip(12345 as unknown as string), "12345");
  // Short numbers are invalid
  assert.equal(normalizeZip(123 as unknown as string), null);
});

test("buildAnchorMapModel: returns unavailable when no ZIPs", () => {
  const result = buildAnchorMapModel({
    anchorId: "A-001",
    anchorZip: null,
    satellites: [
      { id: "S1", name: "Sat 1", zip: null, packages: 50 },
      { id: "S2", name: "Sat 2", zip: null, packages: 30 },
    ],
    zipToLatLng: new Map(),
  });

  assert.equal(result.status, "unavailable");
  if (result.status === "unavailable") {
    assert.equal(result.reason, "no_zips_in_csv");
    assert.equal(result.coverage.totalStops, 3);
    assert.equal(result.coverage.locatedStops, 0);
  }
});

test("buildAnchorMapModel: returns unavailable when anchor ZIP missing", () => {
  const result = buildAnchorMapModel({
    anchorId: "A-001",
    anchorZip: null,
    satellites: [
      { id: "S1", name: "Sat 1", zip: "60601", packages: 50 },
    ],
    zipToLatLng: new Map([["60601", { lat: 41.88, lng: -87.63 }]]),
  });

  assert.equal(result.status, "unavailable");
  if (result.status === "unavailable") {
    assert.equal(result.reason, "anchor_zip_missing");
    assert.equal(result.coverage.anchorLocated, false);
    assert.equal(result.coverage.satellitesLocated, 1);
  }
});

test("buildAnchorMapModel: returns unavailable when anchor geocode fails", () => {
  const result = buildAnchorMapModel({
    anchorId: "A-001",
    anchorZip: "99999", // ZIP exists but not in geocode results
    satellites: [
      { id: "S1", name: "Sat 1", zip: "60601", packages: 50 },
    ],
    zipToLatLng: new Map([["60601", { lat: 41.88, lng: -87.63 }]]),
  });

  assert.equal(result.status, "unavailable");
  if (result.status === "unavailable") {
    assert.equal(result.reason, "anchor_geocode_failed");
  }
});

test("buildAnchorMapModel: returns ready when all stops located", () => {
  const result = buildAnchorMapModel({
    anchorId: "A-001",
    anchorZip: "60601",
    satellites: [
      { id: "S1", name: "Sat 1", zip: "60611", packages: 50 },
      { id: "S2", name: "Sat 2", zip: "60614", packages: 30 },
    ],
    zipToLatLng: new Map([
      ["60601", { lat: 41.88, lng: -87.63 }],
      ["60611", { lat: 41.90, lng: -87.62 }],
      ["60614", { lat: 41.92, lng: -87.65 }],
    ]),
  });

  assert.equal(result.status, "ready");
  if (result.status === "ready" || result.status === "partial") {
    assert.equal(result.anchor.zip, "60601");
    assert.equal(result.satellites.length, 2);
    assert.equal(result.lines.length, 2);
    assert.equal(result.coverage.locatedStops, 3);
    assert.equal(result.coverage.missingStops, 0);
  }
});

test("buildAnchorMapModel: returns partial when some satellites missing", () => {
  const result = buildAnchorMapModel({
    anchorId: "A-001",
    anchorZip: "60601",
    satellites: [
      { id: "S1", name: "Sat 1", zip: "60611", packages: 50 },
      { id: "S2", name: "Sat 2", zip: "99999", packages: 30 }, // Not in geocode
      { id: "S3", name: "Sat 3", zip: null, packages: 20 }, // No ZIP
    ],
    zipToLatLng: new Map([
      ["60601", { lat: 41.88, lng: -87.63 }],
      ["60611", { lat: 41.90, lng: -87.62 }],
    ]),
  });

  assert.equal(result.status, "partial");
  // Type assertion since we've verified status above
  const partialResult = result as MapModelReady;
  assert.equal(partialResult.satellites.length, 1);
  assert.equal(partialResult.coverage.locatedStops, 2); // anchor + 1 satellite
  assert.equal(partialResult.coverage.missingStops, 2);
});

test("buildAnchorMapModel: caps satellites at MAX_SATELLITES_ON_MAP", () => {
  // Create more satellites than the limit
  const satellites = Array.from({ length: MAX_SATELLITES_ON_MAP + 50 }, (_, i) => ({
    id: `S${i}`,
    name: `Sat ${i}`,
    zip: `${60000 + i}`,
    packages: 100 - i, // Descending packages
  }));

  // Create geocode results for all
  const zipToLatLng = new Map<string, { lat: number; lng: number }>();
  zipToLatLng.set("60601", { lat: 41.88, lng: -87.63 });
  for (let i = 0; i < MAX_SATELLITES_ON_MAP + 50; i++) {
    zipToLatLng.set(`${60000 + i}`, { lat: 41.88 + i * 0.01, lng: -87.63 + i * 0.01 });
  }

  const result = buildAnchorMapModel({
    anchorId: "A-001",
    anchorZip: "60601",
    satellites,
    zipToLatLng,
  });

  assert.equal(result.status, "partial");
  // Type assertion since we've verified status above
  const partialResult = result as MapModelReady;
  assert.equal(partialResult.satellites.length, MAX_SATELLITES_ON_MAP);
  assert.equal(partialResult.coverage.isCapped, true);
  assert.equal(partialResult.coverage.cappedTo, MAX_SATELLITES_ON_MAP);
});

test("getUnavailableMessage: returns correct messages", () => {
  const noZips = getUnavailableMessage("no_zips_in_csv");
  assert.ok(noZips.title.includes("unavailable"));
  assert.ok(noZips.description.includes("zip_code"));

  const anchorMissing = getUnavailableMessage("anchor_zip_missing");
  assert.ok(anchorMissing.title.toLowerCase().includes("anchor"));

  const geocodeFailed = getUnavailableMessage("anchor_geocode_failed");
  assert.ok(geocodeFailed.description.includes("coordinates"));
});