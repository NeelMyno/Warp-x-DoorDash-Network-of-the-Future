import test from "node:test";
import assert from "node:assert/strict";

import { computeDensityDiscount, DEFAULT_DENSITY_TIERS, validateDensityTiers } from "../src/lib/sfs-calculator/density";
import { computeSfsEconomics, SfsComputeError } from "../src/lib/sfs-calculator/compute";
import type { SfsCalculatorInputs, SfsRateCard, SfsStop } from "../src/lib/sfs-calculator/types";
import { parseStoresUploadText } from "../src/lib/sfs-calculator/parse-stores";
import { FALLBACK_STORE_LOCATIONS } from "../src/lib/sfs-calculator/store-locations";
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

function makeStop(partial: Partial<SfsStop> & Pick<SfsStop, "anchor_id" | "stop_type" | "store_id" | "store_name">): SfsStop {
  return {
    route_id: "R-001",
    anchor_id: partial.anchor_id,
    stop_type: partial.stop_type,
    store_id: partial.store_id,
    store_name: partial.store_name,
    packages: partial.packages ?? 0,
    avg_cubic_inches_per_package: partial.avg_cubic_inches_per_package ?? null,
    pickup_window_start_time: partial.pickup_window_start_time ?? "08:00",
    pickup_window_end_time: partial.pickup_window_end_time ?? "12:00",
    service_time_minutes: partial.service_time_minutes ?? null,
    pickup_window_start_minutes: partial.pickup_window_start_minutes ?? 8 * 60,
    pickup_window_end_minutes: partial.pickup_window_end_minutes ?? 12 * 60,
  };
}

test("computeDensityDiscount: weighted shares and cap at 0.20", () => {
  const satellites = [
    { packages: 50, distance_to_anchor_miles: 5 }, // within 10
    { packages: 30, distance_to_anchor_miles: 15 }, // within 20
    { packages: 20, distance_to_anchor_miles: 25 }, // within 30
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
  assert.equal(Number(d.density_discount_pct.toFixed(3)), 0.148);

  const capped = computeDensityDiscount(
    [
      { packages: 1, distance_to_anchor_miles: 1 },
      { packages: 1, distance_to_anchor_miles: 2 },
      { packages: 1, distance_to_anchor_miles: 3 },
    ],
    DEFAULT_DENSITY_TIERS,
  );
  assert.equal(capped.density_discount_pct, 0.2);
});

test("computeSfsEconomics: applies density discount only to base portion (stop fees unchanged)", () => {
  const inputs = makeInputs({ miles_to_hub_or_spoke: 10, vehicle_type: "Cargo Van" });
  const stops: SfsStop[] = [
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Anchor",
      store_id: "CHI_ANCHOR_001",
      store_name: "Chicago Anchor",
      packages: 100,
    }),
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Satellite",
      store_id: "CHI_SAT_008",
      store_name: "Satellite 1",
      packages: 50,
    }),
  ];

  const [r] = computeSfsEconomics(inputs, stops, cargoVanRate);
  assert.ok(r);
  // base portion: 95 + 1.5 * 10 = 110
  assert.equal(r.base_portion_before_density, 110);
  // one satellite -> discount 20%
  assert.equal(r.density_discount_pct, 0.2);
  assert.equal(r.base_portion_after_density, 88);
  // stop fees should remain 20 * 1
  assert.equal(r.stop_fees_total, 20);
  assert.equal(r.anchor_route_cost, 88);
  assert.equal(r.blended_cost, 108);
});

test("computeSfsEconomics: satellite stop fees count satellites only", () => {
  const inputs = makeInputs({ miles_to_hub_or_spoke: 0 });
  const stops: SfsStop[] = [
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Anchor",
      store_id: "CHI_ANCHOR_001",
      store_name: "Chicago Anchor",
      packages: 10,
    }),
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Satellite",
      store_id: "CHI_SAT_008",
      store_name: "Sat A",
      packages: 5,
    }),
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Satellite",
      store_id: "CHI_SAT_016",
      store_name: "Sat B",
      packages: 5,
    }),
  ];

  const [r] = computeSfsEconomics(inputs, stops, cargoVanRate);
  assert.equal(r.satellite_stops, 2);
  assert.equal(r.stop_fees_total, 40);
});

test("computeSfsEconomics: missing store_id in store dictionary hard-fails", () => {
  const inputs = makeInputs();
  const stops: SfsStop[] = [
    makeStop({
      anchor_id: "A-1",
      stop_type: "Anchor",
      store_id: "UNKNOWN_ANCHOR",
      store_name: "Missing Anchor",
      packages: 10,
    }),
  ];

  assert.throws(
    () => computeSfsEconomics(inputs, stops, cargoVanRate),
    (err) =>
      err instanceof SfsComputeError &&
      err.missingStoreIds.includes("UNKNOWN_ANCHOR"),
  );
});

