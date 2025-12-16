import * as React from "react";

import { cn } from "@/lib/utils";
import { ContentPanel } from "@/components/panels/ContentPanel";

export function ImageBlock({
  url,
  path,
  alt,
  caption,
  treatment = "panel",
  showAdminHint,
  className,
}: {
  url?: string;
  path?: string;
  alt: string;
  caption?: string;
  treatment?: "plain" | "panel";
  showAdminHint?: boolean;
  className?: string;
}) {
  const imageChromeClass =
    "overflow-hidden rounded-2xl border border-border/70 bg-background/20";

  const image = (
    <div
      className={imageChromeClass}
    >
      {url ? (
        // Use <img> to avoid remotePatterns config + preserve signed URL behavior.
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={url}
          alt={alt}
          className="block h-auto w-full max-h-[520px] object-contain"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="grid min-h-[220px] place-items-center px-6 py-10">
          <div className="max-w-md text-center">
            <div className="text-sm font-medium text-foreground">
              Asset not available
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Check that the asset exists and you have access.
            </div>
            {path ? (
              <div className="mt-3 rounded-xl border border-border bg-background/15 px-3 py-2 text-left font-mono text-[11px] text-foreground">
                {path}
              </div>
            ) : null}
            {showAdminHint ? (
              <div className="mt-3 text-left text-xs text-muted-foreground">
                Admin hint: verify Storage policies for{" "}
                <span className="font-mono text-foreground">portal-assets</span>{" "}
                (authenticated read + admin write), then try reloading.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );

  const captionEl = caption ? (
    <figcaption className="mt-3 text-xs text-muted-foreground">
      {caption}
    </figcaption>
  ) : null;

  if (treatment === "plain") {
    return (
      <figure className={cn("space-y-0", className)}>
        {image}
        {captionEl}
      </figure>
    );
  }

  return (
    <ContentPanel className={cn("overflow-hidden", className)}>
      <figure>
        {image}
        {captionEl}
      </figure>
    </ContentPanel>
  );
}
