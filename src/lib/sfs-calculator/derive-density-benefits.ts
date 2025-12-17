/**
 * Derived Density Benefit Computations
 *
 * Derived view only; formulas unchanged.
 * These functions compute comparisons by filtering datasets and calling
 * the existing computeSfsEconomics function, never modifying its logic.
 */

import { computeSfsEconomics } from "./compute";
import type {
  SfsCalculatorInputs,
  SfsRateCard,
  SfsStop,
  SfsAnchorResult,
} from "./types";

/** Epsilon for comparing CPP values (half a cent) */
const CPP_EPSILON = 0.005;

export interface RegularVsDensityResult {
  anchorId: string;
  /** CPP for anchor-only (no satellites) - the "regular" baseline */
  regularCpp: number;
  /** Blended CPP with all satellites - the "with density benefits" scenario */
  withDensityCpp: number;
  /** Savings amount (regularCpp - withDensityCpp), positive means density benefit */
  savingsAmount: number;
  /** Savings as percentage of regular CPP */
  savingsPercent: number;
  /** Whether there is a meaningful density benefit */
  hasDensityBenefit: boolean;
  /** Full anchor result for additional details */
  fullResult: SfsAnchorResult;
  /** Anchor-only result for baseline details */
  anchorOnlyResult: SfsAnchorResult | null;
}

/**
 * Computes the "Regular CPP" (anchor-only) vs "With Density Benefits CPP" (full scenario)
 * for a given anchor_id.
 *
 * Derived view only; formulas unchanged.
 */
export function computeRegularVsDensity(
  inputs: SfsCalculatorInputs,
  stops: SfsStop[],
  rateCard: SfsRateCard,
  anchorId: string,
): RegularVsDensityResult | null {
  // Get full result for this anchor
  const fullResults = computeSfsEconomics(inputs, stops, rateCard);
  const fullResult = fullResults.find((r) => r.anchor_id === anchorId);
  if (!fullResult) return null;

  // Filter to anchor-only stops for "regular" baseline
  const anchorOnlyStops = stops.filter(
    (s) => s.anchor_id === anchorId && s.stop_type === "Anchor"
  );

  let anchorOnlyResult: SfsAnchorResult | null = null;
  let regularCpp = fullResult.anchor_cpp; // Fallback to anchor_cpp

  if (anchorOnlyStops.length > 0) {
    const anchorOnlyResults = computeSfsEconomics(inputs, anchorOnlyStops, rateCard);
    anchorOnlyResult = anchorOnlyResults.find((r) => r.anchor_id === anchorId) ?? null;
    if (anchorOnlyResult && anchorOnlyResult.total_packages > 0) {
      regularCpp = anchorOnlyResult.blended_cpp;
    }
  }

  const withDensityCpp = fullResult.total_packages > 0 ? fullResult.blended_cpp : 0;
  const savingsAmount = regularCpp - withDensityCpp;
  const savingsPercent = regularCpp > 0 ? savingsAmount / regularCpp : 0;
  const hasDensityBenefit = savingsAmount > CPP_EPSILON;

  return {
    anchorId,
    regularCpp,
    withDensityCpp,
    savingsAmount,
    savingsPercent,
    hasDensityBenefit,
    fullResult,
    anchorOnlyResult,
  };
}

export interface SatelliteBenefitDelta {
  /** Store name from the satellite stop */
  storeName: string;
  /** Anchor ID this satellite belongs to */
  anchorId: string;
  /** Number of packages at this satellite */
  packages: number;
  /** Pickup window (formatted) */
  window: string;
  /** CPP delta: positive means this satellite provides density benefit */
  benefitDelta: number;
  /** Whether this satellite provides a meaningful density benefit */
  hasBenefit: boolean;
  /** The underlying stop data */
  stop: SfsStop;
}

/**
 * Computes per-satellite density benefit deltas for a given anchor.
 *
 * For each satellite:
 * - CPP_all = blended CPP with all satellites
 * - CPP_without = blended CPP excluding this satellite
 * - benefitDelta = CPP_without - CPP_all
 *
 * If benefitDelta > epsilon, that satellite provides density benefit.
 *
 * Derived view only; formulas unchanged.
 */
export function computePerSatelliteBenefitDeltas(
  inputs: SfsCalculatorInputs,
  stops: SfsStop[],
  rateCard: SfsRateCard,
  anchorId: string,
): SatelliteBenefitDelta[] {
  const anchorStops = stops.filter((s) => s.anchor_id === anchorId);
  const satellites = anchorStops.filter((s) => s.stop_type === "Satellite");

  if (satellites.length === 0) return [];

  // Compute CPP with all satellites
  const fullResults = computeSfsEconomics(inputs, anchorStops, rateCard);
  const fullResult = fullResults.find((r) => r.anchor_id === anchorId);
  if (!fullResult || fullResult.total_packages === 0) return [];

  const cppAll = fullResult.blended_cpp;

  return satellites.map((sat, idx) => {
    // Remove this satellite and recompute
    const stopsWithoutThis = anchorStops.filter((_, i) => {
      // Find the index of this satellite in the anchor stops
      const satIdx = anchorStops.findIndex((s) => s === sat);
      return i !== satIdx;
    });

    let cppWithout = cppAll;
    if (stopsWithoutThis.length > 0) {
      const withoutResults = computeSfsEconomics(inputs, stopsWithoutThis, rateCard);
      const withoutResult = withoutResults.find((r) => r.anchor_id === anchorId);
      if (withoutResult && withoutResult.total_packages > 0) {
        cppWithout = withoutResult.blended_cpp;
      }
    }

    const benefitDelta = cppWithout - cppAll;
    const hasBenefit = benefitDelta > CPP_EPSILON;

    return {
      storeName: sat.store_name || `Satellite ${idx + 1}`,
      anchorId: sat.anchor_id,
      packages: sat.packages,
      window: `${sat.pickup_window_start_time}–${sat.pickup_window_end_time}`,
      benefitDelta,
      hasBenefit,
      stop: sat,
    };
  });
}

