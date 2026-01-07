/**
 * SFS Calculator Market Data
 * Top 10 markets get standard pricing; all other markets add +$30 base surcharge.
 */

import marketsData from "./markets_us.json";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketOption {
  name: string;
  aliases?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw data from JSON
// ─────────────────────────────────────────────────────────────────────────────

const TOP_MARKETS_DATA: MarketOption[] = marketsData.topMarkets as MarketOption[];
const ALL_MARKETS_DATA: MarketOption[] = marketsData.allMarkets as MarketOption[];

// ─────────────────────────────────────────────────────────────────────────────
// Exported market lists
// ─────────────────────────────────────────────────────────────────────────────

/** Top 10 markets (quick-select, no surcharge) */
export const SFS_TOP_MARKETS: readonly string[] = TOP_MARKETS_DATA.map((m) => m.name);

export type SfsTopMarket = (typeof SFS_TOP_MARKETS)[number];

/** All markets including top markets, sorted alphabetically */
export const SFS_US_MARKETS: readonly string[] = [
  ...SFS_TOP_MARKETS,
  ...ALL_MARKETS_DATA.map((m) => m.name),
].sort((a, b) => a.localeCompare(b));

/** Market options with aliases for UI components */
export const SFS_TOP_MARKET_OPTIONS: readonly MarketOption[] = TOP_MARKETS_DATA;
export const SFS_ALL_MARKET_OPTIONS: readonly MarketOption[] = ALL_MARKETS_DATA;

// ─────────────────────────────────────────────────────────────────────────────
// Normalization & Canonicalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize market string for comparison:
 * lowercase, trim, collapse whitespace, strip common punctuation
 */
export function normalizeMarket(market: string): string {
  return market
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, "") // Remove periods and commas
    .replace(/\s+/g, " "); // Collapse whitespace
}

// Build lookup maps: normalized alias/name -> canonical name
const aliasToCanonical = new Map<string, string>();
const topMarketsCanonicalSet = new Set<string>();

function registerMarket(m: MarketOption, isTop: boolean) {
  const canonical = m.name;
  const normalizedName = normalizeMarket(canonical);

  aliasToCanonical.set(normalizedName, canonical);
  if (isTop) topMarketsCanonicalSet.add(canonical);

  if (m.aliases) {
    for (const alias of m.aliases) {
      aliasToCanonical.set(normalizeMarket(alias), canonical);
    }
  }
}

// Register all markets
for (const m of TOP_MARKETS_DATA) registerMarket(m, true);
for (const m of ALL_MARKETS_DATA) registerMarket(m, false);

/**
 * Canonicalize a market name:
 * - If input matches a canonical name or any alias (normalized), return the canonical name.
 * - Otherwise return a cleaned, title-cased version of user input.
 */
export function canonicalizeMarket(input: string): string {
  const normalized = normalizeMarket(input);
  if (!normalized) return "";

  const canonical = aliasToCanonical.get(normalized);
  if (canonical) return canonical;

  // Not found - return cleaned input with preserved casing (trimmed)
  return input.trim();
}

/**
 * Check if a market is in the top 10 (uses canonicalization for alias support)
 */
export function isTopMarket(market: string): boolean {
  const canonical = canonicalizeMarket(market);
  return topMarketsCanonicalSet.has(canonical);
}

/**
 * Check if a market exists in our known market list (top or all)
 */
export function isKnownMarket(market: string): boolean {
  const normalized = normalizeMarket(market);
  return aliasToCanonical.has(normalized);
}

/** Base cost surcharge for non-top markets */
export const NON_TOP_MARKET_BASE_SURCHARGE = 30;

/**
 * Get the default market name (first Top 10 market - Chicago)
 */
export function getDefaultMarket(): string {
  return SFS_TOP_MARKETS[0] ?? "Chicago";
}

/**
 * Search markets by query string with smart matching.
 * Returns markets that match the query (name or alias).
 * Results are sorted: Top 10 first, then alphabetically.
 */
export function searchMarkets(query: string): string[] {
  const q = normalizeMarket(query);
  if (!q) return [...SFS_US_MARKETS];

  const matches: { market: string; isTop: boolean; score: number }[] = [];

  // Check all markets (Top 10 + All)
  const allMarketOptions = [...TOP_MARKETS_DATA, ...ALL_MARKETS_DATA];

  for (const m of allMarketOptions) {
    const isTop = topMarketsCanonicalSet.has(m.name);
    const nameLower = m.name.toLowerCase();
    let score = 0;

    // Exact match
    if (nameLower === q) {
      score = 1000;
    }
    // Starts with query
    else if (nameLower.startsWith(q)) {
      score = 500;
    }
    // Contains query
    else if (nameLower.includes(q)) {
      score = 100;
    }
    // Check aliases
    else if (m.aliases) {
      for (const alias of m.aliases) {
        const aliasLower = alias.toLowerCase();
        if (aliasLower === q) {
          score = 800;
          break;
        } else if (aliasLower.startsWith(q)) {
          score = 400;
          break;
        } else if (aliasLower.includes(q)) {
          score = 80;
        }
      }
    }

    if (score > 0) {
      // Boost Top 10 markets
      if (isTop) score += 50;
      matches.push({ market: m.name, isTop, score });
    }
  }

  // Sort by score (descending), then alphabetically
  return matches
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.market.localeCompare(b.market);
    })
    .map((m) => m.market);
}

