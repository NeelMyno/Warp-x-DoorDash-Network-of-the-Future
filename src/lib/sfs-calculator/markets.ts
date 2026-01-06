/**
 * SFS Calculator Crossdock Location Data
 * Exactly 62 fixed crossdock locations. Top 10 get standard pricing; others add +$30 base surcharge.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SfsRegion = "West" | "South" | "Midwest" | "Northeast";

export interface CrossdockLocation {
  /** Stable unique ID: "${airportCode}-${zip}-${index}" */
  id: string;
  /** Airport code (e.g., LAX, ORD) */
  airportCode: string;
  /** City name */
  city: string;
  /** 2-letter state code */
  state: string;
  /** 5-digit ZIP code */
  zip: string;
  /** Geographic region */
  region: SfsRegion;
  /** User-facing label (includes suffix if duplicated) */
  label: string;
  /** Whether this is a Top 10 quick-pick location */
  isTop10: boolean;
}

/** Base cost surcharge for non-top-10 locations */
export const NON_TOP_MARKET_BASE_SURCHARGE = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Raw crossdock data (62 locations)
// ─────────────────────────────────────────────────────────────────────────────

interface RawCrossdock {
  airportCode: string;
  city: string;
  state: string;
  zip: string;
  region: SfsRegion;
}

// Top 10 quick-pick indices (1-based from the list below)
const TOP_10_INDICES = new Set([1, 7, 18, 19, 20, 21, 27, 28, 29, 62]);

