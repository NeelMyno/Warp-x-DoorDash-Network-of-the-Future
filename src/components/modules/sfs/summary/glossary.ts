/**
 * Glossary of SFS Calculator metric definitions.
 * Used for consistent tooltips across all summary components.
 */

export interface GlossaryEntry {
  title: string;
  body: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  blended_cpp: {
    title: "Blended Cost Per Package",
    body: "Total route cost divided by all packages (anchor + satellite). Lower is better—indicates more efficient delivery.",
  },
  anchor_cpp: {
    title: "Anchor CPP",
    body: "Cost per package for anchor store alone. This is your baseline before adding satellite stops.",
  },
  cpp_improvement: {
    title: "CPP Improvement",
    body: "Savings vs anchor-only delivery. Positive improvement means blended routing costs less per package.",
  },
  density_eligibility: {
    title: "Density Eligibility",
    body: "Route qualifies for multi-stop optimization if all constraint thresholds are met.",
  },
  drivers_required: {
    title: "Drivers Required",
    body: "Minimum drivers needed based on package volume and vehicle capacity.",
  },
  total_packages: {
    title: "Total Packages",
    body: "Sum of anchor and satellite packages on this route configuration.",
  },
  total_stops: {
    title: "Total Stops",
    body: "All delivery stops including anchor deliveries and satellite pickup/dropoffs.",
  },
  pickup_miles: {
    title: "Pickup Miles",
    body: "Distance traveled to collect packages from anchor and satellite stores.",
  },
  hub_spoke_miles: {
    title: "Hub/Spoke Miles",
    body: "Distance to/from the hub or spoke facility for this route.",
  },
  total_route_miles: {
    title: "Total Route Miles",
    body: "Complete route distance including pickups, deliveries, and hub transit.",
  },
  pickup_window: {
    title: "Pickup Window",
    body: "Time available for pickups. Must be ≤120 min for density eligibility.",
  },
  satellite_packages: {
    title: "Satellite Packages",
    body: "Package count from satellite stores. Must not exceed configured threshold.",
  },
  satellite_miles: {
    title: "Satellite Miles",
    body: "Average detour distance per satellite. Must stay within density limits.",
  },
  driver_time: {
    title: "Driver Time",
    body: "Estimated route time based on stops and routing time. Must fit shift limits.",
  },
};

/**
 * Helper to get a glossary entry or a fallback.
 */
export function getGlossary(key: string): GlossaryEntry {
  return (
    GLOSSARY[key] ?? {
      title: key,
      body: "No definition available.",
    }
  );
}

