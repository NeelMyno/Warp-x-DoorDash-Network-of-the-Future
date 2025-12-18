"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSignedAssetUrl } from "@/components/modules/network-enhancements/useSignedAssetUrl";

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
  assetId,
  url,
  expiresAt,
  filename,
  title,
  caption,
  isAdmin,
  className,
}: {
  assetId: string | null;
  url: string | null;
  expiresAt: string | null;
  filename?: string | null;
  title?: string | null;
  caption?: string | null;
  isAdmin?: boolean;
  className?: string;
}) {
  const signed = useSignedAssetUrl({ assetId, url, expiresAt });
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [timedOut, setTimedOut] = React.useState(false);
  const [embedKey, setEmbedKey] = React.useState(0);
  const timeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setTimedOut(false);
    setEmbedKey((k) => k + 1);
  }, [signed.url]);

  React.useEffect(() => {
    if (!signed.url) return;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (loaded || failed) return;

    timeoutRef.current = window.setTimeout(() => {
      setTimedOut(true);
    }, 20_000);

    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    };
  }, [embedKey, failed, loaded, signed.url]);

  if (!signed.url) {
    return (
      <EmptyPane
        title="PDF not available"
        description="This view hasn’t been configured yet."
        adminHint={isAdmin ? "Configure in Admin → Setup & Diagnostics." : undefined}
      />
    );
  }

  const displayTitle = title?.trim()
    ? title.trim()
    : filename?.trim()
      ? filename.trim()
      : "SOP PDF";

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">PDF</div>
          <div className="mt-0.5 truncate text-sm font-medium text-foreground">
            {displayTitle}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Refresh PDF"
            onClick={async () => {
              await signed.refresh();
              setEmbedKey((k) => k + 1);
              setLoaded(false);
              setFailed(false);
              setTimedOut(false);
            }}
          >
            Refresh
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={signed.url} target="_blank" rel="noreferrer">
              Open
            </a>
          </Button>
        </div>
      </div>

      <div className="relative flex-1 p-2">
        <div className="relative h-full overflow-hidden rounded-xl bg-background/12">
          {!loaded && !failed && !timedOut ? (
            <div className="grid h-full place-items-center">
              <div className="space-y-2 text-center">
                <div className="h-10 w-56 animate-pulse rounded-xl border border-border/50 bg-muted/10" />
                <div className="text-xs text-muted-foreground">Loading SOP…</div>
              </div>
            </div>
          ) : null}

          {failed || timedOut ? (
            <div className="grid h-full place-items-center p-6 text-center">
              <div className="max-w-[46ch] space-y-2">
                <div className="text-sm font-semibold text-foreground">
                  {failed ? "Unable to load PDF" : "PDF preview taking too long"}
                </div>
                <div className="text-sm text-muted-foreground">
                  Your browser may not be able to embed this PDF. Use Open to view it in a
                  new tab.
                </div>
                <div className="pt-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={signed.url} target="_blank" rel="noreferrer">
                      Open in new tab
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <iframe
            key={embedKey}
            title={displayTitle}
            src={signed.url}
            className={cn("h-full w-full", failed || timedOut ? "hidden" : "block")}
            onLoad={() => {
              if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
              setTimedOut(false);
              setLoaded(true);
            }}
            onError={() => {
              if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
              setFailed(true);
            }}
          />
        </div>
      </div>

      {caption?.trim() ? (
        <div className="px-3 pb-3 text-xs leading-relaxed text-muted-foreground">
          {caption.trim()}
        </div>
      ) : null}

      {signed.refreshError ? (
        <div className="px-4 pb-4 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Note:</span> unable to refresh
          signed URL ({signed.refreshError}).
        </div>
      ) : null}
    </div>
  );
}
