"use client";

/**
 * @deprecated Use CostBreakdownCard instead. This component is no longer used
 * in the V2 calculator UI and will be removed in a future release.
 */

import * as React from "react";

import { formatCurrency } from "@/lib/sfs-calculator/format";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CostBreakdownVizProps {
  baseCostRegular: number;
  baseCostWithDensity: number;
  stopFees: number;
  totalCostRegular: number;
  totalCostWithDensity: number;
  savingsDollars: number;
}

export function CostBreakdownViz({
  baseCostRegular,
  baseCostWithDensity,
  stopFees,
  totalCostRegular,
  totalCostWithDensity,
  savingsDollars,
}: CostBreakdownVizProps) {
  // Calculate percentages for bar widths
  const maxTotal = Math.max(totalCostRegular, totalCostWithDensity, 1);

  const regularBaseWidth = (baseCostRegular / maxTotal) * 100;
  const regularStopWidth = (stopFees / maxTotal) * 100;

  const densityBaseWidth = (baseCostWithDensity / maxTotal) * 100;
  const densityStopWidth = (stopFees / maxTotal) * 100;

  return (
    <div className="rounded-xl border border-border bg-background/10 p-4">
      <div className="text-xs font-medium text-foreground">Cost breakdown</div>

      <div className="mt-4 space-y-3">
        {/* Regular total bar */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Regular total</span>
            <span className="tabular-nums text-foreground/70">
              {formatCurrency(totalCostRegular)}
            </span>
          </div>
          <div className="flex h-6 w-full overflow-hidden rounded-md bg-background/20">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex h-full items-center justify-center bg-foreground/20 text-[9px] font-medium text-foreground/70 transition-all hover:bg-foreground/30"
                  style={{ width: `${regularBaseWidth}%` }}
                >
                  {regularBaseWidth > 15 ? "Base" : ""}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Base cost: {formatCurrency(baseCostRegular)}
                </p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex h-full items-center justify-center bg-amber-500/40 text-[9px] font-medium text-amber-200 transition-all hover:bg-amber-500/50"
                  style={{ width: `${regularStopWidth}%` }}
                >
                  {regularStopWidth > 15 ? "Stops" : ""}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Stop fees: {formatCurrency(stopFees)}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* With density bar */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">With density</span>
            <span className="tabular-nums font-medium text-foreground">
              {formatCurrency(totalCostWithDensity)}
            </span>
          </div>
          <div className="flex h-6 w-full overflow-hidden rounded-md bg-background/20">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex h-full items-center justify-center bg-primary/30 text-[9px] font-medium text-primary transition-all hover:bg-primary/40"
                  style={{ width: `${densityBaseWidth}%` }}
                >
                  {densityBaseWidth > 15 ? "Base" : ""}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Base (discounted): {formatCurrency(baseCostWithDensity)}
                </p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex h-full items-center justify-center bg-amber-500/40 text-[9px] font-medium text-amber-200 transition-all hover:bg-amber-500/50"
                  style={{ width: `${densityStopWidth}%` }}
                >
                  {densityStopWidth > 15 ? "Stops" : ""}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Stop fees (unchanged): {formatCurrency(stopFees)}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Savings badge */}
      {savingsDollars > 0 && (
        <div className="mt-3 flex items-center justify-end">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--warp-success-soft)] px-3 py-1">
            <span className="text-[11px] text-[var(--warp-success-strong)]">
              Savings
            </span>
            <span className="tabular-nums text-sm font-semibold text-[var(--warp-success-strong)]">
              {formatCurrency(savingsDollars)}
            </span>
          </div>
        </div>
      )}

      {/* Stop fees note */}
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-sm bg-amber-500/50" />
        Stop fees unchanged by density discounts
      </div>
    </div>
  );
}

