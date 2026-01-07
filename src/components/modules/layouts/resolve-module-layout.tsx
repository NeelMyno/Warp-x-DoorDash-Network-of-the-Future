import * as React from "react";

import type { ContentBlock } from "@/config/modules";
import type { ModuleRegistryEntry } from "@/lib/modules/registry";
import type { SfsDensityTier, SfsRateCard } from "@/lib/sfs-calculator/types";
import type { SfsConfigError } from "../sfs/sfs-calculator";
import { FullBleedSingleSectionLayout } from "./full-bleed-single-section-layout";
import { NarrativeModuleLayout } from "./narrative-module-layout";
import { PdfModuleLayout } from "./pdf-module-layout";
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
  /** All content blocks (for PDF layout) */
  allBlocks?: ContentBlock[];
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
  allBlocks = [],
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

    case "pdf":
      // PDF-only module (e.g., Automated Hubs)
      return (
        <PdfModuleLayout
          title={title}
          description={description}
          blocks={allBlocks}
          moduleSlug={moduleEntry.slug}
          isAdmin={isAdmin}
        />
      );

    case "full_bleed_single_section":
      // Full-width single section layout (e.g., Year in Review)
      // Renders only the specified section without card wrapper
      return (
        <FullBleedSingleSectionLayout
          title={title}
          description={description}
          sections={sections}
          isAdmin={isAdmin}
          primarySectionKey={moduleEntry.primarySectionKey}
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
