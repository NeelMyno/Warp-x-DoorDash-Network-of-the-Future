/**
 * Formatting utilities for SFS Calculator results
 */

import type { SfsCalculatorInputs, SfsEconomicsResult } from "./types";

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

/** Generate copyable summary text */
export function generateSummaryText(
  inputs: SfsCalculatorInputs,
  result: SfsEconomicsResult
): string {
  const timestamp = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const densityStatus = result.density_eligible ? "✓ Eligible" : "✗ Not Eligible";

  const lines = [
    `SFS Route Economics — ${inputs.market} — ${timestamp}`,
    ``,
    `📦 INPUTS`,
    `• Vehicle: ${inputs.vehicle_type}`,
    `• Anchor packages: ${formatNumber(inputs.anchor_packages)} | Stops: ${formatNumber(inputs.anchor_stops)}`,
    `• Satellite stores: ${formatNumber(inputs.satellite_stores)} | Packages: ${formatNumber(inputs.satellite_packages)}`,
    `• Pickup window: ${formatNumber(inputs.pickup_window_minutes)} min`,
    `• Route miles: ${formatNumber(inputs.pickup_route_miles + inputs.satellite_extra_miles, 1)} mi`,
    ``,
    `📊 OUTPUTS`,
    `• Anchor CPP: ${formatCurrency(result.anchor_cpp)}`,
    `• Blended CPP: ${formatCurrency(result.blended_cpp)}`,
    `• Savings: ${formatCurrency(result.savings_absolute)} per pkg (${formatPercent(result.savings_percent)})`,
    `• Density: ${densityStatus}`,
    `• Drivers required: ${result.drivers_required}`,
    ``,
    `💰 RATE CARD`,
    `• Base: ${formatCurrency(result.rate_card.base_cost)} | Per mile: ${formatCurrency(result.rate_card.cost_per_mile)}`,
    `• Stop fee: ${formatCurrency(result.rate_card.stop_fee)} | Driver: ${formatCurrency(result.rate_card.driver_cost)}`,
  ];

  return lines.join("\n");
}

