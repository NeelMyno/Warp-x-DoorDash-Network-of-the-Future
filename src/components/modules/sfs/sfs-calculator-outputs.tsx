"use client";

import * as React from "react";
import { Check, Copy, TrendingDown, TrendingUp, AlertCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SfsCalculatorInputs, SfsEconomicsResult } from "@/lib/sfs-calculator/types";
import { formatCurrency, formatPercent, formatNumber, generateSummaryText } from "@/lib/sfs-calculator/format";

interface Props {
  inputs: SfsCalculatorInputs;
  result: SfsEconomicsResult | null;
  error?: string;
  hasValidationErrors?: boolean;
}

interface StatRowProps {
  label: string;
  value: string | React.ReactNode;
  highlight?: boolean;
  muted?: boolean;
}

function StatRow({ label, value, highlight, muted }: StatRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1.5">
      <span className={muted ? "text-xs text-muted-foreground/70" : "text-xs text-muted-foreground"}>
        {label}
      </span>
      <span
        className={
          highlight
            ? "text-sm font-semibold text-primary"
            : muted
              ? "text-sm text-muted-foreground"
              : "text-sm font-medium text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

/** Get density eligibility reason when not eligible */
function getDensityIneligibilityReason(inputs: SfsCalculatorInputs, result: SfsEconomicsResult): string | null {
  if (result.density_eligible) return null;
  if (inputs.pickup_window_minutes > 120) return "Pickup window > 120 min";
  if (result.avg_satellite_distance > inputs.max_satellite_miles_allowed) return "Satellite distance too far";
  if (inputs.satellite_packages > inputs.max_satellite_packages_allowed) return "Too many satellite packages";
  return "Thresholds not met";
}

export function SfsCalculatorOutputs({ inputs, result, error, hasValidationErrors }: Props) {
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
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <p className="text-sm text-muted-foreground">Fix input errors to see results.</p>
        </CardContent>
      </Card>
    );
  }

  // Configuration error state
  if (error) {
    const isNoRateCards = error.includes("not configured");
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertCircle className="h-4 w-4" />
            Configuration Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-destructive/80">{error}</p>
          {isNoRateCards && (
            <Link
              href="/admin?tab=setup"
              className="inline-block text-xs text-muted-foreground underline hover:text-foreground"
            >
              Go to Admin → Setup
            </Link>
          )}
        </CardContent>
      </Card>
    );
  }

  // Empty/loading state
  if (!result) {
    return (
      <Card className="border-border/60 bg-card/50">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">Enter packages to calculate.</p>
        </CardContent>
      </Card>
    );
  }

  const pickupMiles = inputs.pickup_route_miles + inputs.satellite_extra_miles;
  const savingsPositive = result.savings_absolute > 0;
  const ineligibilityReason = getDensityIneligibilityReason(inputs, result);

  return (
    <Card className="border-border/60 bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium">Route Economics Summary</CardTitle>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 text-xs" disabled={!result}>
          {copied ? (
            <>
              <Check className="mr-1.5 h-3 w-3 text-primary" />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-1.5 h-3 w-3" />
              Copy
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key metrics */}
        <div className="rounded-lg border border-border/50 bg-background/30 p-3">
          <StatRow label="Market" value={inputs.market} />
          <StatRow label="Vehicle Type" value={inputs.vehicle_type} />
          <div className="my-2 border-t border-border/30" />
          <StatRow label="Anchor CPP" value={formatCurrency(result.anchor_cpp)} />
          <StatRow label="Blended CPP" value={formatCurrency(result.blended_cpp)} highlight />
          <StatRow
            label="CPP Improvement"
            value={
              <span className="flex items-center gap-1">
                {savingsPositive ? (
                  <TrendingDown className="h-3 w-3 text-primary" />
                ) : (
                  <TrendingUp className="h-3 w-3 text-destructive" />
                )}
                {formatCurrency(result.savings_absolute)} ({formatPercent(result.savings_percent)})
              </span>
            }
            highlight={savingsPositive}
          />
        </div>

        {/* Density eligibility */}
        <div className="space-y-1">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
            Density Eligibility
          </h4>
          <div className="rounded-lg border border-border/50 bg-background/30 p-3">
            <div className="flex items-center justify-between gap-2 py-1">
              <span className="text-xs text-muted-foreground">Status</span>
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    result.density_eligible ? "bg-primary" : "bg-amber-500"
                  }`}
                />
                {result.density_eligible ? "Eligible" : "Not Eligible"}
              </span>
            </div>
            {ineligibilityReason && (
              <p className="mt-1 text-[10px] text-amber-600">{ineligibilityReason}</p>
            )}
          </div>
        </div>

        {/* Operational metrics */}
        <div className="space-y-1">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
            Operations
          </h4>
          <div className="rounded-lg border border-border/50 bg-background/30 p-3">
            <StatRow label="Drivers Required" value={formatNumber(result.drivers_required)} />
            <StatRow label="Total Packages" value={formatNumber(result.total_packages)} />
            <StatRow label="Total Stops" value={formatNumber(result.total_stops)} />
          </div>
        </div>

        {/* Distance metrics */}
        <div className="space-y-1">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
            Distance
          </h4>
          <div className="rounded-lg border border-border/50 bg-background/30 p-3">
            <StatRow label="Pickup Miles" value={`${formatNumber(pickupMiles, 1)} mi`} />
            <StatRow label="Hub/Spoke Miles" value={`${formatNumber(inputs.miles_to_hub_or_spoke, 1)} mi`} />
            <StatRow label="Total Route Miles" value={`${formatNumber(result.total_route_miles, 1)} mi`} muted />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

