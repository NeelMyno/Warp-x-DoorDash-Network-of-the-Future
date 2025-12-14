"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { IconCheck, IconLink } from "@/components/icons";

export function CopySectionLink({
  sectionId,
  label,
}: {
  sectionId: string;
  label?: string;
}) {
  const [state, setState] = React.useState<"idle" | "copied">("idle");

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
      aria-label={`Copy link to ${label ?? sectionId}`}
      onClick={async () => {
        try {
          const url = new URL(window.location.href);
          url.hash = sectionId;
          await navigator.clipboard.writeText(url.toString());
          setState("copied");
        } catch {
          // Keep silent; clipboard can be unavailable in some contexts.
        }
      }}
    >
      {state === "copied" ? (
        <span className="inline-flex items-center gap-2">
          <IconCheck className="h-4 w-4" />
          Copied
        </span>
      ) : (
        <span className="inline-flex items-center gap-2">
          <IconLink className="h-4 w-4" />
          Copy link
        </span>
      )}
    </Button>
  );
}
