"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { SfsSatelliteImpact } from "@/lib/sfs-calculator/impact";
import { formatCurrency, formatNumber } from "@/lib/sfs-calculator/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type SortKey = "distance" | "savings";

export function SatelliteImpactTable(props: {
  impacts: SfsSatelliteImpact[];
  title?: string;
}) {
  const { impacts, title = "Satellite impact" } = props;

  const [sortKey, setSortKey] = React.useState<SortKey>("distance");
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const rows = React.useMemo(() => {
    const sorted = [...impacts];
    if (sortKey === "distance") {
      sorted.sort((a, b) => a.distance_to_anchor_miles - b.distance_to_anchor_miles);
    } else {
      sorted.sort((a, b) => b.incremental_savings - a.incremental_savings);
    }
    return sorted;
  }, [impacts, sortKey]);

  if (!impacts.length) {
    return (
      <div className="rounded-xl border border-border bg-background/10 p-4">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="mt-3 rounded-lg border border-border/60 bg-background/10 p-4 text-center text-xs text-muted-foreground">
          No satellite stores found for this anchor.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-background/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-foreground">{title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Incremental savings estimates how much each satellite contributes to density savings.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={sortKey === "distance" ? "secondary" : "outline"}
            className="h-8"
            onClick={() => setSortKey("distance")}
          >
            Sort: Distance
          </Button>
          <Button
            type="button"
            size="sm"
            variant={sortKey === "savings" ? "secondary" : "outline"}
            className="h-8"
            onClick={() => setSortKey("savings")}
          >
            Sort: Savings
          </Button>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-border/60 bg-background/10">
        <table className="w-full text-xs">
          <thead className="border-b border-border/60 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Store</th>
              <th className="px-3 py-2 text-right">Distance</th>
              <th className="px-3 py-2">Tier</th>
              <th className="px-3 py-2 text-right">Pkgs</th>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2 text-right">Incremental savings</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((r) => {
              const key = `${r.store_id}:${r.distance_to_anchor_miles}:${r.packages}`;
              const isExpanded = !!expanded[key];
              return (
                <React.Fragment key={key}>
                  <tr className="text-foreground/90">
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{r.store_name}</div>
                      <div className="text-[11px] text-muted-foreground">{r.store_id}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.distance_to_anchor_miles.toFixed(1)}</td>
                    <td className="px-3 py-2">{r.tier_label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.packages)}</td>
                    <td className="px-3 py-2">
                      {r.classification === "Density benefit" ? (
                        <Badge variant="accent" className="text-[11px]">
                          Density benefit
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[11px] text-muted-foreground">
                          Regular cost
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.incremental_savings)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:bg-background/20 hover:text-foreground"
                        onClick={() => setExpanded((prev) => ({ ...prev, [key]: !isExpanded }))}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? "Collapse row" : "Expand row"}
                      >
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className="bg-background/5">
                      <td colSpan={7} className="px-3 py-3 text-xs text-muted-foreground">
                        This store is {r.distance_to_anchor_miles.toFixed(1)} mi from the anchor → {r.tier_label} tier.
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        Assumes route capacity is sufficient for combined packages.
      </div>
    </div>
  );
}

