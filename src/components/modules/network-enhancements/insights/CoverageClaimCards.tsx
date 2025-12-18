import type { CoverageClaim } from "@/lib/network-enhancements/insights-schema";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function tagBadge(value: string) {
  return (
    <Badge
      key={value}
      variant="outline"
      className={cn("px-2 py-0.5 text-[11px]", "border-border/60 bg-background/15")}
    >
      {value}
    </Badge>
  );
}

export function CoverageClaimCards({ items }: { items: CoverageClaim[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((c) => {
        const tags = [
          c.service_level?.trim() ? `Service: ${c.service_level.trim()}` : null,
          c.region?.trim() ? `Region: ${c.region.trim()}` : null,
          c.injection?.trim() ? `Injection: ${c.injection.trim()}` : null,
        ].filter((v): v is string => typeof v === "string");

        return (
          <div
            key={c.id}
            className={cn(
              "rounded-2xl border border-border bg-background/10 p-4",
              "shadow-[var(--warp-shadow-elev-1)]",
            )}
          >
            <div className="space-y-2">
              <div className="text-sm font-semibold text-foreground">{c.title}</div>
              <div className="text-sm leading-relaxed text-muted-foreground">
                {c.statement}
              </div>
            </div>

            {tags.length ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {tags.map((t) => tagBadge(t))}
              </div>
            ) : null}

            {c.limitations?.trim() ? (
              <details className="mt-3 rounded-xl border border-border/60 bg-muted/10 px-3 py-2">
                <summary className="cursor-pointer select-none text-xs font-medium text-foreground">
                  Limitations / notes
                </summary>
                <div className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {c.limitations.trim()}
                </div>
              </details>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

