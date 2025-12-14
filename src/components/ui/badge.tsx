import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeVariant = "accent" | "muted" | "outline";

export function Badge({
  className,
  variant = "muted",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  const variants: Record<BadgeVariant, string> = {
    accent: "border-transparent bg-primary/15 text-primary",
    muted: "border-transparent bg-muted text-muted-foreground",
    outline: "border-border bg-transparent text-foreground",
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

