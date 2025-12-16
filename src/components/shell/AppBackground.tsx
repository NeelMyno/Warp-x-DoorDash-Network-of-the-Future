import * as React from "react";

import { cn } from "@/lib/utils";

export function AppBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none fixed inset-0 -z-10", className)}
      style={{ background: "var(--warp-bg-gradient)" }}
    />
  );
}

