/**
 * Formatting utilities for SFS Calculator results
 */

import type { SfsAnchorResult, SfsCalculatorInputs } from "./types";

/** Format a number as currency (USD) */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format a percentage */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Format a number with commas */
export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatPlainNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function formatBool(value: boolean): string {
  // Match Python-style truthiness commonly used in the PDF pseudocode.
  return value ? "True" : "False";
}

function formatCurrencyOrNA(value: number, isAvailable: boolean): string {
  if (!isAvailable) return "N/A";
  return formatCurrency(value);
}

/**
 * Generates copy text using the PDF's OUTPUT_TEMPLATE format (per anchor).
 * Anchors are separated by a blank line when concatenated.
 */
export function generateOutputText(
  inputs: SfsCalculatorInputs,
  results: SfsAnchorResult[],
): string {
  return results
    .map((result) =>
      [
        "Ship From Store Route Economics",
        `Market: ${inputs.market}`,
        `Vehicle: ${inputs.vehicle_type}`,
        `Anchor ID: ${result.anchor_id}`,
        `Anchor CPP: ${formatCurrencyOrNA(result.anchor_cpp, result.anchor_packages > 0)}`,
        `Blended CPP: ${formatCurrencyOrNA(result.blended_cpp, result.total_packages > 0)}`,
        `Drivers Required: ${formatPlainNumber(result.drivers_required)}`,
        `Vehicles Required by Cube: ${formatPlainNumber(result.vehicles_required_by_cube)}`,
        `Pickup Window Overlap (mins): ${formatPlainNumber(result.pickup_overlap_minutes)}`,
        `Pickup Minutes Required: ${formatPlainNumber(result.pickup_minutes_required)}`,
        `Window Feasible: ${formatBool(result.window_feasible)}`,
        `Total Packages: ${formatPlainNumber(result.total_packages)}`,
        `Total Stops: ${formatPlainNumber(result.total_stops)}`,
      ].join("\n"),
    )
    .join("\n\n");
}
