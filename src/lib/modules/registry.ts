/**
 * Module Registry - Single source of truth for all module definitions.
 * Adding a new module is a 1-file change here.
 */

/** Layout type for module pages */
export type ModuleLayoutType =
  | "narrative"
  | "narrative_premium"
  | "calculator"
  | "pdf"
  | "full_bleed_single_section";

/** Known module slugs (for type safety) */
export type ModuleSlug =
  | "big-and-bulky"
  | "sfs"
  | "sfs-calculator"
  | "automated-hubs"
  | "spoke"
  | "middle-mile-to-spokes"
  | "first-mile-to-hubs-or-spokes"
  | "returns"
  | "store-replenishments"
  | "year-in-review";

/** Tab definition for calculator layouts */
export interface ModuleTabs {
  defaultTab: string;
  allowedTabs: string[];
}

/** Module registry entry */
export interface ModuleRegistryEntry {
  slug: ModuleSlug;
  name: string;
  description: string;
  layout: ModuleLayoutType;
  /** Optional tabs config for calculator layouts */
  tabs?: ModuleTabs;
  /** Optional icon key for sidebar/cards */
  navIconKey?: string;
  /**
   * For single-section layouts: which section key to render.
   * When set, rendering is STRICT (no fallback to other sections).
   * If the specified section is empty, show empty state.
   */
  primarySectionKey?: string;
}

/**
 * Canonical list of all modules.
 * To add a new module, add an entry here.
 */
export const MODULE_REGISTRY: ModuleRegistryEntry[] = [
  {
    slug: "big-and-bulky",
    name: "Big and Bulky",
    description: "Oversized, high-touch delivery flows and network design.",
    layout: "narrative_premium",
    navIconKey: "stack",
  },
  {
    slug: "sfs",
    name: "SFS",
    description: "Ship-from-store fulfillment and inventory-aware routing.",
    layout: "narrative_premium",
    navIconKey: "stack",
  },
  {
    slug: "sfs-calculator",
    name: "SFS Calculator",
    description: "Upload stores and estimate density savings.",
    layout: "calculator",
    navIconKey: "calculator",
  },
  {
    slug: "automated-hubs",
    name: "Automated Hubs",
    description: "Automated hub facility operations and documentation.",
    layout: "pdf",
    navIconKey: "warehouse",
  },
  {
    slug: "spoke",
    name: "Spoke",
    description: "Spoke facility operations and last-mile integration.",
    layout: "narrative",
    navIconKey: "stack",
  },
  {
    slug: "middle-mile-to-spokes",
    name: "Middle Mile to Spokes",
    description: "Linehaul movement from hubs to spoke facilities.",
    layout: "narrative_premium",
    navIconKey: "stack",
  },
  {
    slug: "first-mile-to-hubs-or-spokes",
    name: "First Mile to Hubs/Spokes",
    description: "Initial pickup and injection into hub/spoke network.",
    layout: "narrative_premium",
    navIconKey: "stack",
  },
  {
    slug: "returns",
    name: "Returns",
    description: "Reverse logistics processes and return-to-origin flows.",
    layout: "narrative_premium",
    navIconKey: "stack",
  },
  {
    slug: "store-replenishments",
    name: "Store Replenishments",
    description: "Scheduled restocking from distribution centers to stores.",
    layout: "narrative_premium",
    navIconKey: "stack",
  },
  {
    slug: "year-in-review",
    name: "2025 Year in Review",
    description: "Completed loads by vehicle type for 2025.",
    layout: "full_bleed_single_section",
    navIconKey: "chart",
    // Strict: only render end-vision, never fall back to other sections
    primarySectionKey: "end-vision",
  },
];

/**
 * Get a module by slug.
 * Returns undefined if not found.
 */
export function getModuleBySlug(slug: string): ModuleRegistryEntry | undefined {
  return MODULE_REGISTRY.find((m) => m.slug === slug);
}

/**
 * Check if a slug is a valid module slug.
 */
export function isValidModuleSlug(slug: string): slug is ModuleSlug {
  return MODULE_REGISTRY.some((m) => m.slug === slug);
}

/**
 * Normalize a tab value for a module.
 * Returns the default tab if the value is invalid.
 */
export function normalizeModuleTab(
  module: ModuleRegistryEntry,
  tab: string | undefined
): string {
  if (!module.tabs) return "overview";
  if (tab && module.tabs.allowedTabs.includes(tab)) return tab;
  return module.tabs.defaultTab;
}