const RAW_CROSSDOCKS: RawCrossdock[] = [
  { airportCode: "LAX", city: "Los Angeles", state: "CA", zip: "90001", region: "West" },      // 1 - Top 10
  { airportCode: "TPA", city: "Tampa", state: "FL", zip: "33619", region: "South" },           // 2
  { airportCode: "SFO", city: "San Jose", state: "CA", zip: "95131", region: "West" },         // 3
  { airportCode: "SEA", city: "Auburn", state: "WA", zip: "98001", region: "West" },           // 4
  { airportCode: "SAT", city: "San Antonio", state: "TX", zip: "78218", region: "South" },     // 5
  { airportCode: "PNS", city: "Pensacola", state: "FL", zip: "32505", region: "South" },       // 6
  { airportCode: "PHX", city: "Tolleson", state: "AZ", zip: "85353", region: "West" },         // 7 - Top 10
  { airportCode: "PDX", city: "Milwaukie", state: "OR", zip: "97222", region: "West" },        // 8
  { airportCode: "ORD", city: "Bensenville", state: "IL", zip: "60106", region: "Midwest" },   // 9
  { airportCode: "OKC", city: "Oklahoma City", state: "OK", zip: "73108", region: "South" },   // 10
  { airportCode: "SJC", city: "Milpitas", state: "CA", zip: "95035", region: "West" },         // 11
  { airportCode: "MIA", city: "Miami Gardens", state: "FL", zip: "33055", region: "South" },   // 12
  { airportCode: "MCO", city: "Orlando", state: "FL", zip: "32819", region: "South" },         // 13
  { airportCode: "MCI", city: "Kansas City", state: "MO", zip: "64111", region: "Midwest" },   // 14
  { airportCode: "LAX", city: "Los Angeles", state: "CA", zip: "90021", region: "West" },      // 15
  { airportCode: "LAS", city: "Las Vegas", state: "NV", zip: "89119", region: "West" },        // 16
  { airportCode: "IND", city: "Indianapolis", state: "IN", zip: "46241", region: "Midwest" },  // 17
  { airportCode: "IAH", city: "Houston", state: "TX", zip: "77055", region: "South" },         // 18 - Top 10
  { airportCode: "MIA", city: "Miami", state: "FL", zip: "33122", region: "South" },           // 19 - Top 10
  { airportCode: "ATL", city: "Atlanta", state: "GA", zip: "30336", region: "South" },         // 20 - Top 10
  { airportCode: "EWR", city: "Linden", state: "NJ", zip: "07036", region: "Northeast" },      // 21 - Top 10
  { airportCode: "TPA", city: "Tampa", state: "FL", zip: "33610", region: "South" },           // 22
  { airportCode: "LAX", city: "Los Angeles", state: "CA", zip: "90021", region: "West" },      // 23
  { airportCode: "DTW", city: "Shelby Township", state: "MI", zip: "48315", region: "Midwest" }, // 24
  { airportCode: "LAX", city: "Santa Fe Springs", state: "CA", zip: "90670", region: "West" }, // 25
  { airportCode: "LAX", city: "Vernon", state: "CA", zip: "90058", region: "West" },           // 26
  { airportCode: "ORD", city: "Chicago", state: "IL", zip: "60632", region: "Midwest" },       // 27 - Top 10
  { airportCode: "DFW", city: "Grand Prairie", state: "TX", zip: "75050", region: "South" },   // 28 - Top 10
  { airportCode: "DCA", city: "Lorton", state: "VA", zip: "22079", region: "South" },          // 29 - Top 10
  { airportCode: "CMH", city: "Columbus", state: "OH", zip: "43228", region: "Midwest" },      // 30
  { airportCode: "CLT", city: "Charlotte", state: "NC", zip: "28273", region: "South" },       // 31
  { airportCode: "BWI", city: "Hanover", state: "MD", zip: "21076", region: "South" },         // 32
  { airportCode: "BOS", city: "Avon", state: "MA", zip: "02322", region: "Northeast" },        // 33
  { airportCode: "STL", city: "St. Louis", state: "MO", zip: "63147", region: "Midwest" },     // 34
  { airportCode: "BNA", city: "Nashville", state: "TN", zip: "37217", region: "South" },       // 35
  { airportCode: "CMH", city: "Grove City", state: "OH", zip: "43123", region: "Midwest" },    // 36
  { airportCode: "IAH", city: "Houston", state: "TX", zip: "77073", region: "South" },         // 37
  { airportCode: "SAT", city: "San Antonio", state: "TX", zip: "78218", region: "South" },     // 38
  { airportCode: "SLC", city: "Salt Lake City", state: "UT", zip: "84116", region: "West" },   // 39
  { airportCode: "BDL", city: "Hartford", state: "CT", zip: "06114", region: "Northeast" },    // 40
  { airportCode: "ATL", city: "Marietta", state: "GA", zip: "30062", region: "South" },        // 41
  { airportCode: "BWI", city: "Baltimore", state: "MD", zip: "21230", region: "South" },       // 42
  { airportCode: "ATL", city: "Tucker", state: "GA", zip: "30084", region: "South" },          // 43
  { airportCode: "MIA", city: "Miami", state: "FL", zip: "33147", region: "South" },           // 44
  { airportCode: "DFW", city: "Arlington", state: "TX", zip: "76001", region: "South" },       // 45
  { airportCode: "LAX", city: "Vernon", state: "CA", zip: "90058", region: "West" },           // 46
  { airportCode: "MFE", city: "Pharr", state: "TX", zip: "78577", region: "South" },           // 47
  { airportCode: "LRD", city: "Laredo", state: "TX", zip: "78045", region: "South" },          // 48
  { airportCode: "TYS", city: "Alcoa", state: "TN", zip: "37701", region: "South" },           // 49
  { airportCode: "MKE", city: "Milwaukee", state: "WI", zip: "53207", region: "Midwest" },     // 50
  { airportCode: "DAY", city: "Dayton", state: "OH", zip: "45414", region: "Midwest" },        // 51
  { airportCode: "CHS", city: "Ladson", state: "SC", zip: "29456", region: "South" },          // 52
  { airportCode: "CVG", city: "Erlanger", state: "KY", zip: "41018", region: "South" },        // 53
  { airportCode: "SDF", city: "Louisville", state: "KY", zip: "40214", region: "South" },      // 54
  { airportCode: "GSO", city: "Greensboro", state: "NC", zip: "27409", region: "South" },      // 55
  { airportCode: "GSP", city: "Wellford", state: "SC", zip: "29385", region: "South" },        // 56
  { airportCode: "BHM", city: "Birmingham", state: "AL", zip: "35215", region: "South" },      // 57
  { airportCode: "BNA", city: "Nashville", state: "TN", zip: "37217", region: "South" },       // 58
  { airportCode: "MEM", city: "Memphis", state: "TN", zip: "38118", region: "South" },         // 59
  { airportCode: "ELP", city: "El Paso", state: "TX", zip: "79928", region: "South" },         // 60
  { airportCode: "MSP", city: "Eagan", state: "MN", zip: "55121", region: "Midwest" },         // 61
  { airportCode: "DEN", city: "Denver", state: "CO", zip: "80221", region: "West" },           // 62 - Top 10
];

