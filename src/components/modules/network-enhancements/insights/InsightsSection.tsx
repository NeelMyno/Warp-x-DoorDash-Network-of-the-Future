import type React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function formatTimestamp(value: string) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleString();
}

export function InsightsSection({
  id,
  title,
  description,
  updatedAt,
  isEmpty,
  emptyText,
  isAdmin,
  adminHref = "/admin?tab=setup",
  children,
  className,
}: {
  id: string;
  title: string;
  description: string;
  updatedAt: string | null;
  isEmpty: boolean;
  emptyText: string;
  isAdmin: boolean;
  adminHref?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 rounded-[var(--warp-radius-xl)] border border-border bg-background/14 shadow-[var(--warp-shadow-elev-1)] backdrop-blur",
        className,
      )}
    >
      <header className="flex flex-col gap-3 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="text-xs leading-relaxed text-muted-foreground/90">
            {description}
          </div>
        </div>

        {updatedAt ? (
          <Badge variant="outline" className="w-fit px-2 py-0.5 text-[11px]">
            Updated{" "}
            <span className="ml-1 font-mono">{formatTimestamp(updatedAt)}</span>
          </Badge>
        ) : null}
      </header>

      <div className="p-4">
        {isEmpty ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-5 text-sm text-muted-foreground">
            {emptyText}
            {isAdmin ? (
              <span className="ml-1">
                Configure in{" "}
                <a
                  href={adminHref}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Admin → Setup & Diagnostics
                </a>
                .
              </span>
            ) : null}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
