"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, HelpCircle } from "lucide-react";

import type { SfsTierDistributionRow } from "@/lib/sfs-calculator/impact";
import { formatPercent } from "@/lib/sfs-calculator/format";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const TIER_COLORS = [
  "var(--warp-success-strong)", // ≤10 mi - best discount
  "var(--warp-accent)",         // 10-20 mi
  "var(--warp-warning)",        // 20-30 mi
  "#6b7280",                    // >30 mi - no discount
];

export function TierBreakdownCard(props: {
  tiers: SfsTierDistributionRow[];
  weightedDiscountPct: number;
  /** Whether to start collapsed (default: true) */
  defaultCollapsed?: boolean;
}) {
  const { tiers, weightedDiscountPct, defaultCollapsed = true } = props;
  const [isExpanded, setIsExpanded] = React.useState(!defaultCollapsed);

  const hasSatellites = tiers.some((t) => t.satellitePackages > 0);

  // Build bar segments
  const segments = tiers.map((tier, idx) => ({
    label: tier.label,
    discountPct: tier.discountPct,
    share: tier.satelliteShare,
    color: TIER_COLORS[idx] ?? "#6b7280",
    packages: tier.satellitePackages,
  }));

  return (
    <div className="rounded-xl border border-border bg-background/10">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between gap-2 p-4 text-left hover:bg-background/5"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <div>
            <div className="text-sm font-medium text-foreground">Why this discount?</div>
            {!isExpanded && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                Weighted discount: <span className="font-mono font-medium text-foreground">{formatPercent(weightedDiscountPct)}</span>
              </div>
            )}
          </div>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <HelpCircle className="h-4 w-4" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[280px]">
              <p className="text-xs">
                <strong>Weighted discount</strong> = Σ(tier share × tier discount).
                Closer stores get higher discounts, reducing your blended CPP.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="border-t border-border/60 px-4 pb-4 pt-3">
          {!hasSatellites ? (
            <div className="rounded-lg border border-border/60 bg-background/5 px-4 py-3 text-center text-xs text-muted-foreground">
              No satellites — no density discount applies.
            </div>
          ) : (
            <>
              <div className="text-xs text-muted-foreground">
                Discount is weighted by where your satellite packages fall across distance tiers.
              </div>

              {/* Legend */}
              <div className="mt-3 flex flex-wrap gap-3 text-[10px]">
                {segments.map((seg) => (
                  <div key={seg.label} className="flex items-center gap-1.5">
                    <div
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="text-muted-foreground">
                      {seg.label} <span className="font-medium text-foreground">({formatPercent(seg.discountPct)})</span>
                    </span>
                  </div>
                ))}
              </div>

              {/* Weighted discount */}
              <div className="mt-4 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <span className="text-xs text-muted-foreground">Weighted density discount</span>
                <span className="font-mono text-sm font-semibold text-foreground">
                  {formatPercent(weightedDiscountPct)}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

