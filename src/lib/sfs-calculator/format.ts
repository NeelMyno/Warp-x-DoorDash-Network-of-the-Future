/**
 * Formatting utilities for SFS Calculator results (V3).
 */

import type { SfsAnchorResult, SfsCalculatorInputs } from "./types";
import type { SfsSatelliteImpactSummary } from "./impact";

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

/**
 * Generates copy text for one anchor using the V3 density discount model.
 */
export function generateDensityOutputText(data: {
  inputs: SfsCalculatorInputs;
  result: SfsAnchorResult;
}): string {
  const { inputs, result } = data;

  const tiersLine =
    result.density_tiers.length > 0
      ? result.density_tiers
          .map((t) => `${t.label} ${formatPercent(t.discountPct)}`)
          .join(" | ")
      : "—";

  const distributionLine =
    result.density_tiers.length > 0
      ? result.density_tiers
          .map((t) => `${t.label} ${formatPercent(t.satelliteShare)}`)
          .join(" | ")
      : "—";

  const lines = [
    "Ship From Store Route Economics",
    `Market: ${inputs.market}`,
    `Vehicle: ${inputs.vehicle_type}`,
    `Anchor ID: ${result.anchor_id}`,
    "",
    "--- Density Discount ---",
    `Discount tiers: ${tiersLine}`,
    `Your distribution (satellite pkgs): ${distributionLine}`,
    `Weighted discount: ${formatPercent(result.density_discount_pct)}`,
    "",
    "--- Costs ---",
    `Base portion (no density): ${formatCurrency(result.base_portion_before_density)}`,
    `Base portion (after density): ${formatCurrency(result.base_portion_after_density)}`,
    `Stop fees (satellites): ${formatCurrency(result.stop_fees_total)}`,
    `Total route cost: ${formatCurrency(result.blended_cost)}`,
    "",
    "--- CPP ---",
    `Anchor CPP: ${formatCurrencyOrNA(result.anchor_cpp, result.anchor_packages > 0)}`,
    `Blended CPP: ${formatCurrencyOrNA(result.blended_cpp, result.total_packages > 0)}`,
    `Effective density savings: ${formatPercent(result.effective_density_savings_pct)}`,
    "",
    "--- Volume ---",
    `Anchor packages: ${formatPlainNumber(result.anchor_packages)}`,
    `Satellite packages: ${formatPlainNumber(result.satellite_packages)}`,
    `Total packages: ${formatPlainNumber(result.total_packages)}`,
    `Satellite stops: ${formatPlainNumber(result.satellite_stops)} | Total stops: ${formatPlainNumber(result.total_stops)}`,
  ];

  const satellites = result.stops_with_distance.filter((s) => s.stop_type === "Satellite");
  if (satellites.length > 0) {
    lines.push("", "--- Satellites ---");
    for (const s of satellites) {
      lines.push(
        `• ${s.store_name} (${s.store_id}): ${formatPlainNumber(s.packages)} pkgs, ${s.distance_to_anchor_miles.toFixed(1)} mi — ${s.tier_label} (${formatPercent(s.tier_discount_pct)})`,
      );
    }
  }

  return lines.join("\n");
}

/**
 * Generates copy text for multiple anchors (V3).
 */
export function generateAllAnchorsOutputText(
  inputs: SfsCalculatorInputs,
  results: SfsAnchorResult[],
): string {
  return results
    .map((result) => {
      return [
        `Anchor: ${result.anchor_id}`,
        `Weighted discount: ${formatPercent(result.density_discount_pct)}`,
        `Anchor CPP: ${formatCurrencyOrNA(result.anchor_cpp, result.anchor_packages > 0)}`,
        `Blended CPP: ${formatCurrencyOrNA(result.blended_cpp, result.total_packages > 0)}`,
        `Total route cost: ${formatCurrency(result.blended_cost)}`,
      ].join("\n");
    })
    .join("\n\n");
}

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function makeSatelliteResultsCsv(args: { inputs: SfsCalculatorInputs; summary: SfsSatelliteImpactSummary }): string {
  const { inputs, summary } = args;

  const header = [
    "anchor_id",
    "market",
    "vehicle_type",
    "store_id",
    "store_name",
    "distance_mi",
    "tier_label",
    "packages",
    "incremental_savings",
    "classification",
  ].join(",");

  const rows = summary.impacts.map((r) => {
    return [
      csvEscape(summary.anchor_id),
      csvEscape(inputs.market),
      csvEscape(inputs.vehicle_type),
      csvEscape(r.store_id),
      csvEscape(r.store_name),
      String(Number.isFinite(r.distance_to_anchor_miles) ? Number(r.distance_to_anchor_miles.toFixed(1)) : 0),
      csvEscape(r.tier_label),
      String(r.packages ?? 0),
      String(Number.isFinite(r.incremental_savings) ? Number(r.incremental_savings.toFixed(2)) : 0),
      csvEscape(r.classification),
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

export function generateSalesSummaryText(args: {
  inputs: SfsCalculatorInputs;
  selected: SfsAnchorResult;
  summary: SfsSatelliteImpactSummary;
}): string {
  const { inputs, selected, summary } = args;

  const tiers = summary.tier_distribution
    .slice()
    .sort((a, b) => b.contributionPctPoints - a.contributionPctPoints);

  const topTierDrivers = tiers
    .filter((t) => t.satellitePackages > 0 && t.contributionPctPoints > 0)
    .slice(0, 2)
    .map((t) => `${t.label} (${formatPercent(t.discountPct)} × ${formatPercent(t.satelliteShare)})`)
    .join(" | ");

  const topSatellites = summary.impacts
    .filter((s) => s.incremental_savings > 0)
    .slice()
    .sort((a, b) => b.incremental_savings - a.incremental_savings)
    .slice(0, 3);

  const lines: string[] = [];
  lines.push("SFS Density Discount Summary");
  lines.push(`Anchor ID: ${summary.anchor_id}`);
  lines.push(`Market: ${inputs.market}`);
  lines.push(`Vehicle: ${inputs.vehicle_type}`);
  lines.push("");
  lines.push("--- Pricing ---");
  lines.push(`Regular CPP (no density): ${formatCurrency(summary.regular_blended_cpp)}`);
  lines.push(`With density CPP: ${formatCurrency(summary.discounted_blended_cpp)}`);
  lines.push(`Savings from density: ${formatCurrency(summary.savings_dollars)} (${formatPercent(summary.savings_pct)})`);
  lines.push(`Weighted discount: ${formatPercent(summary.weighted_discount_pct)}`);
  if (topTierDrivers) {
    lines.push(`Top tier drivers: ${topTierDrivers}`);
  }

  lines.push("");
  lines.push("--- Notes ---");
  lines.push("• Density discount applies only to the base portion; stop fees are unchanged.");
  lines.push("• Assumes route capacity is sufficient for combined packages.");

  if (topSatellites.length) {
    lines.push("");
    lines.push("--- Top satellite impacts ---");
    for (const s of topSatellites) {
      lines.push(
        `• ${s.store_name} (${s.store_id}) — ${s.distance_to_anchor_miles.toFixed(1)} mi, ${s.tier_label}: +${formatCurrency(s.incremental_savings)} savings`,
      );
    }
  }

  if (selected.anchor_packages === 0) {
    lines.push("");
    lines.push("⚠️ Anchor packages are 0; CPP values may not be meaningful.");
  }

  return lines.join("\n");
}
