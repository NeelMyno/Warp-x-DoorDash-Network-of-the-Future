import { z } from "zod";

export const NetworkThresholdRowSchema = z.object({
  threshold: z.string().trim().min(1),
  change: z.string().trim().min(1),
});

export const NetworkThresholdsSchema = z
  .array(NetworkThresholdRowSchema)
  .max(50);

export type NetworkThresholds = z.infer<typeof NetworkThresholdsSchema>;

export const UtilizationScenarioSchema = z.object({
  utilization_label: z.string().trim().min(1),
  cost_per_box: z.number().finite().min(0),
});

export const AllInBreakdownSchema = z.object({
  last_mile_cost_per_box: z.number().finite().min(0),
  middle_mile_cost_per_box: z.number().finite().min(0),
  first_mile_cost_per_box: z.number().finite().min(0),
  hub_sort_cost_per_box: z.number().finite().min(0),
  spoke_sort_cost_per_box: z.number().finite().min(0),
  dispatch_cost_per_box: z.number().finite().min(0),
  total_all_in_cost_per_box: z.number().finite().min(0).optional(),
});

export const NetworkCostModelSchema = z.object({
  utilization_scenarios: z.array(UtilizationScenarioSchema).max(12).default([]),
  all_in_breakdown: AllInBreakdownSchema.optional(),
});

export type NetworkCostModel = z.infer<typeof NetworkCostModelSchema>;

export function parseNetworkThresholds(input: unknown): NetworkThresholds | null {
  const parsed = NetworkThresholdsSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function parseNetworkCostModel(input: unknown): NetworkCostModel | null {
  const parsed = NetworkCostModelSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}
