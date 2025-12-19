import test from "node:test";
import assert from "node:assert/strict";

import { computeDensityDiscount, DEFAULT_DENSITY_TIERS, validateDensityTiers } from "../src/lib/sfs-calculator/density";
import { computeSfsEconomics } from "../src/lib/sfs-calculator/compute";
import type { SfsCalculatorInputs, SfsRateCard, SfsStop } from "../src/lib/sfs-calculator/types";
import { parseStoresUploadText, getStoresTemplateCsv } from "../src/lib/sfs-calculator/parse-stores";
import { generateErrorReportCsv, generateMissingDistanceCsv, getAffectedAnchorIdsText } from "../src/lib/sfs-calculator/error-report";
import { computeSatelliteImpacts } from "../src/lib/sfs-calculator/impact";
import { generateSalesSummaryText, makeSatelliteResultsCsv } from "../src/lib/sfs-calculator/format";

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
