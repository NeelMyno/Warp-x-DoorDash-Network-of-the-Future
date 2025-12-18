import type { CostScenario } from "@/lib/network-enhancements/insights-schema";
import { cn } from "@/lib/utils";

function toCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `$${value.toFixed(2)}`;
}

function toPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value.toFixed(0)}%`;
}

function cell(value: string, className?: string) {
  return <div className={cn("px-4 py-3 text-sm", className)}>{value}</div>;
}

function header(value: string, className?: string) {
  return (
    <div className={cn("px-4 py-3 text-xs font-medium text-muted-foreground", className)}>
      {value}
    </div>
  );
}

export function CostScenarioTables({ items }: { items: CostScenario[] }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="text-sm font-semibold text-foreground">Middle mile cost per box</div>
        <div className="text-xs text-muted-foreground">
          Scenarios by truck utilization (informed by current assumptions).
        </div>

        <div className="hidden overflow-hidden rounded-2xl border border-border bg-background/10 md:block">
          <div className="grid grid-cols-[1.2fr_160px_200px_1fr] border-b border-border/60">
            {header("Scenario")}
            {header("Utilization", "text-right")}
            {header("Middle mile ($/box)", "text-right")}
            {header("Notes")}
          </div>
          <div className="divide-y divide-border/60">
            {items.map((s, idx) => (
              <div
                key={s.id}
                className={cn(
                  "grid grid-cols-[1.2fr_160px_200px_1fr]",
                  idx % 2 ? "bg-background/10" : "bg-transparent",
                )}
              >
                {cell(s.name, "text-foreground")}
                {cell(toPercent(s.truck_utilization_pct), "text-right font-mono text-foreground")}
                {cell(toCurrency(s.middle_mile_cost_per_box), "text-right font-mono text-foreground")}
                {cell(s.notes?.trim() ? s.notes.trim() : "—", "text-muted-foreground")}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:hidden">
          {items.map((s) => (
            <div key={s.id} className="rounded-2xl border border-border bg-background/10 p-4">
              <div className="text-sm font-semibold text-foreground">{s.name}</div>
              <div className="mt-3 grid gap-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-muted-foreground">Utilization</div>
                  <div className="font-mono text-foreground">{toPercent(s.truck_utilization_pct)}</div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-muted-foreground">Middle mile ($/box)</div>
                  <div className="font-mono text-foreground">{toCurrency(s.middle_mile_cost_per_box)}</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {s.notes?.trim() ? s.notes.trim() : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-semibold text-foreground">All-in cost per box</div>
        <div className="rounded-xl border border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Assumptions:</span> Last mile assumes
          density of 15 deliveries/hour in major markets.
        </div>

        <div className="hidden overflow-hidden rounded-2xl border border-border bg-background/10 lg:block">
          <div className="grid grid-cols-[1.2fr_160px_140px_140px_140px_140px_140px_140px_1fr] border-b border-border/60">
            {header("Scenario")}
            {header("Total all-in", "text-right text-foreground")}
            {header("Last mile", "text-right")}
            {header("Middle mile", "text-right")}
            {header("First mile", "text-right")}
            {header("Hub sort", "text-right")}
            {header("Spoke sort", "text-right")}
            {header("Dispatch", "text-right")}
            {header("Notes")}
          </div>
          <div className="divide-y divide-border/60">
            {items.map((s, idx) => (
              <div
                key={s.id}
                className={cn(
                  "grid grid-cols-[1.2fr_160px_140px_140px_140px_140px_140px_140px_1fr]",
                  idx % 2 ? "bg-background/10" : "bg-transparent",
                )}
              >
                {cell(s.name, "text-foreground")}
                {cell(toCurrency(s.all_in_cost_per_box), "text-right font-mono text-foreground")}
                {cell(toCurrency(s.last_mile_cost_per_box), "text-right font-mono text-foreground")}
                {cell(toCurrency(s.middle_mile_cost_per_box), "text-right font-mono text-foreground")}
                {cell(toCurrency(s.first_mile_cost_per_box), "text-right font-mono text-foreground")}
                {cell(toCurrency(s.hub_sort_cost_per_box), "text-right font-mono text-foreground")}
                {cell(toCurrency(s.spoke_sort_cost_per_box), "text-right font-mono text-foreground")}
                {cell(toCurrency(s.dispatch_cost_per_box), "text-right font-mono text-foreground")}
                {cell(s.notes?.trim() ? s.notes.trim() : "—", "text-muted-foreground")}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 lg:hidden">
          {items.map((s) => (
            <div key={s.id} className="rounded-2xl border border-border bg-background/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-semibold text-foreground">{s.name}</div>
                <div className="font-mono text-sm font-semibold text-foreground">
                  {toCurrency(s.all_in_cost_per_box)}
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-xs">
                {[
                  ["Last mile", toCurrency(s.last_mile_cost_per_box)],
                  ["Middle mile", toCurrency(s.middle_mile_cost_per_box)],
                  ["First mile", toCurrency(s.first_mile_cost_per_box)],
                  ["Hub sort", toCurrency(s.hub_sort_cost_per_box)],
                  ["Spoke sort", toCurrency(s.spoke_sort_cost_per_box)],
                  ["Dispatch", toCurrency(s.dispatch_cost_per_box)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <div className="text-muted-foreground">{label}</div>
                    <div className="font-mono text-foreground">{value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3 text-xs text-muted-foreground">
                {s.notes?.trim() ? s.notes.trim() : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

