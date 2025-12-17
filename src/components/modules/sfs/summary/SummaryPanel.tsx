"use client";

import * as React from "react";
import { Check, Copy, AlertCircle, AlertTriangle, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { SfsCalculatorInputs, SfsEconomicsResult } from "@/lib/sfs-calculator/types";
import { generateSummaryText } from "@/lib/sfs-calculator/format";
import { OutcomeHeroCard } from "./OutcomeHeroCard";
import { EligibilityCard } from "./EligibilityCard";
import { OperationsStatsCard } from "./OperationsStatsCard";
import { DistanceBreakdownCard } from "./DistanceBreakdownCard";

interface Props {
  inputs: SfsCalculatorInputs;
  result: SfsEconomicsResult | null;
  error?: string;
  hasValidationErrors?: boolean;
}

/**
 * Decision Panel: dashboard-style summary composing all output cards.
 * Answers: Is this good? Is it eligible? What's driving the cost?
 */
export function SummaryPanel({ inputs, result, error, hasValidationErrors }: Props) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (!result) return;
    const text = generateSummaryText(inputs, result);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Summary copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // Validation errors state
  if (hasValidationErrors) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="rounded-full bg-amber-500/15 p-3">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Input Validation Errors</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Fix the highlighted input errors to see results.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Configuration error state
  if (error) {
    const isNoRateCards = error.includes("not configured");
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="rounded-full bg-destructive/15 p-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Configuration Error</p>
            <p className="mt-1 text-xs text-destructive">{error}</p>
          </div>
          {isNoRateCards && (
            <Link
              href="/admin?tab=setup"
              className="mt-2 rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background"
            >
              Go to Admin → Setup
            </Link>
          )}
        </div>
      </div>
    );
  }

  // Empty/loading state
  if (!result) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/30 p-6">
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="h-8 w-8 animate-pulse rounded-full bg-muted/40" />
          <p className="text-sm text-muted-foreground">
            Enter route inputs to calculate economics.
          </p>
        </div>
      </div>
    );
  }

  const pickupMiles = inputs.pickup_route_miles + inputs.satellite_extra_miles;

  return (
    <div className="space-y-4">
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Route Economics</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          disabled={!result}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-[var(--warp-success-strong)]" />
              <span className="text-[var(--warp-success-strong)]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </Button>
      </div>

      {/* Decision cards - ordered by importance */}
      <div className="space-y-4">
        {/* 1. Primary: What's the outcome? */}
        <OutcomeHeroCard
          anchorCpp={result.anchor_cpp}
          blendedCpp={result.blended_cpp}
          savingsAbsolute={result.savings_absolute}
          savingsPercent={result.savings_percent}
          market={inputs.market}
          vehicleType={inputs.vehicle_type}
        />

        {/* 2. Gate: Is it eligible? */}
        <EligibilityCard inputs={inputs} result={result} />

        {/* 3. Context: What's the operational footprint? */}
        <OperationsStatsCard
          driversRequired={result.drivers_required}
          totalPackages={result.total_packages}
          totalStops={result.total_stops}
          anchorPackages={inputs.anchor_packages}
          satellitePackages={inputs.satellite_packages}
          anchorStops={inputs.anchor_stops}
          satelliteStores={inputs.satellite_stores}
        />

        {/* 4. Detail: What's driving distance? */}
        <DistanceBreakdownCard
          pickupMiles={pickupMiles}
          hubSpokeMiles={inputs.miles_to_hub_or_spoke}
          totalRouteMiles={result.total_route_miles}
        />
      </div>
    </div>
  );
}

