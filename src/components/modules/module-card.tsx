import Link from "next/link";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function ModuleCard({
  title,
  description,
  href,
  badge,
}: {
  title: string;
  description: string;
  href: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card px-5 py-4 shadow-[var(--warp-shadow-elev-1)]",
        "transition will-change-transform hover:-translate-y-0.5 hover:border-[color:var(--warp-border-hover)] hover:shadow-[var(--warp-shadow-elev-2)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_55%)] opacity-60" />
        <div className="absolute -top-24 left-8 h-56 w-56 rounded-full bg-primary/10 blur-2xl opacity-40 transition-opacity group-hover:opacity-70" />
        <div className="absolute -bottom-28 right-8 h-64 w-64 rounded-full bg-primary/[0.08] blur-2xl opacity-20 transition-opacity group-hover:opacity-50" />
      </div>

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_6px_rgba(0,255,51,0.10)]" />
            <h3 className="truncate text-[15px] font-semibold leading-tight text-foreground">
              {title}
            </h3>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        {badge ? (
          <Badge variant="accent" className="shrink-0 px-2 py-0.5 text-[11px]">
            {badge}
          </Badge>
        ) : null}
      </div>

      <div className="relative mt-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground transition-colors group-hover:text-foreground">
          Open
        </span>
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-background/25 text-primary transition group-hover:border-[color:var(--warp-border-hover)] group-hover:bg-background/45">
          <span className="text-lg leading-none">→</span>
        </span>
      </div>
    </Link>
  );
}
