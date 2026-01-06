/**
 * Unit tests for crossdock location data and helpers.
 * Run with: npx tsx src/lib/sfs-calculator/markets.test.ts
 */

import {
  SFS_ALL_62_LOCATIONS,
  SFS_TOP_10_LOCATIONS,
  findLocationById,
  searchLocations,
  isTop10Location,
  getDefaultMarketId,
  NON_TOP_MARKET_BASE_SURCHARGE,
} from "./markets";

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

// ─────────────────────────────────────────────────────────────────────────────
// Location data tests
// ─────────────────────────────────────────────────────────────────────────────

assert(SFS_ALL_62_LOCATIONS.length === 62, "Exactly 62 crossdock locations");
assert(SFS_TOP_10_LOCATIONS.length === 10, "Exactly 10 top locations");

// Verify all top 10 are in the 62
const allIds = new Set(SFS_ALL_62_LOCATIONS.map((loc) => loc.id));
const allTop10InAll = SFS_TOP_10_LOCATIONS.every((loc) => allIds.has(loc.id));
assert(allTop10InAll, "All Top 10 locations are in the 62");

// Verify unique IDs
const uniqueIds = new Set(SFS_ALL_62_LOCATIONS.map((loc) => loc.id));
assert(uniqueIds.size === 62, "All 62 IDs are unique");

// Verify duplicate labels have suffixes
const labelsWithSite = SFS_ALL_62_LOCATIONS.filter((loc) => loc.label.includes("(Site"));
assert(labelsWithSite.length > 0, "Duplicate locations have site suffixes");

// ─────────────────────────────────────────────────────────────────────────────
// Top 10 verification (specific indices from spec)
// ─────────────────────────────────────────────────────────────────────────────

const expectedTop10 = [
  { index: 1, city: "Los Angeles", airportCode: "LAX" },      // LA
  { index: 7, city: "Tolleson", airportCode: "PHX" },         // Phoenix
  { index: 18, city: "Houston", airportCode: "IAH" },         // Houston
  { index: 19, city: "Miami", airportCode: "MIA" },           // Miami
  { index: 20, city: "Atlanta", airportCode: "ATL" },         // Atlanta
  { index: 21, city: "Linden", airportCode: "EWR" },          // NYC metro
  { index: 27, city: "Chicago", airportCode: "ORD" },         // Chicago
  { index: 28, city: "Grand Prairie", airportCode: "DFW" },   // Dallas
  { index: 29, city: "Lorton", airportCode: "DCA" },          // DC metro
  { index: 62, city: "Denver", airportCode: "DEN" },          // Denver
];

for (const expected of expectedTop10) {
  const loc = SFS_ALL_62_LOCATIONS[expected.index - 1];
  assert(
    loc?.isTop10 === true,
    `Index ${expected.index} (${expected.city}) is flagged as Top 10`
  );
  assert(
    loc?.city === expected.city,
    `Index ${expected.index} city is ${expected.city}`
  );
  assert(
    loc?.airportCode === expected.airportCode,
    `Index ${expected.index} airport is ${expected.airportCode}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper function tests
// ─────────────────────────────────────────────────────────────────────────────

// findLocationById
const laxLoc = findLocationById("LAX-90001-1");
assert(laxLoc !== undefined, "findLocationById returns LAX-90001-1");
assert(laxLoc?.city === "Los Angeles", "LAX location has correct city");

const unknownLoc = findLocationById("UNKNOWN-12345-99");
assert(unknownLoc === undefined, "findLocationById returns undefined for unknown ID");

// isTop10Location
assert(isTop10Location("LAX-90001-1") === true, "LAX-90001-1 is Top 10");
assert(isTop10Location("ORD-60632-27") === true, "ORD-60632-27 (Chicago) is Top 10");
assert(isTop10Location("TPA-33619-2") === false, "TPA-33619-2 (Tampa) is NOT Top 10");
assert(isTop10Location("UNKNOWN") === false, "Unknown ID is NOT Top 10");

// searchLocations - basic functionality
const chicagoResults = searchLocations("Chicago");
assert(chicagoResults.length >= 1, "Search 'Chicago' returns at least 1 result");
assert(
  chicagoResults.some((loc) => loc.city === "Chicago"),
  "Search 'Chicago' includes Chicago location"
);

const ordResults = searchLocations("ORD");
assert(ordResults.length >= 2, "Search 'ORD' returns at least 2 results");

const zipResults = searchLocations("90001");
assert(zipResults.length >= 1, "Search by ZIP returns results");

const emptySearch = searchLocations("");
assert(emptySearch.length === 62, "Empty search returns all 62 locations");

// searchLocations - smart ranking/scoring
const atlResults = searchLocations("ATL");
assert(atlResults.length >= 1, "Search 'ATL' returns results");
assert(atlResults[0].airportCode === "ATL", "Exact airport code match ranks first");

const atResults = searchLocations("AT");
assert(atResults.length >= 1, "Search 'AT' returns results");
assert(
  atResults.some((loc) => loc.airportCode === "ATL"),
  "Prefix 'AT' includes ATL"
);

const zip90Results = searchLocations("900");
assert(zip90Results.length >= 1, "Search '900' (ZIP prefix) returns results");
assert(
  zip90Results.some((loc) => loc.zip.startsWith("900")),
  "ZIP prefix search finds matching ZIPs"
);

const westResults = searchLocations("West");
assert(westResults.length >= 1, "Search 'West' (region) returns results");
assert(
  westResults.some((loc) => loc.region === "West"),
  "Region search includes West region locations"
);

const caseInsensitiveResults = searchLocations("CHICAGO");
assert(
  caseInsensitiveResults.length === chicagoResults.length,
  "Search is case-insensitive"
);

// getDefaultMarketId
const defaultId = getDefaultMarketId();
assert(defaultId !== "", "getDefaultMarketId returns a non-empty string");
assert(isTop10Location(defaultId), "Default market ID is a Top 10 location");

// ─────────────────────────────────────────────────────────────────────────────
// Surcharge constant
// ─────────────────────────────────────────────────────────────────────────────

assert(NON_TOP_MARKET_BASE_SURCHARGE === 30, "Surcharge constant is $30");

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  throw new Error(`Market tests failed: ${failed} failed, ${passed} passed`);
}

