import * as React from "react";

import type { ModuleRegistryEntry } from "@/lib/modules/registry";
import type { SfsRateCard } from "@/lib/sfs-calculator/types";
import type { SfsConfigError } from "../sfs/sfs-calculator";
import { NarrativeModuleLayout } from "./narrative-module-layout";
import { SfsModuleLayout } from "../sfs/sfs-module-layout";
import type { SfsTabKey } from "../sfs/sfs-tabs";

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
  /** Configuration error for calculator layouts */
  configError?: SfsConfigError | null;
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
  activeTab,
  rateCards = [],
  configError,
  isAdmin = false,
}: ResolveModuleLayoutProps): React.ReactNode {
  switch (moduleEntry.layout) {
    case "calculator":
      // Currently only SFS uses calculator layout
      return (
        <SfsModuleLayout
          title={title}
          description={description}
          sections={sections}
          activeTab={(activeTab ?? "overview") as SfsTabKey}
          rateCards={rateCards}
          configError={configError}
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

