import * as React from "react";

import { SfsCalculatorV2, type SfsConfigError } from "@/components/modules/sfs-calculator";
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
  rateCards,
  densityTiers,
  configError,
  adminWarnings,
  isAdmin = false,
}: SfsCalculatorModuleLayoutProps) {
  return (
    <SfsCalculatorV2
      rateCards={rateCards}
      densityTiers={densityTiers}
      configError={configError}
      adminWarnings={adminWarnings}
      isAdmin={isAdmin}
    />
  );
}

