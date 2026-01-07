/**
 * Tests for metrics-flow-utils.ts
 * Covers rounding, normalization, palette, and edge cases.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeMetrics,
  computeTotal,
  computeRoundedPercents,
  getSegmentPalette,
} from "../src/components/modules/year-in-review/metrics-flow-utils";
import type { MetricsFlowItem } from "../src/config/modules";

// ─────────────────────────────────────────────────────────────────────────────
// Test data
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_METRICS: MetricsFlowItem[] = [
  { key: "box_truck", label: "Box Trucks", value: 1989, icon: "box-truck" },
  { key: "cargo_van", label: "Cargo Vans", value: 712, icon: "cargo-van" },
  { key: "trailer", label: "53ft Trailers", value: 1392, icon: "trailer" },
];

// ─────────────────────────────────────────────────────────────────────────────
// computeRoundedPercents tests
// ─────────────────────────────────────────────────────────────────────────────

describe("computeRoundedPercents", () => {
  it("sums to exactly 100 for sample values (1989/712/1392)", () => {
    const total = computeTotal(SAMPLE_METRICS);
    const result = computeRoundedPercents(SAMPLE_METRICS, total);
    const sum = result.reduce((s, m) => s + m.pctRounded, 0);
    assert.equal(sum, 100, "Rounded percentages should sum to 100");
  });

  it("returns 0% for all when total is 0", () => {
    const zeroMetrics: MetricsFlowItem[] = [
      { key: "a", label: "A", value: 0, icon: "box-truck" },
      { key: "b", label: "B", value: 0, icon: "cargo-van" },
    ];
    const result = computeRoundedPercents(zeroMetrics, 0);
    for (const m of result) {
      assert.equal(m.pctRounded, 0);
    }
  });

  it("distributes rounding correctly for 8 metrics summing to 100", () => {
    const metrics: MetricsFlowItem[] = Array.from({ length: 8 }, (_, i) => ({
      key: `metric_${i}`,
      label: `Metric ${i}`,
      value: 12 + (i % 3), // Values: 12, 13, 14, 12, 13, 14, 12, 13
      icon: "package" as const,
    }));
    const total = computeTotal(metrics);
    const result = computeRoundedPercents(metrics, total);
    const sum = result.reduce((s, m) => s + m.pctRounded, 0);
    assert.equal(sum, 100, "8 metrics should still sum to 100");
  });

  it("handles single large and many small values", () => {
    const metrics: MetricsFlowItem[] = [
      { key: "large", label: "Large", value: 990, icon: "box-truck" },
      { key: "small_1", label: "Small 1", value: 3, icon: "cargo-van" },
      { key: "small_2", label: "Small 2", value: 3, icon: "trailer" },
      { key: "small_3", label: "Small 3", value: 4, icon: "package" },
    ];
    const total = computeTotal(metrics);
    const result = computeRoundedPercents(metrics, total);
    const sum = result.reduce((s, m) => s + m.pctRounded, 0);
    assert.equal(sum, 100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeMetrics tests
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeMetrics", () => {
  it("clamps negative values to 0 and sets hasInvalid", () => {
    const metrics: MetricsFlowItem[] = [
      { key: "pos", label: "Positive", value: 100, icon: "box-truck" },
      { key: "neg", label: "Negative", value: -50, icon: "cargo-van" },
    ];
    const result = normalizeMetrics(metrics);
    assert.equal(result.hasInvalid, true);
    const negMetric = result.metrics.find((m) => m.key === "neg");
    assert.equal(negMetric?.value, 0, "Negative value should be clamped to 0");
  });

  it("filters out entries with missing/empty keys", () => {
    const metrics = [
      { key: "valid", label: "Valid", value: 100, icon: "box-truck" as const },
      { key: "", label: "Empty Key", value: 50, icon: "cargo-van" as const },
      { key: "   ", label: "Whitespace Key", value: 25, icon: "trailer" as const },
    ];
    const result = normalizeMetrics(metrics);
    assert.equal(result.metrics.length, 1);
    assert.equal(result.metrics[0].key, "valid");
    assert.equal(result.hasInvalid, true);
  });

  it("handles valid metrics without issues", () => {
    const result = normalizeMetrics(SAMPLE_METRICS);
    assert.equal(result.hasInvalid, false);
    assert.equal(result.metrics.length, 3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getSegmentPalette tests
// ─────────────────────────────────────────────────────────────────────────────

describe("getSegmentPalette", () => {
  it("returns deterministic palette per key", () => {
    const palette1 = getSegmentPalette(SAMPLE_METRICS);
    const palette2 = getSegmentPalette(SAMPLE_METRICS);
    
    for (let i = 0; i < palette1.length; i++) {
      assert.equal(palette1[i].from, palette2[i].from, "Same key should get same gradient");
      assert.equal(palette1[i].to, palette2[i].to);
    }
  });

  it("maps known icons to fixed palette positions", () => {
    const boxTruckMetric: MetricsFlowItem[] = [
      { key: "any_key", label: "Box Truck", value: 100, icon: "box-truck" },
    ];
    const cargoVanMetric: MetricsFlowItem[] = [
      { key: "any_other_key", label: "Cargo Van", value: 100, icon: "cargo-van" },
    ];
    
    const palette1 = getSegmentPalette(boxTruckMetric);
    const palette2 = getSegmentPalette(cargoVanMetric);
    
    // box-truck and cargo-van should have different colors
    assert.notEqual(palette1[0].from, palette2[0].from);
  });

  it("handles more than 8 metrics without error", () => {
    const manyMetrics: MetricsFlowItem[] = Array.from({ length: 12 }, (_, i) => ({
      key: `metric_${i}`,
      label: `Metric ${i}`,
      value: 100,
      icon: "package" as const,
    }));
    
    const palette = getSegmentPalette(manyMetrics);
    assert.equal(palette.length, 12);
    // All should have valid colors
    for (const p of palette) {
      assert.ok(p.from.startsWith("#"), "Should have valid hex color");
      assert.ok(p.to.startsWith("#"), "Should have valid hex color");
    }
  });
});

