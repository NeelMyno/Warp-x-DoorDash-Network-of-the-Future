"use client";

import * as React from "react";
import { ExternalLink, Download, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PdfBlockProps {
  url?: string | null;
  title?: string;
  filename?: string | null;
  caption?: string | null;
  /** Whether to show admin hints when PDF is not configured */
  showAdminHint?: boolean;
}

/**
 * Renders a PDF embed using browser-native iframe.
 * Shows appropriate empty states when PDF is not configured or fails to load.
 */
export function PdfBlock({
  url,
  title,
  filename,
  caption,
  showAdminHint = false,
}: PdfBlockProps) {
  const [loadError, setLoadError] = React.useState(false);

  // Reset error state when URL changes
  React.useEffect(() => {
    setLoadError(false);
  }, [url]);

  // Empty state: no PDF configured
  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <FileWarning className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="max-w-md space-y-1">
          <h4 className="text-sm font-medium text-foreground">
            {showAdminHint ? "No PDF configured" : "Content coming soon"}
          </h4>
          <p className="text-xs text-muted-foreground">
            {showAdminHint
              ? "Go to Admin → Content Studio to select a PDF for this module."
              : "This section will be available soon."}
          </p>
        </div>
      </div>
    );
  }

  // Error state: PDF failed to load
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-6 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
          <FileWarning className="h-7 w-7 text-amber-500" />
        </div>
        <div className="max-w-md space-y-1">
          <h4 className="text-sm font-medium text-foreground">
            Could not load PDF
          </h4>
          <p className="text-xs text-muted-foreground">
            The PDF failed to load. Try refreshing the page or open it in a new tab.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          asChild
          className="mt-2 gap-1.5"
        >
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            Open in new tab
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* PDF Embed */}
      <div className="overflow-hidden rounded-xl border border-border bg-background/10">
        <iframe
          src={url}
          title={title || filename || "PDF Document"}
          className="h-[70vh] min-h-[500px] w-full"
          onError={() => setLoadError(true)}
        />
      </div>

      {/* Caption and actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {caption ? (
          <p className="text-xs text-muted-foreground">{caption}</p>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-1.5 text-xs"
          >
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" />
              Open in new tab
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-1.5 text-xs"
          >
            <a href={url} download={filename || "document.pdf"}>
              <Download className="h-3 w-3" />
              Download
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

