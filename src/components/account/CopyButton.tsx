"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";

export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = React.useState<"idle" | "copied" | "error">("idle");

  React.useEffect(() => {
    if (state !== "copied") return;
    const handle = window.setTimeout(() => setState("idle"), 900);
    return () => window.clearTimeout(handle);
  }, [state]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setState("copied");
        } catch {
          setState("error");
        }
      }}
    >
      {state === "copied" ? "Copied" : state === "error" ? "Copy failed" : label}
    </Button>
  );
}

