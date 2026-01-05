"use client";

import * as React from "react";
import { Sparkles, TrendingDown } from "lucide-react";

import { formatCurrency, formatPercent } from "@/lib/sfs-calculator/format";
import { Badge } from "@/components/ui/badge";

export function PricingSummaryCards(props: {
  regularCpp: number;
  regularCost: number;
  discountedCpp: number;
  discountedCost: number;
  weightedDiscountPct: number;
  savingsDollars: number;
  savingsPct: number;
}) {
  const {
    regularCpp,
    regularCost,
    discountedCpp,
    discountedCost,
    weightedDiscountPct,
    savingsDollars,
    savingsPct,
  } = props;

  const hasSavings = savingsDollars > 0 && Number.isFinite(savingsDollars);

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="rounded-xl border border-border bg-background/10 p-4">
        <div className="text-xs text-muted-foreground">Regular cost (no density)</div>
        <div className="mt-1 tabular-nums text-2xl font-semibold tracking-tight text-foreground">
          {formatCurrency(regularCpp)}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Total: <span className="tabular-nums text-foreground/90">{formatCurrency(regularCost)}</span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background/10 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">With density discount</div>
          <Badge variant="accent" className="text-[11px]">
            <Sparkles className="mr-1 h-3 w-3" />
            {formatPercent(weightedDiscountPct)}
          </Badge>
        </div>
        <div className="mt-1 tabular-nums text-2xl font-semibold tracking-tight text-foreground">
          {formatCurrency(discountedCpp)}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Total: <span className="tabular-nums text-foreground/90">{formatCurrency(discountedCost)}</span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background/10 p-4">
        <div className="text-xs text-muted-foreground">Savings from density</div>
        <div className="mt-1 flex items-baseline gap-2">
          <div className="tabular-nums text-2xl font-semibold tracking-tight text-foreground">
            {formatCurrency(savingsDollars)}
          </div>
          <div className="tabular-nums text-xs text-muted-foreground">
            {formatPercent(savingsPct)}
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {hasSavings ? (
            <span className="inline-flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5 text-[var(--warp-success-strong)]" />
              Your discount is driven by nearby stores in higher tiers.
            </span>
          ) : (
            "No density savings detected with current store mix."
          )}
        </div>
      </div>
    </div>
  );
}

