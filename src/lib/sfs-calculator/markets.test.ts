/**
 * Unit tests for market data and helpers.
 * Run with: npx tsx src/lib/sfs-calculator/markets.test.ts
 */

import {
  SFS_TOP_MARKETS,
  SFS_US_MARKETS,
  isTopMarket,
  isKnownMarket,
  normalizeMarket,
  canonicalizeMarket,
  getDefaultMarket,
  searchMarkets,
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
// Market list data tests
// ─────────────────────────────────────────────────────────────────────────────

assert(SFS_TOP_MARKETS.length === 10, "Exactly 10 Top markets");
assert(SFS_US_MARKETS.length > 100, "More than 100 total US markets");

// Verify all top 10 are in US markets
const usMarketsSet = new Set(SFS_US_MARKETS);
const allTopInUs = SFS_TOP_MARKETS.every((m) => usMarketsSet.has(m));
assert(allTopInUs, "All Top 10 markets are in US markets list");

// Verify expected Top 10 markets
const expectedTop10 = [
  "Chicago",
  "Atlanta",
  "Dallas",
  "Denver",
  "Houston",
  "Los Angeles",
  "Miami",
  "New York",
  "Phoenix",
  "Washington DC",
];

for (const market of expectedTop10) {
  assert(SFS_TOP_MARKETS.includes(market), `Top 10 includes "${market}"`);
}

// ─────────────────────────────────────────────────────────────────────────────
// isTopMarket tests
// ─────────────────────────────────────────────────────────────────────────────

// Top markets (exact match)
assert(isTopMarket("Chicago") === true, "Chicago is Top 10");
assert(isTopMarket("Atlanta") === true, "Atlanta is Top 10");
assert(isTopMarket("Los Angeles") === true, "Los Angeles is Top 10");

// Top markets (aliases)
assert(isTopMarket("NYC") === true, "NYC (alias) is Top 10");
assert(isTopMarket("LA") === true, "LA (alias) is Top 10");
assert(isTopMarket("DC") === true, "DC (alias) is Top 10");
assert(isTopMarket("DFW") === true, "DFW (alias for Dallas) is Top 10");

// Non-top markets
assert(isTopMarket("Cincinnati") === false, "Cincinnati is NOT Top 10");
assert(isTopMarket("Tampa") === false, "Tampa is NOT Top 10");
assert(isTopMarket("Seattle") === false, "Seattle is NOT Top 10");
assert(isTopMarket("San Francisco") === false, "San Francisco is NOT Top 10");

// Unknown markets
assert(isTopMarket("My Custom City") === false, "Unknown market is NOT Top 10");
assert(isTopMarket("Nowhere Town") === false, "Unknown market is NOT Top 10");

// ─────────────────────────────────────────────────────────────────────────────
// Normalization tests
// ─────────────────────────────────────────────────────────────────────────────

// Case insensitivity
assert(isTopMarket("chicago") === true, "lowercase 'chicago' is Top 10");
assert(isTopMarket("CHICAGO") === true, "uppercase 'CHICAGO' is Top 10");
assert(isTopMarket("ChIcAgO") === true, "mixed case 'ChIcAgO' is Top 10");

// Whitespace handling
assert(isTopMarket(" Chicago ") === true, "' Chicago ' (with spaces) is Top 10");
assert(isTopMarket("  Chicago  ") === true, "'  Chicago  ' (multiple spaces) is Top 10");

// normalizeMarket function
assert(normalizeMarket("  Chicago  ") === "chicago", "normalizeMarket trims and lowercases");
assert(normalizeMarket("Los Angeles") === "los angeles", "normalizeMarket preserves internal spaces");
assert(normalizeMarket("Washington, DC") === "washington dc", "normalizeMarket removes commas");

// ─────────────────────────────────────────────────────────────────────────────
// isKnownMarket tests
// ─────────────────────────────────────────────────────────────────────────────

assert(isKnownMarket("Chicago") === true, "Chicago is known");
assert(isKnownMarket("Cincinnati") === true, "Cincinnati is known");
assert(isKnownMarket("Tampa") === true, "Tampa is known");
assert(isKnownMarket("My Custom City") === false, "Custom city is NOT known");

// ─────────────────────────────────────────────────────────────────────────────
// canonicalizeMarket tests
// ─────────────────────────────────────────────────────────────────────────────

assert(canonicalizeMarket("chicago") === "Chicago", "canonicalizes 'chicago' to 'Chicago'");
assert(canonicalizeMarket("NYC") === "New York", "canonicalizes 'NYC' alias to 'New York'");
assert(canonicalizeMarket("LA") === "Los Angeles", "canonicalizes 'LA' alias to 'Los Angeles'");
assert(canonicalizeMarket("Bay Area") === "San Francisco", "canonicalizes 'Bay Area' alias to 'San Francisco'");
assert(canonicalizeMarket("Unknown Place") === "Unknown Place", "unknown returns trimmed input");

// ─────────────────────────────────────────────────────────────────────────────
// searchMarkets tests
// ─────────────────────────────────────────────────────────────────────────────

const chicagoSearch = searchMarkets("Chicago");
assert(chicagoSearch.length >= 1, "Search 'Chicago' returns at least 1 result");
assert(chicagoSearch.includes("Chicago"), "Search 'Chicago' includes Chicago");

const denSearch = searchMarkets("Den");
assert(denSearch.length >= 1, "Search 'Den' returns results");
assert(denSearch.includes("Denver"), "Search 'Den' includes Denver");

const emptySearch = searchMarkets("");
assert(emptySearch.length === SFS_US_MARKETS.length, "Empty search returns all markets");

// Alias search
const nycSearch = searchMarkets("NYC");
assert(nycSearch.includes("New York"), "Search 'NYC' includes New York");

const sfSearch = searchMarkets("SF");
assert(sfSearch.includes("San Francisco"), "Search 'SF' includes San Francisco");

// ─────────────────────────────────────────────────────────────────────────────
// getDefaultMarket tests
// ─────────────────────────────────────────────────────────────────────────────

const defaultMarket = getDefaultMarket();
assert(defaultMarket !== "", "getDefaultMarket returns non-empty string");
assert(isTopMarket(defaultMarket), "Default market is a Top 10 market");
assert(defaultMarket === "Chicago", "Default market is Chicago");

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

