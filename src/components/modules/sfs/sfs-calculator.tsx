"use client";

import * as React from "react";
import { toast } from "sonner";
import Link from "next/link";
import { AlertCircle, Settings } from "lucide-react";

import { SfsCalculatorInputsPanel } from "./sfs-calculator-inputs";
import { SummaryPanel } from "./summary/SummaryPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeSfsEconomics } from "@/lib/sfs-calculator/compute";
import { validateSfsInputs } from "@/lib/sfs-calculator/validate";
import type {
  SfsCalculatorInputs,
  SfsEconomicsResult,
  SfsRateCard,
  VehicleType,
} from "@/lib/sfs-calculator/types";
import { DEFAULT_INPUTS } from "@/lib/sfs-calculator/types";
import type { SfsRateCardsErrorReason } from "@/lib/sfs-calculator/get-rate-cards";

export interface SfsConfigError {
  reason: SfsRateCardsErrorReason;
  message: string;
}

interface Props {
  rateCards: SfsRateCard[];
  /** Configuration error when table is missing or inaccessible */
  configError?: SfsConfigError | null;
  /** Whether current user is admin (for showing setup link) */
  isAdmin?: boolean;
}

function getInitialInputs(rateCards: SfsRateCard[]): SfsCalculatorInputs {
  const markets = [...new Set(rateCards.map((r) => r.market))].sort();
  const defaultMarket = markets[0] ?? "";
  const defaultVehicle: VehicleType = "Cargo Van";

  return {
    ...DEFAULT_INPUTS,
    market: defaultMarket,
    vehicle_type: defaultVehicle,
  };
}

export function SfsCalculator({ rateCards, configError, isAdmin = false }: Props) {
  const markets = React.useMemo(
    () => [...new Set(rateCards.map((r) => r.market))].sort(),
    [rateCards]
  );

  const [inputs, setInputs] = React.useState<SfsCalculatorInputs>(() =>
    getInitialInputs(rateCards)
  );

  const validationErrors = validateSfsInputs(inputs);
  const hasErrors = Object.keys(validationErrors).length > 0;

  // Find the matching rate card
  const rateCard = rateCards.find(
    (r) => r.market === inputs.market && r.vehicle_type === inputs.vehicle_type
  );

  // Compute result (or null if validation fails or no rate card)
  let result: SfsEconomicsResult | null = null;
  let error: string | undefined;

  if (!rateCard && inputs.market) {
    error = `Rate card not configured for ${inputs.market} / ${inputs.vehicle_type}`;
  } else if (rateCard && !hasErrors) {
    result = computeSfsEconomics(inputs, rateCard);
  }

  const handleReset = () => {
    setInputs(getInitialInputs(rateCards));
    toast.success("Inputs reset to defaults");
  };

  // Configuration error state (table missing, RLS, etc.)
  if (configError) {
    const title =
      configError.reason === "MISSING_TABLE"
        ? "SFS calculator isn't configured yet"
        : "Unable to load rate cards";
    const body =
      configError.reason === "MISSING_TABLE"
        ? "Rate cards table is missing or not configured. Run the migration to set up the database."
        : configError.message;

    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-amber-600">
            <AlertCircle className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{body}</p>
          {isAdmin ? (
            <Link
              href="/admin?tab=setup"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background"
            >
              <Settings className="h-3 w-3" />
              Go to Admin → Setup
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground/80">
              Contact an admin to configure rate cards.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Inputs - 7 columns on desktop */}
      <div className="order-1 lg:col-span-7">
        <SfsCalculatorInputsPanel
          inputs={inputs}
          onChange={setInputs}
          onReset={handleReset}
          markets={markets}
          validationErrors={validationErrors}
        />
      </div>

      {/* Summary - 5 columns on desktop, sticky */}
      <div className="order-2 lg:col-span-5 lg:sticky lg:top-20 lg:self-start">
        <SummaryPanel
          inputs={inputs}
          result={result}
          error={error}
          hasValidationErrors={hasErrors}
        />
      </div>
    </div>
  );
}

