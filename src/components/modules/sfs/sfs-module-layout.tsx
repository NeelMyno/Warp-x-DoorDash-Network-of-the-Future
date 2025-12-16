import * as React from "react";

import { SfsTabs, type SfsTabKey } from "./sfs-tabs";
import { SfsCalculator, type SfsConfigError } from "./sfs-calculator";
import { NarrativeModuleLayout, type NarrativeModuleLayoutProps } from "../layouts/narrative-module-layout";
import type { SfsRateCard } from "@/lib/sfs-calculator/types";

export interface SfsModuleLayoutProps extends NarrativeModuleLayoutProps {
  activeTab: SfsTabKey;
  rateCards: SfsRateCard[];
  /** Configuration error when table is missing or inaccessible */
  configError?: SfsConfigError | null;
  /** Whether current user is admin (for showing setup link) */
  isAdmin?: boolean;
}

/**
 * SFS-specific module layout with Overview and Calculator tabs.
 * Overview shows the standard narrative content.
 * Calculator shows the route economics calculator.
 */
export function SfsModuleLayout({
  title,
  description,
  sections,
  activeTab,
  rateCards,
  configError,
  isAdmin = false,
}: SfsModuleLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Header with tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-[22px] font-semibold leading-[1.3] tracking-[-0.02em] text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="max-w-[60ch] text-[14px] leading-[1.65] text-muted-foreground/90">
              {description}
            </p>
          ) : null}
        </div>
        <SfsTabs value={activeTab} />
      </div>

      {/* Tab content */}
      {activeTab === "calculator" ? (
        <SfsCalculator rateCards={rateCards} configError={configError} isAdmin={isAdmin} />
      ) : (
        <NarrativeModuleLayout
          title="" // Already shown in header above
          description=""
          sections={sections}
        />
      )}
    </div>
  );
}

