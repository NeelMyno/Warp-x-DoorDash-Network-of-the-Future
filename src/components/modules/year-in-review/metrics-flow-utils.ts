/**
 * Shared utilities for metrics flow visualization.
 * Used by both MetricsFlowCard and Admin Content Studio preview.
 */

import type { MetricsFlowItem, MetricsFlowIconKey } from "@/config/modules";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Metric with computed percentage and float for rendering */
export interface MetricWithPercent extends MetricsFlowItem {
  pctFloat: number;
  pctRounded: number;
}

/** Result of normalizing metrics with validation info */
export interface NormalizedMetricsResult {
  metrics: MetricsFlowItem[];
  hasInvalid: boolean;
  invalidCount: number;
}

/** Gradient definition for a segment */
export interface SegmentGradient {
  key: string;
  from: string;
  to: string;
  glow: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Premium Gradient Palette
// ─────────────────────────────────────────────────────────────────────────────

/** 
 * Sophisticated gradient palette with muted, professional colors.
 * These are ordered for visual harmony when displayed side-by-side.
 */
const GRADIENT_PALETTE: Omit<SegmentGradient, "key">[] = [
  { from: "#3b82f6", to: "#2563eb", glow: "rgba(59, 130, 246, 0.35)" },   // Blue
  { from: "#10b981", to: "#059669", glow: "rgba(16, 185, 129, 0.35)" },   // Emerald
  { from: "#f59e0b", to: "#d97706", glow: "rgba(245, 158, 11, 0.35)" },   // Amber
  { from: "#8b5cf6", to: "#7c3aed", glow: "rgba(139, 92, 246, 0.35)" },   // Purple
  { from: "#ef4444", to: "#dc2626", glow: "rgba(239, 68, 68, 0.35)" },    // Red
  { from: "#06b6d4", to: "#0891b2", glow: "rgba(6, 182, 212, 0.35)" },    // Cyan
  { from: "#f97316", to: "#ea580c", glow: "rgba(249, 115, 22, 0.35)" },   // Orange
  { from: "#6366f1", to: "#4f46e5", glow: "rgba(99, 102, 241, 0.35)" },   // Indigo
];

/**
 * Known icon keys mapped to fixed palette indices for consistency.
 * Same icon = same color across all metrics flow blocks.
 */
const ICON_PALETTE_MAP: Record<MetricsFlowIconKey, number> = {
  "box-truck": 0,   // Blue
  "cargo-van": 1,   // Emerald
  "trailer": 2,     // Amber
  "package": 3,     // Purple
  "warehouse": 4,   // Red
};

/**
 * Simple hash function for unknown keys → deterministic palette index.
 */
function hashKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes metrics by filtering invalid entries and clamping negative values.
 * Returns the processed metrics along with validation info.
 */
export function normalizeMetrics(metrics: MetricsFlowItem[]): NormalizedMetricsResult {
  let invalidCount = 0;
  
  const normalized = metrics
    .filter((m): m is MetricsFlowItem => {
      if (!m || typeof m.key !== "string" || !m.key.trim()) {
        invalidCount++;
        return false;
      }
      return true;
    })
    .map((m) => {
      const value = typeof m.value === "number" && Number.isFinite(m.value) ? m.value : 0;
      if (value < 0) {
        invalidCount++;
        return { ...m, value: 0 };
      }
      if (value !== m.value) {
        invalidCount++;
      }
      return { ...m, value };
    });

  return {
    metrics: normalized,
    hasInvalid: invalidCount > 0,
    invalidCount,
  };
}

/**
 * Computes the total sum of all metric values.
 */
export function computeTotal(metrics: MetricsFlowItem[]): number {
  return metrics.reduce((sum, m) => sum + m.value, 0);
}

/**
 * Computes rounded percentages using the largest remainder (Hamilton) method.
 * Guarantees percentages sum to exactly 100 (or all 0 if total is 0).
 */
export function computeRoundedPercents(
  metrics: MetricsFlowItem[],
  total: number
): MetricWithPercent[] {
  if (total === 0) {
    return metrics.map((m) => ({
      ...m,
      pctFloat: 0,
      pctRounded: 0,
    }));
  }

  // Calculate raw percentages
  const rawPercents = metrics.map((m) => (m.value / total) * 100);
  const floored = rawPercents.map(Math.floor);
  
  // Build remainder list for distribution
  const remainders = rawPercents.map((p, i) => ({ 
    index: i, 
    remainder: p - floored[i] 
  }));
  
  // Sort by largest remainder descending
  remainders.sort((a, b) => b.remainder - a.remainder);
  
  // Distribute remaining points to reach 100
  let remaining = 100 - floored.reduce((a, b) => a + b, 0);
  for (const { index } of remainders) {
    if (remaining <= 0) break;
    floored[index]++;
    remaining--;
  }

  return metrics.map((m, i) => ({
    ...m,
    pctFloat: rawPercents[i],
    pctRounded: floored[i],
  }));
}

/**
 * Generates a deterministic gradient palette for the given metrics.
 * - Known icons get fixed colors for consistency.
 * - Unknown keys are hashed for determinism.
 * - If palette repeats (>8 metrics), opacity variation is applied.
 */
export function getSegmentPalette(metrics: MetricsFlowItem[]): SegmentGradient[] {
  const usedIndices = new Set<number>();

  return metrics.map((m, idx) => {
    let paletteIndex: number;

    // Try to use icon-based mapping first
    if (m.icon && m.icon in ICON_PALETTE_MAP) {
      paletteIndex = ICON_PALETTE_MAP[m.icon];
    } else {
      // Fall back to key hash
      paletteIndex = hashKey(m.key) % GRADIENT_PALETTE.length;
    }

    // If we've used this index before, find next available or cycle with variation
    let attempts = 0;
    while (usedIndices.has(paletteIndex) && attempts < GRADIENT_PALETTE.length) {
      paletteIndex = (paletteIndex + 1) % GRADIENT_PALETTE.length;
      attempts++;
    }
    usedIndices.add(paletteIndex);

    const base = GRADIENT_PALETTE[paletteIndex];

    // For metrics beyond palette length, add slight opacity variation
    const cycleNumber = Math.floor(idx / GRADIENT_PALETTE.length);
    if (cycleNumber > 0) {
      // Slightly darken repeated colors
      const darkenFactor = 0.85 - cycleNumber * 0.1;
      return {
        key: m.key,
        from: darkenHex(base.from, darkenFactor),
        to: darkenHex(base.to, darkenFactor),
        glow: base.glow.replace("0.35", String(0.25 - cycleNumber * 0.05)),
      };
    }

    return {
      key: m.key,
      ...base,
    };
  });
}

/**
 * Darkens a hex color by a factor (0-1).
 */
function darkenHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const dr = Math.round(r * factor);
  const dg = Math.round(g * factor);
  const db = Math.round(b * factor);

  return `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting Utilities
// ─────────────────────────────────────────────────────────────────────────────

const numberFormatter = new Intl.NumberFormat("en-US");

/**
 * Formats a number with thousand separators.
 */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/**
 * Formats a legend item string: "Label — 1,234 · 25%"
 */
export function formatLegendItem(label: string, value: number, percent: number): string {
  return `${label} — ${formatNumber(value)} · ${percent}%`;
}

