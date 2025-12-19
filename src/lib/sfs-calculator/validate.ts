/**
 * Zod validation schema for SFS Calculator inputs
 */

import { z } from "zod";

const nonNegative = z.number().finite().nonnegative();
const positive = z.number().finite().positive({ message: "Must be > 0" });

export const SfsInputsSchema = z.object({
  // Required fields
  market: z.string().min(1, "Please select a market"),
  vehicle_type: z.enum(["Cargo Van", "26' Box Truck"]),
  miles_to_hub_or_spoke: nonNegative,
  avg_routing_time_per_stop_minutes: nonNegative,
  default_service_time_minutes: nonNegative,
  max_driver_time_minutes: positive,
  avg_speed_mph: positive,
  default_avg_cubic_inches_per_package: positive,
});

export type SfsInputsSchemaType = z.infer<typeof SfsInputsSchema>;

/** Validate inputs and return field-level errors */
export function validateSfsInputs(
  inputs: SfsInputsSchemaType | Record<string, unknown>
): Record<string, string> {
  const result = SfsInputsSchema.safeParse(inputs);

  if (result.success) {
    return {};
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path[0];
    if (typeof path === "string" && !errors[path]) {
      errors[path] = issue.message;
    }
  }
  return errors;
}

/** Validation schema for API rate card create/update */
export const RateCardSchema = z.object({
  vehicle_type: z.enum(["Cargo Van", "26' Box Truck"]),
  base_fee: nonNegative,
  per_mile_rate: nonNegative,
  per_stop_rate: nonNegative,
});

export const RateCardUpdateSchema = RateCardSchema.extend({
  id: z.string().uuid("Invalid rate card ID"),
});

export const SfsStoreLocationUpsertSchema = z.object({
  store_id: z.string().trim().min(1, "store_id is required"),
  store_name: z.string().trim().min(1).nullable().optional(),
  market: z.string().trim().min(1).nullable().optional(),
  lat: z.number().finite(),
  lon: z.number().finite(),
  is_active: z.boolean().optional(),
});

export const SfsStoreLocationsBatchSchema = z.object({
  locations: z.array(SfsStoreLocationUpsertSchema).min(1, "At least one store location is required"),
});

export const SfsDensityTierUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  sort_order: z.number().int().finite(),
  min_miles: z.number().finite().nonnegative(),
  max_miles: z.number().finite().nullable().optional(),
  discount_pct: z.number().finite().min(0).max(0.5),
  label: z.string().trim().min(1).nullable().optional(),
  is_active: z.boolean().optional(),
});

export const SfsDensityTiersBatchSchema = z.object({
  tiers: z.array(SfsDensityTierUpsertSchema).min(1, "At least one tier is required"),
});
