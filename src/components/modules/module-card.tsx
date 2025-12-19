import Link from "next/link";
import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ModuleCard({
  title,
  description,
  href,
  badge,
  locked = false,
}: {
  title: string;
  description: string;
  href: string;
  badge?: string;
  locked?: boolean;
}) {
  if (locked) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              aria-disabled="true"
              className={cn(
                "group relative flex min-h-[168px] cursor-not-allowed flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card px-5 py-4 opacity-50",
              )}
            >
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_55%)] opacity-60" />
              </div>

              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                    <h3 className="truncate text-[15px] font-semibold leading-tight text-muted-foreground">
                      {title}
                    </h3>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground/70">
                    {description}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 px-2 py-0.5 text-[11px]">
                  <Lock className="mr-1 h-3 w-3" />
                  Locked
                </Badge>
              </div>

              <div className="relative mt-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground/50">
                  Admin only
                </span>
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-background/25 text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">This module is only available to admins</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card px-5 py-4",
        "transition will-change-transform hover:-translate-y-0.5 hover:border-[color:var(--warp-border-hover)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_55%)] opacity-60" />
      </div>

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary" />
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
