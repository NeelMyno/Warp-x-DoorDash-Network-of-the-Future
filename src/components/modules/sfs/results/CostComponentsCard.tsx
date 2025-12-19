"use client";

import * as React from "react";
import { ArrowRight, HelpCircle } from "lucide-react";

import { formatCurrency } from "@/lib/sfs-calculator/format";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function CostComponentsCard(props: {
  baseCostRegular: number;
  baseCostWithDensity: number;
  stopFees: number;
  totalCostRegular: number;
  totalCostWithDensity: number;
  savingsDollars: number;
}) {
  const {
    baseCostRegular,
    baseCostWithDensity,
    stopFees,
    totalCostRegular,
    totalCostWithDensity,
    savingsDollars,
  } = props;

  const tiles = [
    {
      label: "Base cost (regular)",
      value: baseCostRegular,
      tooltip: "Base fee + mileage before any density discount.",
    },
    {
      label: "Base cost (after density)",
      value: baseCostWithDensity,
      tooltip: "Base portion after applying the weighted density discount.",
    },
    {
      label: "Stop fees",
      value: stopFees,
      tooltip: "Per-stop fees for satellite stores. Unchanged by density discounts.",
      highlight: true,
    },
    {
      label: "Total (with density)",
      value: totalCostWithDensity,
      tooltip: "Base cost (after density) + stop fees = your route cost.",
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-background/10 p-5">
      <div className="text-sm font-medium text-foreground">Cost breakdown</div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        How your route cost is calculated.
      </div>

      {/* Tiles grid */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <TooltipProvider key={tile.label}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={[
                    "rounded-lg border px-3 py-2.5",
                    tile.highlight
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-border/60 bg-background/5",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    {tile.label}
                    <HelpCircle className="h-3 w-3" />
                  </div>
                  <div className="mt-1 font-mono text-sm font-semibold text-foreground">
                    {formatCurrency(tile.value)}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{tile.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>

      {/* Before/after row */}
      <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-background/5 px-4 py-3">
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground">Total (regular)</div>
          <div className="mt-0.5 font-mono text-sm text-foreground/70">
            {formatCurrency(totalCostRegular)}
          </div>
        </div>

        <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />

        <div className="text-center">
          <div className="text-[10px] text-muted-foreground">Total (with density)</div>
          <div className="mt-0.5 font-mono text-sm font-semibold text-foreground">
            {formatCurrency(totalCostWithDensity)}
          </div>
        </div>

        <div className="ml-2 rounded-lg border border-[var(--warp-success-strong)]/30 bg-[var(--warp-success-soft)] px-2.5 py-1.5 text-center">
          <div className="text-[10px] text-[var(--warp-success-strong)]">Savings</div>
          <div className="font-mono text-sm font-semibold text-[var(--warp-success-strong)]">
            {savingsDollars > 0 ? formatCurrency(savingsDollars) : "$0.00"}
          </div>
        </div>
      </div>

      {/* Stop fees note */}
      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-sm bg-amber-500/50" />
        Stop fees are unchanged by density discounts.
      </div>
    </div>
  );
}

