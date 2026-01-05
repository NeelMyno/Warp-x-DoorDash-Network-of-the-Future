"use client";

import * as React from "react";

import type { SfsTierDistributionRow } from "@/lib/sfs-calculator/impact";
import { formatNumber, formatPercent } from "@/lib/sfs-calculator/format";

export function TierDistribution(props: { rows: SfsTierDistributionRow[] }) {
  const { rows } = props;

  const hasSatellites = React.useMemo(() => rows.some((r) => r.satellitePackages > 0), [rows]);
  if (!rows.length) return null;

  return (
    <div className="rounded-xl border border-border bg-background/10 p-4">
      <div className="text-sm font-medium text-foreground">Your uploaded stores by tier</div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        Satellite packages are bucketed by distance tier from the anchor.
      </div>

      {!hasSatellites ? (
        <div className="mt-3 rounded-lg border border-border/60 bg-background/10 p-4 text-center text-xs text-muted-foreground">
          No satellite stores found for this anchor.
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border/60 bg-background/10">
          <table className="w-full text-xs">
            <thead className="border-b border-border/60 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2 text-right">Stores</th>
                <th className="px-3 py-2 text-right">Satellite pkgs</th>
                <th className="px-3 py-2 text-right">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((r) => (
                <tr key={r.label} className="text-foreground/90">
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.satelliteStoreCount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.satellitePackages)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatPercent(r.satelliteShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

