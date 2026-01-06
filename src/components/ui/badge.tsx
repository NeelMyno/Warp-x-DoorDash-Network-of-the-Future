import * as React from "react";

import { cn } from "@/lib/utils";

export type BadgeVariant = "accent" | "muted" | "outline" | "destructive";

export function Badge({
  className,
  variant = "muted",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  const variants: Record<BadgeVariant, string> = {
    accent: "border-transparent bg-primary/15 text-primary",
    muted: "border-transparent bg-muted text-muted-foreground",
    outline: "border-border bg-transparent text-foreground",
    destructive: "border-transparent bg-red-500/15 text-red-500",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

