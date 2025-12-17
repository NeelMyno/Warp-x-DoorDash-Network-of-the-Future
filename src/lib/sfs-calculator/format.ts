/**
 * Formatting utilities for SFS Calculator results
 */

import type { SfsAnchorResult, SfsCalculatorInputs } from "./types";
import type { RegularVsDensityResult, SatelliteBenefitDelta } from "./derive-density-benefits";

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

function formatCurrencyOrNA(value: number, isAvailable: boolean): string {
  if (!isAvailable) return "N/A";
  return formatCurrency(value);
}

export interface DensityOutputData {
  inputs: SfsCalculatorInputs;
  densityResult: RegularVsDensityResult;
  satelliteDeltas: SatelliteBenefitDelta[];
}

/**
 * Generates copy text using density benefit language (no feasibility).
 * Anchors are separated by a blank line when concatenated.
 */
export function generateDensityOutputText(data: DensityOutputData): string {
  const { inputs, densityResult, satelliteDeltas } = data;
  const result = densityResult.fullResult;

  const lines = [
    "Ship From Store Route Economics",
    `Market: ${inputs.market}`,
    `Vehicle: ${inputs.vehicle_type}`,
    `Anchor ID: ${result.anchor_id}`,
    "",
    "--- Cost Summary ---",
    `Regular CPP: ${formatCurrencyOrNA(densityResult.regularCpp, densityResult.regularCpp > 0)}`,
    `With Density Benefits CPP: ${formatCurrencyOrNA(densityResult.withDensityCpp, result.total_packages > 0)}`,
    densityResult.hasDensityBenefit
      ? `Savings: ${formatCurrency(densityResult.savingsAmount)} (${formatPercent(densityResult.savingsPercent)})`
      : `Status: Regular costs (no density benefit)`,
    "",
    "--- Route Details ---",
    `Total Packages: ${formatPlainNumber(result.total_packages)}`,
    `Total Stops: ${formatPlainNumber(result.total_stops)}`,
    `Drivers Required: ${formatPlainNumber(result.drivers_required)}`,
    `Anchor Route Cost: ${formatCurrency(result.anchor_route_cost)}`,
    `Total Route Cost: ${formatCurrency(result.blended_cost)}`,
  ];

  if (satelliteDeltas.length > 0) {
    lines.push("", "--- Store Additions ---");
    for (const sat of satelliteDeltas) {
      const benefitLabel = sat.hasBenefit
        ? `Density benefit (${formatCurrency(sat.benefitDelta)} CPP)`
        : "Regular cost";
      lines.push(`• ${sat.storeName}: ${sat.packages} pkgs, ${sat.window} — ${benefitLabel}`);
    }
  }

  return lines.join("\n");
}

/**
 * Generates copy text for multiple anchors using density benefit language.
 */
export function generateAllAnchorsOutputText(
  inputs: SfsCalculatorInputs,
  densityResults: RegularVsDensityResult[],
): string {
  return densityResults
    .map((dr) => {
      const result = dr.fullResult;
      const statusLabel = dr.hasDensityBenefit
        ? `Savings: ${formatCurrency(dr.savingsAmount)} (${formatPercent(dr.savingsPercent)})`
        : "Regular costs";

      return [
        `Anchor: ${result.anchor_id}`,
        `Regular CPP: ${formatCurrencyOrNA(dr.regularCpp, dr.regularCpp > 0)}`,
        `With Density CPP: ${formatCurrencyOrNA(dr.withDensityCpp, result.total_packages > 0)}`,
        statusLabel,
        `Packages: ${result.total_packages} | Stops: ${result.total_stops}`,
      ].join("\n");
    })
    .join("\n\n");
}

/**
 * Legacy: Generates copy text using the PDF's OUTPUT_TEMPLATE format (per anchor).
 * @deprecated Use generateDensityOutputText instead
 */
export function generateOutputText(
  inputs: SfsCalculatorInputs,
  results: SfsAnchorResult[],
): string {
  return results
    .map((result) => {
      const regularCpp = result.anchor_cpp;
      const withDensityCpp = result.blended_cpp;
      const savings = regularCpp - withDensityCpp;
      const hasBenefit = savings > 0.005;

      return [
        "Ship From Store Route Economics",
        `Market: ${inputs.market}`,
        `Vehicle: ${inputs.vehicle_type}`,
        `Anchor ID: ${result.anchor_id}`,
        `Regular CPP: ${formatCurrencyOrNA(result.anchor_cpp, result.anchor_packages > 0)}`,
        `With Density Benefits CPP: ${formatCurrencyOrNA(result.blended_cpp, result.total_packages > 0)}`,
        hasBenefit
          ? `Savings: ${formatCurrency(savings)} (${formatPercent(savings / regularCpp)})`
          : `Status: Regular costs`,
        `Drivers Required: ${formatPlainNumber(result.drivers_required)}`,
        `Total Packages: ${formatPlainNumber(result.total_packages)}`,
        `Total Stops: ${formatPlainNumber(result.total_stops)}`,
      ].join("\n");
    })
    .join("\n\n");
}
