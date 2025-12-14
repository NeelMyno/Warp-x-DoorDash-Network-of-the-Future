import * as React from "react";

import type { KpiItem } from "@/config/modules";
import { cn } from "@/lib/utils";

function getDeltaTone(delta: string) {
  if (delta.startsWith("+")) return "positive";
  if (delta.startsWith("-")) return "negative";
  return "neutral";
}

export function KpiStrip({
  title = "Overview",
  items,
  className,
}: {
  title?: string;
  items: KpiItem[];
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-[var(--warp-shadow-elev-2)]",
        className,
      )}
    >
      <div className="relative border-b border-primary/15 bg-[linear-gradient(90deg,var(--warp-green-4),var(--warp-green-3),var(--warp-green-7))] px-5 py-3">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.12),transparent_55%)]" />
        <div className="relative text-xs font-semibold tracking-tight text-black/80">
          {title}
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {items.map((kpi) => {
            const delta =
              typeof kpi.delta === "string" && kpi.delta.trim() && kpi.delta !== "—"
                ? kpi.delta.trim()
                : null;
            const deltaTone = delta ? getDeltaTone(delta) : null;

            return (
              <div key={kpi.label} className="min-w-0">
                <div className="text-[11px] font-medium text-muted-foreground">
                  {kpi.label}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="font-mono text-lg font-semibold tracking-tight text-foreground">
                    {kpi.value}
                  </div>
                  {delta ? (
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        deltaTone === "positive" &&
                          "border-primary/20 bg-primary/10 text-primary",
                        deltaTone === "negative" &&
                          "border-destructive/25 bg-destructive/10 text-destructive",
                        deltaTone === "neutral" &&
                          "border-border bg-muted/30 text-muted-foreground",
                      )}
                    >
                      {delta}
                    </span>
                  ) : null}
                </div>

                {kpi.helper ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {kpi.helper}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
