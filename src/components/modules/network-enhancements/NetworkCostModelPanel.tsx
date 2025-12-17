"use client";

import * as React from "react";

import type { NetworkCostModel } from "@/lib/network-enhancements/schema";
import { cn } from "@/lib/utils";

const EMPTY_SCENARIOS: Array<{ utilization_label: string; cost_per_box: number }> = [];

function toCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function NetworkCostModelPanel({
  value,
  className,
}: {
  value: NetworkCostModel;
  className?: string;
}) {
  const scenarios = value.utilization_scenarios ?? EMPTY_SCENARIOS;
  const first = scenarios[0]?.utilization_label ?? "";
  const [selected, setSelected] = React.useState(first);

  React.useEffect(() => {
    if (!scenarios.length) return;
    if (scenarios.some((s) => s.utilization_label === selected)) return;
    setSelected(first);
  }, [first, scenarios, selected]);

  const activeScenario = scenarios.find((s) => s.utilization_label === selected) ?? null;

  const breakdown = value.all_in_breakdown ?? null;
  const computedTotal = React.useMemo(() => {
    if (!breakdown) return null;
    const parts = [
      breakdown.last_mile_cost_per_box,
      breakdown.middle_mile_cost_per_box,
      breakdown.first_mile_cost_per_box,
      breakdown.hub_sort_cost_per_box,
      breakdown.spoke_sort_cost_per_box,
      breakdown.dispatch_cost_per_box,
    ]
      .map(safeNumber)
      .filter((n): n is number => typeof n === "number");

    if (!parts.length) return null;
    return parts.reduce((sum, n) => sum + n, 0);
  }, [breakdown]);

  return (
    <div className={cn("space-y-5", className)}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-background/15 p-4">
          <div className="text-sm font-semibold text-foreground">
            Middle mile cost per box
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Scenarios by truck utilization (placeholder).
          </div>

          {scenarios.length ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Utilization
                </label>
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className={cn(
                    "h-9 rounded-xl border border-border bg-background/25 px-3 text-sm text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                >
                  {scenarios.map((s) => (
                    <option key={s.utilization_label} value={s.utilization_label}>
                      {s.utilization_label}
                    </option>
                  ))}
                </select>
              </div>

              {activeScenario ? (
                <div className="flex items-end justify-between gap-3 rounded-xl border border-border bg-background/20 px-4 py-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Cost / box</div>
                    <div className="mt-1 text-lg font-semibold text-foreground">
                      {toCurrency(activeScenario.cost_per_box)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {activeScenario.utilization_label}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted-foreground">
              Not configured yet.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-background/15 p-4">
          <div className="text-sm font-semibold text-foreground">
            All-in cost per box
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Assumptions: last mile based on 15 deliveries/hour in major markets.
          </div>

          {breakdown ? (
            <div className="mt-4 space-y-2 text-sm">
              {[
                ["Last mile", breakdown.last_mile_cost_per_box],
                ["Middle mile", breakdown.middle_mile_cost_per_box],
                ["First mile", breakdown.first_mile_cost_per_box],
                ["Hub sort", breakdown.hub_sort_cost_per_box],
                ["Spoke sort", breakdown.spoke_sort_cost_per_box],
                ["Dispatch", breakdown.dispatch_cost_per_box],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/15 px-3 py-2"
                >
                  <div className="text-muted-foreground">{label}</div>
                  <div className="font-mono text-foreground">
                    {typeof value === "number" ? toCurrency(value) : "—"}
                  </div>
                </div>
              ))}

              <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2">
                <div className="text-sm font-semibold text-foreground">Total</div>
                <div className="font-mono text-sm font-semibold text-foreground">
                  {typeof breakdown.total_all_in_cost_per_box === "number"
                    ? toCurrency(breakdown.total_all_in_cost_per_box)
                    : computedTotal !== null
                      ? toCurrency(computedTotal)
                      : "—"}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted-foreground">
              Not configured yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
