"use client";

import * as React from "react";

import type { SfsDensityTier } from "@/lib/sfs-calculator/types";
import { formatPercent } from "@/lib/sfs-calculator/format";
import { formatTierLabel } from "@/lib/sfs-calculator/density";
import { Badge } from "@/components/ui/badge";

export function DiscountTierLegend(props: {
  tiers: SfsDensityTier[];
  isAdmin?: boolean;
  usingFallback?: boolean;
}) {
  const { tiers, isAdmin = false, usingFallback = false } = props;

  const ordered = React.useMemo(() => {
    return [...tiers].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [tiers]);

  if (!ordered.length) return null;

  return (
    <div className="rounded-xl border border-border bg-background/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">Density discount tiers</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Nearby stores are cheaper. Farther stores get less discount.
          </div>
        </div>
        {isAdmin && usingFallback ? (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            Using default tiers
          </Badge>
        ) : null}
      </div>

      <div
        className="mt-3 grid overflow-hidden rounded-lg border border-border/60 bg-background/10"
        style={{ gridTemplateColumns: `repeat(${ordered.length}, minmax(0, 1fr))` }}
        aria-label="Density discount tiers"
      >
        {ordered.map((t, idx) => {
          const label = t.label?.trim() ? t.label : formatTierLabel(t);
          const isLast = idx === ordered.length - 1;
          return (
            <div
              key={t.sortOrder}
              className={[
                "px-3 py-2",
                !isLast ? "border-r border-border/60" : "",
                "flex flex-col gap-0.5",
              ].join(" ")}
            >
              <div className="text-[11px] font-medium text-foreground">{label}</div>
              <div className="text-[11px] font-mono text-muted-foreground">
                {formatPercent(t.discountPct)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

