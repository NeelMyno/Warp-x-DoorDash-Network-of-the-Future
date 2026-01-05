"use client";

import * as React from "react";
import { Info, ChevronRight } from "lucide-react";

import { formatCurrency, formatPercent } from "@/lib/sfs-calculator/format";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CostBreakdownCardProps {
  baseCostRegular: number;
  baseCostWithDensity: number;
  stopFees: number;
  totalCostRegular: number;
  totalCostWithDensity: number;
  savingsDollars: number;
  weightedDiscountPct: number;
}

/** KPI tile sub-component with consistent height */
function KpiTile({
  label,
  value,
  helper,
  variant = "default",
}: {
  label: string;
  value: string;
  helper?: string;
  variant?: "default" | "primary" | "success";
}) {
  const tileStyles = {
    default: "border-border/40 bg-muted/[0.03]",
    primary: "border-primary/20 bg-primary/[0.04]",
    success: "border-border/40 bg-muted/[0.03]",
  };

  const valueStyles = {
    default: "text-foreground/60",
    primary: "text-foreground",
    success: "text-[var(--warp-success-strong)]",
  };

  return (
    <div
      className={`flex min-h-[72px] flex-col justify-between rounded-lg border px-3 py-2.5 transition-colors duration-100 hover:bg-muted/[0.06] ${tileStyles[variant]}`}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
        {label}
      </span>
      <div className="mt-auto">
        <span
          className={`block whitespace-nowrap text-xl font-semibold tabular-nums leading-tight ${valueStyles[variant]}`}
        >
          {value}
        </span>
        {helper && (
          <span className="mt-0.5 block truncate text-[10px] tabular-nums text-muted-foreground/70">
            {helper}
          </span>
        )}
      </div>
    </div>
  );
}

export function CostBreakdownCard({
  baseCostRegular,
  baseCostWithDensity,
  stopFees,
  totalCostRegular,
  totalCostWithDensity,
  savingsDollars,
  weightedDiscountPct,
}: CostBreakdownCardProps) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const hasSavings = savingsDollars > 0;
  const baseSavings = baseCostRegular - baseCostWithDensity;
  const discountMuted = weightedDiscountPct <= 0;

  return (
    <div className="rounded-xl border border-border/50 bg-background/[0.03] px-4 py-3">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground/90">Cost summary</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Explain density discount"
              className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11px] transition-colors ${
                discountMuted
                  ? "border-border/40 bg-muted/10 text-muted-foreground hover:bg-muted/20"
                  : "border-primary/20 bg-primary/[0.08] text-primary hover:bg-primary/[0.12]"
              }`}
            >
              <span className="tabular-nums">
                {discountMuted ? "0%" : formatPercent(weightedDiscountPct)}
              </span>
              <Info className="h-3 w-3 opacity-50" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end" className="max-w-[220px] p-3">
            <p className="text-[11px] font-medium text-foreground">
              How density savings work
            </p>
            <ul className="mt-1.5 space-y-1 text-[10px] text-muted-foreground">
              <li>• Base cost is discounted. Stop fees unchanged.</li>
              <li>• Discount based on satellite distance tier.</li>
            </ul>
            <p className="mt-2 text-[10px] tabular-nums text-muted-foreground/80">
              0–10mi: 5% · 10–20mi: 4% · 20–30mi: 3% · 30+: 0%
            </p>
            <p className="mt-1.5 text-[10px]">
              <span className="text-muted-foreground">Your weighted discount: </span>
              <span className="tabular-nums font-medium text-foreground">
                {formatPercent(weightedDiscountPct)}
              </span>
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* KPI tiles grid */}
      <div
        className={`mt-3 grid gap-2 ${
          hasSavings ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"
        }`}
      >
        <KpiTile label="Regular" value={formatCurrency(totalCostRegular)} />
        {hasSavings && (
          <KpiTile
            label="Savings"
            value={formatCurrency(savingsDollars)}
            helper={`${formatCurrency(totalCostRegular)} → ${formatCurrency(totalCostWithDensity)}`}
            variant="success"
          />
        )}
        <KpiTile
          label="With density"
          value={formatCurrency(totalCostWithDensity)}
          variant="primary"
        />
      </div>

      {/* No savings helper */}
      {!hasSavings && (
        <p className="mt-2 text-[10px] text-muted-foreground/70">
          No density savings for this route.
        </p>
      )}

      {/* Details disclosure */}
      <div className="mt-2.5 border-t border-border/30 pt-2">
        <button
          type="button"
          onClick={() => setDetailsOpen(!detailsOpen)}
          className="group inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground/80"
          aria-expanded={detailsOpen}
          aria-controls="cost-breakdown-details"
        >
          <ChevronRight
            className={`h-3 w-3 transition-transform duration-100 ${
              detailsOpen ? "rotate-90" : ""
            }`}
          />
          <span>Details</span>
        </button>

        <div
          id="cost-breakdown-details"
          className={`grid transition-all duration-100 ease-out ${
            detailsOpen ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="space-y-1 pb-0.5 text-[11px]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground/80">Base</span>
                <span className="whitespace-nowrap tabular-nums text-foreground/90">
                  {formatCurrency(baseCostRegular)} → {formatCurrency(baseCostWithDensity)}
                  {hasSavings && (
                    <span className="ml-1 text-[var(--warp-success-strong)]">
                      (−{formatCurrency(baseSavings)})
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground/80">Stop fees</span>
                <span className="whitespace-nowrap tabular-nums text-foreground/90">
                  {formatCurrency(stopFees)}
                  <span className="ml-1 text-muted-foreground/50">(unchanged)</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

