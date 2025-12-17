/**
 * Minimal unit tests for the Network Enhancements schemas.
 * Run with: npx tsx src/lib/network-enhancements/schema.test.ts
 */

import { NetworkCostModelSchema, NetworkThresholdsSchema } from "./schema";

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

{
  const ok = NetworkThresholdsSchema.safeParse([
    { threshold: "< 1k/day", change: "Manual sort only" },
    { threshold: "1k–5k/day", change: "Introduce automation lanes" },
  ]);
  assert(ok.success, "NetworkThresholdsSchema accepts valid rows");

  const bad = NetworkThresholdsSchema.safeParse([{ threshold: "", change: "x" }]);
  assert(!bad.success, "NetworkThresholdsSchema rejects empty threshold");
}

{
  const ok = NetworkCostModelSchema.safeParse({
    utilization_scenarios: [{ utilization_label: "75%", cost_per_box: 0.42 }],
    all_in_breakdown: {
      last_mile_cost_per_box: 1,
      middle_mile_cost_per_box: 0.4,
      first_mile_cost_per_box: 0.2,
      hub_sort_cost_per_box: 0.15,
      spoke_sort_cost_per_box: 0.1,
      dispatch_cost_per_box: 0.05,
      total_all_in_cost_per_box: 1.9,
    },
  });
  assert(ok.success, "NetworkCostModelSchema accepts valid model");

  const bad = NetworkCostModelSchema.safeParse({
    utilization_scenarios: [{ utilization_label: "60%", cost_per_box: -1 }],
  });
  assert(!bad.success, "NetworkCostModelSchema rejects negative costs");
}

if (failed > 0) {
  throw new Error(`Schema tests failed: ${failed} failed, ${passed} passed`);
}
