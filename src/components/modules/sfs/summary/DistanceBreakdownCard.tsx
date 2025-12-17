"use client";

import * as React from "react";
import { Route } from "lucide-react";
import { formatNumber } from "@/lib/sfs-calculator/format";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getGlossary } from "./glossary";

interface Props {
  pickupMiles: number;
  hubSpokeMiles: number;
  totalRouteMiles: number;
}

/**
 * Card showing distance breakdown as a stacked horizontal bar with legend.
 */
export function DistanceBreakdownCard({
  pickupMiles,
  hubSpokeMiles,
  totalRouteMiles,
}: Props) {
  const total = pickupMiles + hubSpokeMiles;
  const pickupPercent = total > 0 ? (pickupMiles / total) * 100 : 50;
  const hubPercent = total > 0 ? (hubSpokeMiles / total) * 100 : 50;

  const pickupGloss = getGlossary("pickup_miles");
  const hubGloss = getGlossary("hub_spoke_miles");
  const totalGloss = getGlossary("total_route_miles");

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-5">
      {/* Section header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Distance Breakdown
          </h3>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help text-sm font-bold tabular-nums text-foreground">
                {formatNumber(totalRouteMiles, 1)} mi
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[200px]">
              <p className="font-medium">{totalGloss.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{totalGloss.body}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Stacked bar */}
      <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full bg-border/60">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="h-full cursor-help transition-all duration-300"
                style={{
                  width: `${pickupPercent}%`,
                  backgroundColor: "var(--warp-viz-pickup-fill)",
                }}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <p className="font-medium">{pickupGloss.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{pickupGloss.body}</p>
              <p className="mt-1 border-t border-border/40 pt-1 text-[10px] tabular-nums text-muted-foreground">
                {formatNumber(pickupMiles, 1)} mi ({pickupPercent.toFixed(0)}%)
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="h-full cursor-help transition-all duration-300"
                style={{
                  width: `${hubPercent}%`,
                  backgroundColor: "var(--warp-viz-hubspoke-fill)",
                }}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <p className="font-medium">{hubGloss.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{hubGloss.body}</p>
              <p className="mt-1 border-t border-border/40 pt-1 text-[10px] tabular-nums text-muted-foreground">
                {formatNumber(hubSpokeMiles, 1)} mi ({hubPercent.toFixed(0)}%)
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-[11px]">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: "var(--warp-viz-pickup-fill)" }}
          />
          <span className="text-muted-foreground">Pickup</span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatNumber(pickupMiles, 1)} mi
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: "var(--warp-viz-hubspoke-fill)" }}
          />
          <span className="text-muted-foreground">Hub/Spoke</span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatNumber(hubSpokeMiles, 1)} mi
          </span>
        </div>
      </div>

      {/* Interpretation */}
      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Route distance composition based on pickup and transit segments.
      </p>
    </div>
  );
}

