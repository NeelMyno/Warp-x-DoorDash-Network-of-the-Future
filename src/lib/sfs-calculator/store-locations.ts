/**
 * Warp-owned store location dictionary (store_id -> lat/lon).
 *
 * V3 requirement: if any uploaded store_id is missing here, the calculator must hard-fail
 * and list the missing ids (no silent guessing).
 *
 * For V1, this is maintained in code; later we can move to DB.
 */

export const FALLBACK_STORE_LOCATIONS: Record<string, { lat: number; lon: number }> = {
  // Sample ids used by the template CSV (adjust/extend as Warp's dictionary grows).
  // These are intentionally spaced to fall into the 10/20/30/>30 mile bands.

  // Chicago anchor and satellites (vary latitude to create approximate mile bands).
  CHI_ANCHOR_001: { lat: 41.8781, lon: -87.6298 },
  CHI_SAT_008: { lat: 41.9901, lon: -87.6298 }, // ~8 miles
  CHI_SAT_016: { lat: 42.1101, lon: -87.6298 }, // ~16 miles
  CHI_SAT_026: { lat: 42.2601, lon: -87.6298 }, // ~26 miles
  CHI_SAT_045: { lat: 42.5301, lon: -87.6298 }, // ~45 miles

  // Dallas anchor and satellites.
  DAL_ANCHOR_001: { lat: 32.7767, lon: -96.7970 },
  DAL_SAT_009: { lat: 32.9067, lon: -96.7970 }, // ~9 miles
  DAL_SAT_018: { lat: 33.0367, lon: -96.7970 }, // ~18 miles
  DAL_SAT_028: { lat: 33.1767, lon: -96.7970 }, // ~28 miles
  DAL_SAT_050: { lat: 33.4967, lon: -96.7970 }, // ~50 miles
};

/** @deprecated Use DB-managed store locations; kept as fallback only. */
export const STORE_LOCATIONS = FALLBACK_STORE_LOCATIONS;