// ─────────────────────────────────────────────────────────────────────────────
// Build the 62 locations with disambiguation
// ─────────────────────────────────────────────────────────────────────────────

function buildLocations(): CrossdockLocation[] {
  // Count occurrences of each base label to detect duplicates
  const labelCounts = new Map<string, number>();
  for (const r of RAW_CROSSDOCKS) {
    const baseLabel = `${r.airportCode} — ${r.city}, ${r.state} ${r.zip}`;
    labelCounts.set(baseLabel, (labelCounts.get(baseLabel) ?? 0) + 1);
  }

  // Track which labels need suffixes and current suffix index
  const labelSuffixIndex = new Map<string, number>();

  const locations: CrossdockLocation[] = [];

  for (let i = 0; i < RAW_CROSSDOCKS.length; i++) {
    const r = RAW_CROSSDOCKS[i];
    const index = i + 1; // 1-based index
    const id = `${r.airportCode}-${r.zip}-${index}`;
    const baseLabel = `${r.airportCode} — ${r.city}, ${r.state} ${r.zip}`;
    const isTop10 = TOP_10_INDICES.has(index);

    let label = baseLabel;
    const count = labelCounts.get(baseLabel) ?? 1;
    if (count > 1) {
      const suffixIdx = (labelSuffixIndex.get(baseLabel) ?? 0) + 1;
      labelSuffixIndex.set(baseLabel, suffixIdx);
      // Convert 1 -> A, 2 -> B, etc.
      const suffix = String.fromCharCode(64 + suffixIdx);
      label = `${baseLabel} (Site ${suffix})`;
    }

    locations.push({
      id,
      airportCode: r.airportCode,
      city: r.city,
      state: r.state,
      zip: r.zip,
      region: r.region,
      label,
      isTop10,
    });
  }

  return locations;
}

/** All 62 crossdock locations */
export const SFS_ALL_62_LOCATIONS: readonly CrossdockLocation[] = buildLocations();

/** Top 10 locations for quick-pick (subset of the 62) */
export const SFS_TOP_10_LOCATIONS: readonly CrossdockLocation[] =
  SFS_ALL_62_LOCATIONS.filter((loc) => loc.isTop10);

// ─────────────────────────────────────────────────────────────────────────────
// Backward compatibility exports
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Use SFS_TOP_10_LOCATIONS instead. Kept for backward compatibility. */
export const SFS_TOP_MARKETS: readonly string[] = SFS_TOP_10_LOCATIONS.map((loc) => loc.label);

/** @deprecated Use SFS_ALL_62_LOCATIONS instead. Kept for backward compatibility. */
export const SFS_US_MARKETS: readonly string[] = SFS_ALL_62_LOCATIONS.map((loc) => loc.label);

// ─────────────────────────────────────────────────────────────────────────────
// Lookup helpers
// ─────────────────────────────────────────────────────────────────────────────

// Build lookup maps
const locationById = new Map<string, CrossdockLocation>();
const locationByLabel = new Map<string, CrossdockLocation>();
const top10IdSet = new Set<string>();

for (const loc of SFS_ALL_62_LOCATIONS) {
  locationById.set(loc.id, loc);
  locationByLabel.set(loc.label.toLowerCase(), loc);
  if (loc.isTop10) {
    top10IdSet.add(loc.id);
  }
}

/**
 * Normalize a string for searching (lowercase, trim, collapse whitespace)
 */
