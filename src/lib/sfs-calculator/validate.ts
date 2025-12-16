/**
 * Zod validation schema for SFS Calculator inputs
 */

import { z } from "zod";

const positiveNumber = z.number().finite().nonnegative();
const positiveNonZero = z.number().finite().positive({ message: "Must be > 0" });

export const SfsInputsSchema = z.object({
  // Required dropdowns
  market: z.string().min(1, "Please select a market"),
  vehicle_type: z.enum(["Cargo Van", "Box Truck"]),

  // Anchor store
  anchor_packages: positiveNonZero.refine((v) => v >= 1, { message: "At least 1 package" }),
  anchor_stops: positiveNumber,
  pickup_route_miles: positiveNumber,
  avg_routing_time_per_stop: positiveNonZero.refine((v) => v > 0, { message: "Must be > 0" }),
  pickup_window_minutes: positiveNumber,
  avg_cubic_inches_per_package: positiveNonZero.refine((v) => v >= 1, { message: "At least 1 cu in" }),

  // Satellite stores
  satellite_stores: positiveNumber,
  satellite_packages: positiveNumber,
  satellite_extra_miles: positiveNumber,
  miles_to_hub_or_spoke: positiveNumber,

  // Constraints
  max_satellite_packages_allowed: positiveNumber,
  max_satellite_miles_allowed: positiveNumber,
  max_driver_time_minutes: positiveNonZero.refine((v) => v >= 1, { message: "At least 1 minute" }),

  // Optional overrides
  override_base_cost: z.number().finite().nonnegative().optional(),
  override_cost_per_mile: z.number().finite().nonnegative().optional(),
  override_stop_fee: z.number().finite().nonnegative().optional(),
  override_driver_cost: z.number().finite().nonnegative().optional(),
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
  market: z.string().min(1, "Market is required"),
  vehicle_type: z.enum(["Cargo Van", "Box Truck"]),
  base_cost: z.number().finite().nonnegative(),
  cost_per_mile: z.number().finite().nonnegative(),
  stop_fee: z.number().finite().nonnegative(),
  driver_cost: z.number().finite().nonnegative(),
});

export const RateCardUpdateSchema = RateCardSchema.extend({
  id: z.string().uuid("Invalid rate card ID"),
});

