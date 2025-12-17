"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function storageKey(input: {
  slug: string;
  sub: string;
  variant?: string | null;
}) {
  const v = input.variant ? input.variant : "none";
  return `warp:split:${input.slug}:${input.sub}:${v}`;
}

export function SplitView({
  slug,
  sub,
  variant,
  initialFocus = "reset",
  leftId = "diagram",
  rightId = "pdf",
  left,
  right,
  className,
}: {
  slug: string;
  sub: string;
  variant?: string | null;
  initialFocus?: "diagram" | "pdf" | "reset";
  leftId?: string;
  rightId?: string;
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
}) {
  const key = React.useMemo(() => storageKey({ slug, sub, variant }), [slug, sub, variant]);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [ratio, setRatio] = React.useState(0.5);
  const [isDragging, setIsDragging] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? Number(raw) : NaN;
      if (Number.isFinite(parsed)) {
        setRatio(clamp(parsed, 0.2, 0.8));
        return;
      }

      if (initialFocus === "diagram") setRatio(0.8);
      else if (initialFocus === "pdf") setRatio(0.2);
      else setRatio(0.5);
    } catch {
      // ignore
    }
  }, [key, initialFocus]);

  React.useEffect(() => {
    try {
      localStorage.setItem(key, String(ratio));
    } catch {
      // ignore
    }
  }, [key, ratio]);

  const setFocused = (side: "left" | "right" | "reset") => {
    if (side === "reset") setRatio(0.5);
    else if (side === "left") setRatio(0.8);
    else setRatio(0.2);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const next = (e.clientX - rect.left) / rect.width;
    setRatio(clamp(next, 0.2, 0.8));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
  };

  const onDividerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setRatio((r) => clamp(r - 0.04, 0.2, 0.8));
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setRatio((r) => clamp(r + 0.04, 0.2, 0.8));
    }
    if (e.key === "Home") {
      e.preventDefault();
      setRatio(0.2);
    }
    if (e.key === "End") {
      e.preventDefault();
      setRatio(0.8);
    }
  };

  return (
    <section
      className={cn(
        "rounded-[var(--warp-radius-xl)] border border-border bg-background/18 shadow-[var(--warp-shadow-elev-2)] backdrop-blur",
        className,
      )}
    >
      <header className="flex flex-col gap-3 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setFocused("left")}
            aria-label="Focus diagram"
          >
            Focus diagram
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setFocused("right")}
            aria-label="Focus PDF"
          >
            Focus PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setFocused("reset")}
            aria-label="Reset layout"
          >
            Reset
          </Button>
        </div>

        <div className="flex items-center gap-2 sm:hidden">
          <a
            href={`#${leftId}`}
            className="rounded-md border border-border bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background"
          >
            Jump to diagram
          </a>
          <a
            href={`#${rightId}`}
            className="rounded-md border border-border bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background"
          >
            Jump to PDF
          </a>
        </div>
      </header>

      <div className="p-4">
        <div className="grid gap-4 lg:hidden">
          <div id={leftId} className="min-h-[240px]">
            {left}
          </div>
          <div id={rightId} className="min-h-[320px]">
            {right}
          </div>
        </div>

        <div
          ref={containerRef}
          className="relative hidden min-h-[520px] overflow-hidden rounded-2xl border border-border/60 bg-background/20 lg:flex"
        >
          <div
            id={leftId}
            className="min-w-0"
            style={{ width: `${ratio * 100}%` }}
          >
            {left}
          </div>

          <div
            role="separator"
            tabIndex={0}
            aria-label="Resize split view"
            aria-orientation="vertical"
            aria-valuemin={20}
            aria-valuemax={80}
            aria-valuenow={Math.round(ratio * 100)}
            onKeyDown={onDividerKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className={cn(
              "relative z-10 w-[18px] shrink-0 cursor-col-resize",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/80" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border border-border/70 bg-background/60 shadow-[var(--warp-shadow-elev-1)]">
              <div className="grid gap-1">
                <span className="h-1 w-4 rounded-full bg-border" />
                <span className="h-1 w-4 rounded-full bg-border" />
              </div>
            </div>
          </div>

          <div
            id={rightId}
            className="min-w-0 flex-1"
            style={{ width: `${(1 - ratio) * 100}%` }}
          >
            {right}
          </div>
        </div>
      </div>
    </section>
  );
}
