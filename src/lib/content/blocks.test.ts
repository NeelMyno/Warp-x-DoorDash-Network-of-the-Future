/**
 * Unit tests for content block parsing.
 * Run with: npx tsx src/lib/content/blocks.test.ts
 */

import { parseBlocksJson } from "./blocks";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`✓ ${message}`);
  } else {
    failed++;
    console.error(`✗ ${message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// metrics_flow parsing tests
// ─────────────────────────────────────────────────────────────────────────────

{
  // Valid metrics_flow block
  const validBlock = {
    type: "metrics_flow",
    title: "Completed Loads",
    subtitle: "by vehicle type",
    totalLabel: "Total completed loads",
    metrics: [
      { key: "box_truck", label: "Box Trucks", value: 1989, icon: "box-truck" },
      { key: "cargo_van", label: "Cargo Vans", value: 712, icon: "cargo-van" },
    ],
  };
  const result = parseBlocksJson([validBlock]);
  assert(result !== null && result.length === 1, "metrics_flow: parses valid block");
  assert(result?.[0]?.type === "metrics_flow", "metrics_flow: correct type");
}

{
  // Missing required fields
  const missingTitle = {
    type: "metrics_flow",
    totalLabel: "Total",
    metrics: [
      { key: "a", label: "A", value: 100, icon: "box-truck" },
      { key: "b", label: "B", value: 200, icon: "cargo-van" },
    ],
  };
  const result = parseBlocksJson([missingTitle]);
  assert(result !== null && result.length === 0, "metrics_flow: rejects missing title");
}

{
  // Invalid icon
  const invalidIcon = {
    type: "metrics_flow",
    title: "Test",
    totalLabel: "Total",
    metrics: [
      { key: "a", label: "A", value: 100, icon: "invalid-icon" },
      { key: "b", label: "B", value: 200, icon: "cargo-van" },
    ],
  };
  const result = parseBlocksJson([invalidIcon]);
  assert(result !== null && result.length === 0, "metrics_flow: rejects invalid icon");
}

{
  // Negative value
  const negativeValue = {
    type: "metrics_flow",
    title: "Test",
    totalLabel: "Total",
    metrics: [
      { key: "a", label: "A", value: -100, icon: "box-truck" },
      { key: "b", label: "B", value: 200, icon: "cargo-van" },
    ],
  };
  const result = parseBlocksJson([negativeValue]);
  assert(result !== null && result.length === 0, "metrics_flow: rejects negative value");
}

{
  // Only 1 metric (minimum 2 required)
  const oneMetric = {
    type: "metrics_flow",
    title: "Test",
    totalLabel: "Total",
    metrics: [
      { key: "a", label: "A", value: 100, icon: "box-truck" },
    ],
  };
  const result = parseBlocksJson([oneMetric]);
  assert(result !== null && result.length === 0, "metrics_flow: rejects < 2 metrics");
}

{
  // String value coerced to number
  const stringValue = {
    type: "metrics_flow",
    title: "Test",
    totalLabel: "Total",
    metrics: [
      { key: "a", label: "A", value: "100", icon: "box-truck" },
      { key: "b", label: "B", value: "200", icon: "cargo-van" },
    ],
  };
  const result = parseBlocksJson([stringValue]);
  assert(result !== null && result.length === 1, "metrics_flow: coerces string values to numbers");
  if (result?.[0]?.type === "metrics_flow") {
    assert(result[0].metrics[0].value === 100, "metrics_flow: coerced value is correct");
  }
}

{
  // All valid icons
  const allIcons = {
    type: "metrics_flow",
    title: "Test",
    totalLabel: "Total",
    metrics: [
      { key: "a", label: "A", value: 100, icon: "box-truck" },
      { key: "b", label: "B", value: 200, icon: "cargo-van" },
      { key: "c", label: "C", value: 300, icon: "trailer" },
      { key: "d", label: "D", value: 400, icon: "package" },
      { key: "e", label: "E", value: 500, icon: "warehouse" },
    ],
  };
  const result = parseBlocksJson([allIcons]);
  assert(result !== null && result.length === 1, "metrics_flow: accepts all valid icons");
  if (result?.[0]?.type === "metrics_flow") {
    assert(result[0].metrics.length === 5, "metrics_flow: all 5 metrics parsed");
  }
}

{
  // Zero values are valid
  const zeroValues = {
    type: "metrics_flow",
    title: "Test",
    totalLabel: "Total",
    metrics: [
      { key: "a", label: "A", value: 0, icon: "box-truck" },
      { key: "b", label: "B", value: 0, icon: "cargo-van" },
    ],
  };
  const result = parseBlocksJson([zeroValues]);
  assert(result !== null && result.length === 1, "metrics_flow: accepts zero values");
}

{
  // Maximum 8 metrics
  const eightMetrics = {
    type: "metrics_flow",
    title: "Test",
    totalLabel: "Total",
    metrics: Array.from({ length: 8 }, (_, i) => ({
      key: `m${i}`,
      label: `Metric ${i}`,
      value: i * 100,
      icon: "box-truck",
    })),
  };
  const result = parseBlocksJson([eightMetrics]);
  assert(result !== null && result.length === 1, "metrics_flow: accepts 8 metrics");
  if (result?.[0]?.type === "metrics_flow") {
    assert(result[0].metrics.length === 8, "metrics_flow: all 8 metrics parsed");
  }
}

{
  // Optional subtitle
  const noSubtitle = {
    type: "metrics_flow",
    title: "Test",
    totalLabel: "Total",
    metrics: [
      { key: "a", label: "A", value: 100, icon: "box-truck" },
      { key: "b", label: "B", value: 200, icon: "cargo-van" },
    ],
  };
  const result = parseBlocksJson([noSubtitle]);
  assert(result !== null && result.length === 1, "metrics_flow: subtitle is optional");
  if (result?.[0]?.type === "metrics_flow") {
    assert(result[0].subtitle === undefined, "metrics_flow: undefined subtitle");
  }
}

{
  // Compute total helper test
  const block = {
    type: "metrics_flow",
    title: "Test",
    totalLabel: "Total",
    metrics: [
      { key: "a", label: "A", value: 1000, icon: "box-truck" },
      { key: "b", label: "B", value: 500, icon: "cargo-van" },
      { key: "c", label: "C", value: 250, icon: "trailer" },
    ],
  };
  const result = parseBlocksJson([block]);
  if (result?.[0]?.type === "metrics_flow") {
    const total = result[0].metrics.reduce((sum, m) => sum + m.value, 0);
    assert(total === 1750, "metrics_flow: total computation correct");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  throw new Error(`Block parsing tests failed: ${failed} failed, ${passed} passed`);
}

