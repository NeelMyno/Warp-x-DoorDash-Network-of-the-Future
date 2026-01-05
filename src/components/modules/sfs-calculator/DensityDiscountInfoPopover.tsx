"use client";

import * as React from "react";
import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatPercent } from "@/lib/sfs-calculator/format";

/**
 * Current tier configuration: 5/4/3/0 discount percentages
 * These values must match the backend tier config
 */
const TIER_CONFIG = [
  { label: "≤10 mi", discount: 0.05, color: "var(--warp-success-strong)" },
  { label: "10–20 mi", discount: 0.04, color: "var(--warp-accent)" },
  { label: "20–30 mi", discount: 0.03, color: "var(--warp-warning)" },
  { label: ">30 mi", discount: 0, color: "#6b7280" },
];

interface DensityDiscountInfoPopoverProps {
  weightedDiscountPct: number;
}

export function DensityDiscountInfoPopover({
  weightedDiscountPct,
}: DensityDiscountInfoPopoverProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-background/20 hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[300px] p-3">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Discount is weighted by where satellite packages fall across
            distance tiers. Stop fees are never discounted.
          </p>

          {/* Tier legend */}
          <div className="flex flex-wrap gap-2">
            {TIER_CONFIG.map((tier) => (
              <div
                key={tier.label}
                className="flex items-center gap-1.5 text-[11px]"
              >
                <div
                  className="h-2 w-2 rounded-sm"
                  style={{ backgroundColor: tier.color }}
                />
                <span className="text-muted-foreground">{tier.label}</span>
                <span className="font-medium text-foreground">
                  {formatPercent(tier.discount)}
                </span>
              </div>
            ))}
          </div>

          {/* Weighted discount result */}
          <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5">
            <span className="text-[11px] text-muted-foreground">
              Weighted discount
            </span>
            <span className="tabular-nums text-xs font-semibold text-foreground">
              {formatPercent(weightedDiscountPct)}
            </span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

