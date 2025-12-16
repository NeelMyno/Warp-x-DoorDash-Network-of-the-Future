/**
 * Module Registry - Single source of truth for all module definitions.
 * Adding a new module is a 1-file change here.
 */

/** Layout type for module pages */
export type ModuleLayoutType = "narrative" | "calculator";

/** Known module slugs (for type safety) */
export type ModuleSlug =
  | "big-and-bulky"
  | "sfs"
  | "middle-mile-to-spokes"
  | "first-mile-to-hubs-or-spokes"
  | "returns"
  | "store-replenishments";

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
    layout: "narrative",
    navIconKey: "stack",
  },
  {
    slug: "sfs",
    name: "SFS",
    description: "Ship-from-store fulfillment and inventory-aware routing.",
    layout: "calculator",
    tabs: {
      defaultTab: "overview",
      allowedTabs: ["overview", "calculator"],
    },
    navIconKey: "stack",
  },
  {
    slug: "middle-mile-to-spokes",
    name: "Middle Mile to Spokes",
    description: "Linehaul movement from hubs to spoke facilities.",
    layout: "narrative",
    navIconKey: "stack",
  },
  {
    slug: "first-mile-to-hubs-or-spokes",
    name: "First Mile to Hubs/Spokes",
    description: "Initial pickup and injection into hub/spoke network.",
    layout: "narrative",
    navIconKey: "stack",
  },
  {
    slug: "returns",
    name: "Returns",
    description: "Reverse logistics processes and return-to-origin flows.",
    layout: "narrative",
    navIconKey: "stack",
  },
  {
    slug: "store-replenishments",
    name: "Store Replenishments",
    description: "Scheduled restocking from distribution centers to stores.",
    layout: "narrative",
    navIconKey: "stack",
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

