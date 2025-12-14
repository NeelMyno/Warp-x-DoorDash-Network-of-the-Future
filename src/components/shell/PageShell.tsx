import * as React from "react";

import { cn } from "@/lib/utils";

export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-h-screen px-[var(--warp-shell-pad)] py-[var(--warp-shell-pad)]",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-[1440px]">{children}</div>
    </div>
  );
}

