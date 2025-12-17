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
    <div className="grid h-full min-h-[240px] place-items-center rounded-2xl border border-dashed border-border bg-muted/10 p-6 text-center">
      <div className="max-w-[48ch] space-y-2">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
        {adminHint ? (
          <div className="pt-1 text-xs text-muted-foreground">{adminHint}</div>
        ) : null}
      </div>
    </div>
  );
}

export function DiagramViewer({
  assetId,
  url,
  expiresAt,
  filename,
  title,
  alt,
  caption,
  isAdmin,
  className,
}: {
  assetId: string | null;
  url: string | null;
  expiresAt: string | null;
  filename?: string | null;
  title?: string | null;
  alt?: string | null;
  caption?: string | null;
  isAdmin?: boolean;
  className?: string;
}) {
  const signed = useSignedAssetUrl({ assetId, url, expiresAt });

  const [loaded, setLoaded] = React.useState(false);
  const [scale, setScale] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [isActivePan, setIsActivePan] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const panRef = React.useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(
    null,
  );

  React.useEffect(() => {
    setLoaded(false);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [signed.url]);

  if (!signed.url) {
    return (
      <EmptyPane
        title="Diagram not available"
        description="This view hasn’t been configured yet."
        adminHint={isAdmin ? "Configure in Admin → Setup & Diagnostics." : undefined}
      />
    );
  }

  const displayTitle = title?.trim()
    ? title.trim()
    : filename?.trim()
      ? filename.trim()
      : "Facility diagram";

  const resolvedAlt = alt?.trim()
    ? alt.trim()
    : filename?.trim()
      ? filename.trim()
      : "Facility diagram";

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function clampOffset(next: { x: number; y: number }, nextScale: number) {
    const el = containerRef.current;
    if (!el) return next;
    const rect = el.getBoundingClientRect();
    const maxX = Math.max(0, (rect.width * (nextScale - 1)) / 2);
    const maxY = Math.max(0, (rect.height * (nextScale - 1)) / 2);
    return {
      x: clamp(next.x, -maxX, maxX),
      y: clamp(next.y, -maxY, maxY),
    };
  }

  function setScaleClamped(nextScale: number) {
    const clamped = clamp(nextScale, 1, 3);
    setScale(clamped);
    setOffset((prev) => clampOffset(prev, clamped));
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    panRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
    setIsPanning(true);
    setIsActivePan(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!panRef.current) return;
    const dx = e.clientX - panRef.current.startX;
    const dy = e.clientY - panRef.current.startY;
    const next = { x: panRef.current.baseX + dx, y: panRef.current.baseY + dy };
    setOffset(clampOffset(next, scale));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    panRef.current = null;
    setIsPanning(false);
    setIsActivePan(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">Diagram</div>
          <div className="mt-0.5 truncate text-sm font-medium text-foreground">
            {displayTitle}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Zoom out"
            onClick={() => setScaleClamped(scale - 0.25)}
            disabled={scale <= 1}
          >
            −
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Zoom in"
            onClick={() => setScaleClamped(scale + 0.25)}
          >
            +
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label="Reset view"
            onClick={() => {
              setScale(1);
              setOffset({ x: 0, y: 0 });
            }}
          >
            Reset
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={signed.url} target="_blank" rel="noreferrer">
              Open
            </a>
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4">
        <div className="relative grid h-full place-items-center overflow-hidden rounded-2xl border border-border/70 bg-background/20">
          {!loaded ? (
            <div className="absolute inset-0 grid place-items-center">
              <div className="h-[68%] w-[72%] animate-pulse rounded-2xl border border-border/60 bg-muted/15" />
            </div>
          ) : null}

          <div
            ref={containerRef}
            className={cn(
              "relative h-full w-full touch-none select-none overflow-hidden",
              isPanning ? "cursor-grabbing" : scale > 1 ? "cursor-grab" : "cursor-default",
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-label={resolvedAlt}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signed.url}
              alt={resolvedAlt}
              onLoad={() => setLoaded(true)}
              className="absolute left-1/2 top-1/2 block max-h-full max-w-full -translate-x-1/2 -translate-y-1/2 object-contain"
              style={{
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
                transformOrigin: "center",
                transition: isActivePan ? "none" : "transform 120ms ease",
              }}
            />
          </div>
        </div>

        {caption?.trim() ? (
          <div className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {caption.trim()}
          </div>
        ) : null}

        {signed.refreshError ? (
          <div className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Note:</span> unable to refresh
            signed URL ({signed.refreshError}).
          </div>
        ) : null}
      </div>
    </div>
  );
}
