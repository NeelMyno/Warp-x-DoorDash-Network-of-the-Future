"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function EmptyPane({
  title,
  description,
  adminHint,
}: {
  title: string;
  description: string;
  adminHint?: string;
}) {
  return (
    <div className="grid h-full min-h-[320px] place-items-center rounded-2xl border border-dashed border-border bg-muted/10 p-6 text-center">
      <div className="max-w-[52ch] space-y-2">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
        {adminHint ? (
          <div className="pt-1 text-xs text-muted-foreground">{adminHint}</div>
        ) : null}
      </div>
    </div>
  );
}

export function PdfViewer({
  url,
  filename,
  isAdmin,
  className,
}: {
  url: string | null;
  filename?: string | null;
  isAdmin?: boolean;
  className?: string;
}) {
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [url]);

  if (!url) {
    return (
      <EmptyPane
        title="PDF not available"
        description="This view hasn’t been configured yet."
        adminHint={isAdmin ? "Configure in Admin → Setup & Diagnostics." : undefined}
      />
    );
  }

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">PDF</div>
          {filename ? (
            <div className="mt-0.5 truncate text-sm font-medium text-foreground">
              {filename}
            </div>
          ) : null}
        </div>
        <Button asChild size="sm" variant="outline">
          <a href={url} target="_blank" rel="noreferrer">
            Open
          </a>
        </Button>
      </div>

      <div className="relative flex-1 p-4">
        <div className="absolute inset-4 overflow-hidden rounded-2xl border border-border/70 bg-background/20">
          {!loaded && !failed ? (
            <div className="grid h-full place-items-center">
              <div className="text-sm text-muted-foreground">Loading PDF…</div>
            </div>
          ) : null}

          {failed ? (
            <div className="grid h-full place-items-center p-6 text-center">
              <div className="space-y-2">
                <div className="text-sm font-semibold text-foreground">
                  Unable to load PDF
                </div>
                <div className="text-sm text-muted-foreground">
                  Use the Open button to view it in a new tab.
                </div>
              </div>
            </div>
          ) : null}

          <iframe
            title={filename?.trim() ? filename.trim() : "SOP PDF"}
            src={url}
            className={cn(
              "h-full w-full",
              failed ? "hidden" : "block",
              loaded ? "opacity-100" : "opacity-0",
            )}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        </div>
      </div>
    </div>
  );
}

