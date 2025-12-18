"use client";

import * as React from "react";
import { toast } from "sonner";

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

type StoredLayout =
  | { ratio: number; mode: "split" | "diagram" | "pdf" }
  | { ratio: number };

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
  const measureRef = React.useRef<HTMLElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [ratio, setRatio] = React.useState(0.5);
  const [mode, setMode] = React.useState<"split" | "diagram" | "pdf">("split");
  const [isDragging, setIsDragging] = React.useState(false);
  const [containerWidth, setContainerWidth] = React.useState<number | null>(null);
  const [savedToastArmed, setSavedToastArmed] = React.useState(false);

  const minPanePx = React.useMemo(() => {
    if (!containerWidth) return 320;
    return containerWidth >= 1024 ? 320 : 260;
  }, [containerWidth]);

  const ratioBounds = React.useCallback(() => {
    if (!containerRef.current) return { min: 0.2, max: 0.8 };
    const rect = containerRef.current.getBoundingClientRect();
    const min = clamp(minPanePx / rect.width, 0.1, 0.45);
    return { min, max: 1 - min };
  }, [minPanePx]);

  const forceStacked = React.useMemo(() => {
    if (!containerWidth) return false;
    return containerWidth < minPanePx * 2 + 24;
  }, [containerWidth, minPanePx]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const numeric = Number(raw);
        if (Number.isFinite(numeric)) {
          setRatio(clamp(numeric, 0.2, 0.8));
          setMode("split");
          return;
        }

        const parsed = JSON.parse(raw) as StoredLayout;
        if (typeof parsed?.ratio === "number" && Number.isFinite(parsed.ratio)) {
          setRatio(clamp(parsed.ratio, 0.2, 0.8));
        }
        if (parsed && "mode" in parsed && (parsed.mode === "split" || parsed.mode === "diagram" || parsed.mode === "pdf")) {
          setMode(parsed.mode);
        } else {
          setMode("split");
        }
        return;
      }

      if (initialFocus === "diagram") setRatio(0.8);
      else if (initialFocus === "pdf") setRatio(0.2);
      else setRatio(0.5);
      setMode(initialFocus === "diagram" ? "diagram" : initialFocus === "pdf" ? "pdf" : "split");
    } catch {
      // ignore
    }
  }, [key, initialFocus]);

  React.useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ ratio, mode } satisfies StoredLayout));
    } catch {
      // ignore
    }
  }, [key, ratio, mode]);

  React.useEffect(() => {
    if (!measureRef.current) return;
    const el = measureRef.current;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setContainerWidth(rect.width);
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    setContainerWidth(rect.width);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    if (!containerWidth) return;
    const { min, max } = ratioBounds();
    setRatio((r) => clamp(r, min, max));
  }, [containerWidth, ratioBounds]);

  const applyRatio = React.useCallback(
    (next: number) => {
      const { min, max } = ratioBounds();
      setRatio(clamp(next, min, max));
    },
    [ratioBounds],
  );

  const setFocused = (next: "diagram" | "pdf" | "split" | "reset") => {
    if (next === "reset") {
      setMode("split");
      applyRatio(0.5);
      setSavedToastArmed(true);
      return;
    }
    if (next === "split") {
      setMode("split");
      setSavedToastArmed(true);
      return;
    }
    setMode(next);
    applyRatio(next === "diagram" ? 0.8 : 0.2);
    setSavedToastArmed(true);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    setMode("split");
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const next = (e.clientX - rect.left) / rect.width;
    applyRatio(next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
    setSavedToastArmed(true);
  };

  const onDividerKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setMode("split");
      applyRatio(ratio - step);
      setSavedToastArmed(true);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setMode("split");
      applyRatio(ratio + step);
      setSavedToastArmed(true);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setFocused("diagram");
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      setFocused("pdf");
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      setFocused("reset");
    }
  };

  React.useEffect(() => {
    if (!savedToastArmed) return;
    try {
      const onceKey = `${key}:layout-saved`;
      if (sessionStorage.getItem(onceKey)) return;
      sessionStorage.setItem(onceKey, "1");
      toast.message("Layout saved");
    } catch {
      // ignore
    } finally {
      setSavedToastArmed(false);
    }
  }, [key, savedToastArmed]);

  return (
    <section
      ref={measureRef}
      className={cn(
        "rounded-[var(--warp-radius-xl)] border border-border bg-background/18 shadow-[var(--warp-shadow-elev-2)] backdrop-blur",
        className,
      )}
    >
      <header className="flex flex-col gap-3 border-b border-border/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setFocused("diagram")}
            aria-label="Focus diagram"
            aria-pressed={mode === "diagram"}
          >
            Focus diagram
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setFocused("pdf")}
            aria-label="Focus PDF"
            aria-pressed={mode === "pdf"}
          >
            Focus PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setFocused("split")}
            aria-label="Split layout"
            aria-pressed={mode === "split"}
          >
            Split
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
            className="cursor-pointer rounded-md border border-border bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background"
          >
            Jump to diagram
          </a>
          <a
            href={`#${rightId}`}
            className="cursor-pointer rounded-md border border-border bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background"
          >
            Jump to PDF
          </a>
        </div>
      </header>

      <div className="p-3">
        <div className={cn("grid gap-4", forceStacked ? "md:grid" : "md:hidden")}>
          <div id={leftId} className="min-h-[240px]">
            {left}
          </div>
          <div id={rightId} className="min-h-[320px]">
            {right}
          </div>
        </div>

        <div
          ref={containerRef}
          className={cn(
            "relative hidden min-h-[520px] overflow-hidden rounded-2xl border border-border/60 bg-background/20",
            forceStacked ? "md:hidden" : "md:flex",
          )}
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
            aria-valuemin={Math.round(ratioBounds().min * 100)}
            aria-valuemax={Math.round(ratioBounds().max * 100)}
            aria-valuenow={Math.round(ratio * 100)}
            aria-valuetext={`${Math.round(ratio * 100)}% diagram`}
            onKeyDown={onDividerKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className={cn(
              "relative z-10 w-[18px] shrink-0 cursor-col-resize",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isDragging ? "opacity-100" : "opacity-95",
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
