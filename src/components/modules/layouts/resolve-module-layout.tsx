import * as React from "react";

import type { ModuleRegistryEntry } from "@/lib/modules/registry";
import type { SfsDensityTier, SfsRateCard } from "@/lib/sfs-calculator/types";
import type { SfsConfigError } from "../sfs/sfs-calculator";
import { NarrativeModuleLayout } from "./narrative-module-layout";
import { SfsCalculatorModuleLayout } from "../sfs/sfs-calculator-module-layout";

export interface ModuleSection {
  key: string;
  label: string;
  isEmpty: boolean;
  content: React.ReactNode;
}

export interface ResolveModuleLayoutProps {
  moduleEntry: ModuleRegistryEntry;
  title: string;
  description: string;
  sections: ModuleSection[];
  /** Active tab for calculator layouts */
  activeTab?: string;
  /** Rate cards for SFS calculator */
  rateCards?: SfsRateCard[];
  /** Density tiers for SFS calculator */
  densityTiers?: SfsDensityTier[];
  /** Configuration error for calculator layouts */
  configError?: SfsConfigError | null;
  /** Admin-only warnings when using fallbacks */
  adminWarnings?: { densityTiers?: string } | null;
  /** Whether current user is admin */
  isAdmin?: boolean;
}

/**
 * Resolves and renders the appropriate layout component based on module configuration.
 * This abstraction allows adding new layout types without modifying the page component.
 */
export function resolveModuleLayout({
  moduleEntry,
  title,
  description,
  sections,
  rateCards = [],
  densityTiers,
  configError,
  adminWarnings,
  isAdmin = false,
}: ResolveModuleLayoutProps): React.ReactNode {
  switch (moduleEntry.layout) {
    case "calculator":
      // SFS Calculator standalone module
      return (
        <SfsCalculatorModuleLayout
          title={title}
          description={description}
          rateCards={rateCards}
          densityTiers={densityTiers}
          configError={configError}
          adminWarnings={adminWarnings}
          isAdmin={isAdmin}
        />
      );

    case "narrative":
    default:
      return (
        <NarrativeModuleLayout
          title={title}
          description={description}
          sections={sections}
        />
      );
  }
}
