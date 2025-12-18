import { z } from "zod";

export const AutomationStatusSchema = z.enum(["automated", "partial", "manual"]);
export type AutomationStatus = z.infer<typeof AutomationStatusSchema>;

export const AutomationNodeTypeSchema = z.enum(["hub", "spoke"]);
export type AutomationNodeType = z.infer<typeof AutomationNodeTypeSchema>;

export const AutomationNodeSchema = z.object({
  id: z.string().uuid(),
  node_type: AutomationNodeTypeSchema,
  name: z.string().trim().min(1).max(120),
  market: z.string().trim().max(120).nullable().optional(),
  region: z.string().trim().max(120).nullable().optional(),
  automation_status: AutomationStatusSchema,
  notes: z.string().trim().max(4000).nullable().optional(),
  sort_order: z.number().int().min(0),
  updated_at: z.string(),
});

export type AutomationNode = z.infer<typeof AutomationNodeSchema>;

export const VolumeThresholdSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(120),
  changes: z.array(z.string().trim().min(1).max(220)).min(1).max(12),
  implication: z.string().trim().max(800).nullable().optional(),
  sort_order: z.number().int().min(0),
  updated_at: z.string(),
});

export type VolumeThreshold = z.infer<typeof VolumeThresholdSchema>;

export const CoverageClaimSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  statement: z.string().trim().min(1).max(2000),
  service_level: z.string().trim().max(80).nullable().optional(),
  region: z.string().trim().max(120).nullable().optional(),
  injection: z.string().trim().max(120).nullable().optional(),
  limitations: z.string().trim().max(2000).nullable().optional(),
  sort_order: z.number().int().min(0),
  updated_at: z.string(),
});

export type CoverageClaim = z.infer<typeof CoverageClaimSchema>;

export const CostScenarioSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  truck_utilization_pct: z.number().min(0).max(100).nullable().optional(),
  middle_mile_cost_per_box: z.number().min(0).nullable().optional(),
  all_in_cost_per_box: z.number().min(0).nullable().optional(),
  last_mile_cost_per_box: z.number().min(0).nullable().optional(),
  first_mile_cost_per_box: z.number().min(0).nullable().optional(),
  hub_sort_cost_per_box: z.number().min(0).nullable().optional(),
  spoke_sort_cost_per_box: z.number().min(0).nullable().optional(),
  dispatch_cost_per_box: z.number().min(0).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  sort_order: z.number().int().min(0),
  updated_at: z.string(),
});

export type CostScenario = z.infer<typeof CostScenarioSchema>;

export const NetworkInsightsSchema = z.object({
  automationNodes: z.array(AutomationNodeSchema),
  volumeThresholds: z.array(VolumeThresholdSchema),
  coverageClaims: z.array(CoverageClaimSchema),
  costScenarios: z.array(CostScenarioSchema),
  updatedAt: z.object({
    automationCoverage: z.string().nullable(),
    volumeThresholds: z.string().nullable(),
    populationCoverage: z.string().nullable(),
    costModeling: z.string().nullable(),
  }),
});

export type NetworkInsights = z.infer<typeof NetworkInsightsSchema>;

