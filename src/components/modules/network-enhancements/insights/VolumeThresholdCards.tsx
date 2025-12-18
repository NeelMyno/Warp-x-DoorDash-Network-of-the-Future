import type { VolumeThreshold } from "@/lib/network-enhancements/insights-schema";
import { cn } from "@/lib/utils";

export function VolumeThresholdCards({ items }: { items: VolumeThreshold[] }) {
  return (
    <div className="space-y-3">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "rounded-2xl border border-border bg-background/10 p-4",
            "shadow-[var(--warp-shadow-elev-1)]",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-mono text-sm font-semibold text-foreground">{t.label}</div>
          </div>

          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {t.changes.map((c, idx) => (
              <li key={`${t.id}-c-${idx}`} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--warp-accent)] opacity-70" />
                <span className="leading-relaxed">{c}</span>
              </li>
            ))}
          </ul>

          {t.implication?.trim() ? (
            <div className="mt-3 rounded-xl border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Operational implication:</span>{" "}
              {t.implication.trim()}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

