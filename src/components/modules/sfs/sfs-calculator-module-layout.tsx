import * as React from "react";

import { SfsCalculator, type SfsConfigError } from "./sfs-calculator";
import type { SfsDensityTier, SfsRateCard } from "@/lib/sfs-calculator/types";

export interface SfsCalculatorModuleLayoutProps {
  title: string;
  description: string;
  rateCards: SfsRateCard[];
  densityTiers?: SfsDensityTier[];
  /** Configuration error when table is missing or inaccessible */
  configError?: SfsConfigError | null;
  /** Admin-only warnings when using fallbacks */
  adminWarnings?: { densityTiers?: string } | null;
  /** Whether current user is admin */
  isAdmin?: boolean;
}

/**
 * Standalone SFS Calculator module layout.
 * This is a dedicated module that only shows the calculator (no tabs, no overview).
 */
export function SfsCalculatorModuleLayout({
  title,
  description,
  rateCards,
  densityTiers,
  configError,
  adminWarnings,
  isAdmin = false,
}: SfsCalculatorModuleLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Calculator */}
      <SfsCalculator
        rateCards={rateCards}
        densityTiers={densityTiers}
        configError={configError}
        adminWarnings={adminWarnings}
        isAdmin={isAdmin}
      />
    </div>
  );
}

