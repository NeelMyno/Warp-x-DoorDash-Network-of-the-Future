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