test("validateDensityTiers: overlapping tiers are rejected", () => {
  const res = validateDensityTiers([
    { sortOrder: 1, minMiles: 0, maxMiles: 10, discountPct: 0.2, label: "0–10" },
    { sortOrder: 2, minMiles: 9, maxMiles: 20, discountPct: 0.12, label: "9–20" },
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

test("parseStoresUploadText: reports missing store_ids when knownStoreIds provided", () => {
  const csv = [
    "route_id,anchor_id,stop_type,store_id,store_name,packages,pickup_window_start_time,pickup_window_end_time",
    "R-1,A-1,Anchor,KNOWN_1,Anchor,10,08:00,12:00",
    "R-1,A-1,Satellite,UNKNOWN_2,Sat,5,08:30,12:00",
  ].join("\n");

  const parsed = parseStoresUploadText(csv, { knownStoreIds: new Set(["KNOWN_1"]) });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.missingStoreIds, ["UNKNOWN_2"]);
  assert.deepEqual(parsed.affectedAnchorIds, ["A-1"]);
});

test("computeSatelliteImpacts: incremental savings is non-negative and matches expected delta", () => {
  const inputs = makeInputs({ miles_to_hub_or_spoke: 10, vehicle_type: "Cargo Van" });
  const anchorStops: SfsStop[] = [
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Anchor",
      store_id: "CHI_ANCHOR_001",
      store_name: "Chicago Anchor",
      packages: 100,
    }),
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Satellite",
      store_id: "CHI_SAT_008",
      store_name: "Satellite 1",
      packages: 50,
    }),
  ];

  const { summary } = computeSatelliteImpacts({
    inputs,
    anchorId: "A-CHI-01",
    anchorStops,
    rateCard: cargoVanRate,
    storeLocations: FALLBACK_STORE_LOCATIONS,
    densityTiers: DEFAULT_DENSITY_TIERS,
  });

  assert.equal(summary.impacts.length, 1);
  // base portion: 95 + 1.5*10 = 110
  // with one satellite at <=10mi: 20% discount => base=88, stop fee=20 => total=108
  // without satellite: base=110, stop fee=0 => total=110
  // delta = 2
  assert.equal(Number(summary.impacts[0]!.incremental_savings.toFixed(2)), 2);
  assert.equal(summary.impacts[0]!.classification, "Density benefit");
});

test("generateSalesSummaryText: includes required sections and top satellites", () => {
  const inputs = makeInputs({ miles_to_hub_or_spoke: 10, vehicle_type: "Cargo Van" });
  const anchorStops: SfsStop[] = [
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Anchor",
      store_id: "CHI_ANCHOR_001",
      store_name: "Chicago Anchor",
      packages: 100,
    }),
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Satellite",
      store_id: "CHI_SAT_008",
      store_name: "Satellite 1",
      packages: 50,
    }),
  ];
  const [selected] = computeSfsEconomics(inputs, anchorStops, cargoVanRate, {
    storeLocations: FALLBACK_STORE_LOCATIONS,
    densityTiers: DEFAULT_DENSITY_TIERS,
  });
  assert.ok(selected);
  const { summary } = computeSatelliteImpacts({
    inputs,
    anchorId: "A-CHI-01",
    anchorStops,
    rateCard: cargoVanRate,
    storeLocations: FALLBACK_STORE_LOCATIONS,
    densityTiers: DEFAULT_DENSITY_TIERS,
  });

  const text = generateSalesSummaryText({ inputs, selected: selected!, summary });
  assert.ok(text.includes("SFS Density Discount Summary"));
  assert.ok(text.includes("Anchor ID: A-CHI-01"));
  assert.ok(text.includes("--- Pricing ---"));
  assert.ok(text.includes("--- Top satellite impacts ---"));
});

test("makeSatelliteResultsCsv: includes expected headers", () => {
  const inputs = makeInputs({ miles_to_hub_or_spoke: 10, vehicle_type: "Cargo Van" });
  const anchorStops: SfsStop[] = [
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Anchor",
      store_id: "CHI_ANCHOR_001",
      store_name: "Chicago Anchor",
      packages: 100,
    }),
    makeStop({
      anchor_id: "A-CHI-01",
      stop_type: "Satellite",
      store_id: "CHI_SAT_008",
      store_name: "Satellite 1",
      packages: 50,
    }),
  ];
  const { summary } = computeSatelliteImpacts({
    inputs,
    anchorId: "A-CHI-01",
    anchorStops,
    rateCard: cargoVanRate,
    storeLocations: FALLBACK_STORE_LOCATIONS,
    densityTiers: DEFAULT_DENSITY_TIERS,
  });
  const csv = makeSatelliteResultsCsv({ inputs, summary });
  const [header] = csv.split("\n");
  assert.equal(
    header,
    "anchor_id,market,vehicle_type,store_id,store_name,distance_mi,tier_label,packages,incremental_savings,classification",
  );
});