export function normalizeString(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * @deprecated Use normalizeString instead
 */
export function normalizeMarket(market: string): string {
  return normalizeString(market);
}

/**
 * Find a crossdock location by its stable ID
 */
export function findLocationById(id: string): CrossdockLocation | undefined {
  return locationById.get(id);
}

/**
 * Find a crossdock location by its label (case-insensitive)
 */
export function findLocationByLabel(label: string): CrossdockLocation | undefined {
  return locationByLabel.get(label.toLowerCase());
}

/**
 * Compute a search relevance score for a location against a query.
 * Higher score = more relevant.
 */
function computeSearchScore(loc: CrossdockLocation, query: string): number {
  const q = query.toLowerCase();
  let score = 0;

  // Exact airport code match (highest priority)
  if (loc.airportCode.toLowerCase() === q) {
    score += 1000;
  } else if (loc.airportCode.toLowerCase().startsWith(q)) {
    score += 500;
  }

  // ZIP prefix match
  if (loc.zip.startsWith(q)) {
    score += 400;
  } else if (loc.zip.includes(q)) {
    score += 200;
  }

  // City match
  const cityLower = loc.city.toLowerCase();
  if (cityLower === q) {
    score += 350;
  } else if (cityLower.startsWith(q)) {
    score += 300;
  } else if (cityLower.includes(q)) {
    score += 150;
  }

  // State match
  if (loc.state.toLowerCase() === q) {
    score += 250;
  }

  // Region match
  if (loc.region.toLowerCase().includes(q)) {
    score += 50;
  }

  // General label match (fallback)
  if (score === 0 && loc.label.toLowerCase().includes(q)) {
    score += 10;
  }

  // Boost Top 10 locations slightly for ties
  if (loc.isTop10) {
    score += 1;
  }

  return score;
}

/**
 * Search crossdock locations by query string with smart ranking.
 * Matches against airportCode, city, state, zip, region, and label.
 * Results are sorted by relevance score (highest first).
 */
export function searchLocations(query: string): CrossdockLocation[] {
  const q = normalizeString(query);
  if (!q) return [...SFS_ALL_62_LOCATIONS];

  // Score all locations
  const scored = SFS_ALL_62_LOCATIONS.map((loc) => ({
    loc,
    score: computeSearchScore(loc, q),
  }));

  // Filter to only matches (score > 0) and sort by score descending
  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ loc }) => loc);
}

/**
 * Get a display-friendly short label for a location.
 * Format: "AIRPORT — City, ST"
 */
export function getDisplayLabel(loc: CrossdockLocation): string {
  return `${loc.airportCode} — ${loc.city}, ${loc.state}`;
}

/**
 * Get a display-friendly secondary line for a location.
 * Format: "ZIP • Region"
 */
export function getDisplaySecondary(loc: CrossdockLocation): string {
  return `${loc.zip} • ${loc.region}`;
}

/**
 * Check if a location ID is in the Top 10
 */
export function isTop10Location(id: string): boolean {
  return top10IdSet.has(id);
}

/**
 * @deprecated Use isTop10Location(id) instead. This version tries to match by label for backward compatibility.
 */
export function isTopMarket(marketOrId: string): boolean {
  // First try as ID
  if (top10IdSet.has(marketOrId)) return true;

  // Try as label (backward compatibility)
  const byLabel = findLocationByLabel(marketOrId);
  if (byLabel) return byLabel.isTop10;

  return false;
}

/**
 * @deprecated Use findLocationById instead
 */
export function canonicalizeMarket(input: string): string {
  // Try as ID first
  const byId = findLocationById(input);
  if (byId) return byId.id;

  // Try as label
  const byLabel = findLocationByLabel(input);
  if (byLabel) return byLabel.id;

  // Unknown - return input as-is (will be treated as invalid)
  return input;
}

/**
 * @deprecated Use findLocationById !== undefined instead
 */
export function isKnownMarket(idOrLabel: string): boolean {
  return findLocationById(idOrLabel) !== undefined || findLocationByLabel(idOrLabel) !== undefined;
}

/**
 * Get the default market ID (first Top 10 location)
 */
export function getDefaultMarketId(): string {
  return SFS_TOP_10_LOCATIONS[0]?.id ?? SFS_ALL_62_LOCATIONS[0]?.id ?? "";
}

