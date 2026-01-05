"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";

import type { SfsSatelliteImpactSummary } from "@/lib/sfs-calculator/impact";
import type { SfsAnchorResult, SfsCalculatorInputs } from "@/lib/sfs-calculator/types";
import { formatCurrency, formatPercent, generateSalesSummaryText } from "@/lib/sfs-calculator/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { DensityDiscountInfoPopover } from "@/components/modules/sfs-calculator/DensityDiscountInfoPopover";
import { CostBreakdownCard } from "@/components/modules/sfs-calculator/CostBreakdownCard";

export function AnchorSummaryPanel(props: {
  inputs: SfsCalculatorInputs;
  result: SfsAnchorResult;
  summary: SfsSatelliteImpactSummary;
}) {
  const { inputs, result, summary } = props;
  const [storeDetailsOpen, setStoreDetailsOpen] = React.useState(false);

  const hasSavings = summary.savings_dollars > 0;

  const handleCopy = () => {
    const text = generateSalesSummaryText({ inputs, selected: result, summary });
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div data-tour="summary" className="space-y-4">
      {/* Outcome Card */}
      <div className="rounded-xl border border-border bg-background/10 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Anchor Store
            </div>
            <div className="mt-0.5 text-lg font-semibold text-foreground">
              {result.anchor_id}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
        </div>

        {/* Big CPP display */}
        <div className="mt-5 flex items-end gap-6">
          <div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              With density CPP
              <DensityDiscountInfoPopover weightedDiscountPct={summary.weighted_discount_pct} />
            </div>
            <div className="mt-1 tabular-nums text-3xl font-bold tracking-tight text-foreground">
              {formatCurrency(summary.discounted_blended_cpp)}
            </div>
          </div>
          <div className="pb-1">
            <div className="text-xs text-muted-foreground">Regular CPP</div>
            <div className="mt-1 tabular-nums text-lg text-foreground/60 line-through">
              {formatCurrency(summary.regular_blended_cpp)}
            </div>
          </div>
        </div>

        {/* Savings badge */}
        <div className="mt-4">
          {hasSavings ? (
            <Badge variant="accent" className="gap-1.5 px-3 py-1.5 text-sm">
              <Sparkles className="h-4 w-4" />
              You save {formatCurrency(summary.savings_dollars)} ({formatPercent(summary.savings_pct)})
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              No density savings with current store mix
            </Badge>
          )}
        </div>

        {/* Helper text */}
        <div className="mt-4 text-xs text-muted-foreground">
          Density discounts apply to base cost only. Stop fees are unchanged.
        </div>
      </div>

      {/* Cost Breakdown Card */}
      <CostBreakdownCard
        baseCostRegular={result.base_portion_before_density}
        baseCostWithDensity={result.base_portion_after_density}
        stopFees={result.stop_fees_total}
        totalCostRegular={summary.regular_blended_cost}
        totalCostWithDensity={summary.discounted_blended_cost}
        savingsDollars={summary.savings_dollars}
        weightedDiscountPct={summary.weighted_discount_pct}
      />

      {/* Per-store details disclosure */}
      <div>
        <button
          type="button"
          onClick={() => setStoreDetailsOpen(!storeDetailsOpen)}
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-background/10 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-background/15"
          aria-expanded={storeDetailsOpen}
        >
          {storeDetailsOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          See per-store details ({summary.impacts.length} satellites)
        </button>

        {storeDetailsOpen && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-border/60 bg-background/10">
            <table className="w-full text-xs">
              <thead className="border-b border-border/60 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Store</th>
                  <th className="px-3 py-2 text-right">Packages</th>
                  <th className="px-3 py-2 text-right">Distance</th>
                  <th className="px-3 py-2">Tier</th>
                  <th className="px-3 py-2 text-right">Discount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {summary.impacts.map((impact, idx) => (
                  <tr key={`${impact.store_id}-${idx}`} className="text-foreground/90">
                    <td className="px-3 py-2 font-medium">{impact.store_name || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{impact.packages}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {impact.distance_to_anchor_miles > 0
                        ? `${impact.distance_to_anchor_miles.toFixed(1)} mi`
                        : "—"}
                    </td>
                    <td className="px-3 py-2">{impact.tier_label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {impact.tier_discount_pct > 0 ? formatPercent(impact.tier_discount_pct) : "0%"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

