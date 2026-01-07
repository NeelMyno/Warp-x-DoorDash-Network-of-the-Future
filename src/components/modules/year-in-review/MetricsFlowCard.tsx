"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { MetricsFlowItem } from "@/config/modules";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  normalizeMetrics,
  computeTotal,
  computeRoundedPercents,
  getSegmentPalette,
  formatNumber,
  type MetricWithPercent,
  type SegmentGradient,
} from "./metrics-flow-utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MetricsFlowCardProps {
  title: string;
  subtitle?: string;
  totalLabel: string;
  metrics: MetricsFlowItem[];
  className?: string;
  /** Show admin-specific warnings (invalid values, etc.) */
  isAdmin?: boolean;
  /** Compact mode for admin preview */
  compact?: boolean;
}

// Threshold below which labels collapse to compact dot+percent
const COMPACT_LABEL_THRESHOLD = 12;

// ─────────────────────────────────────────────────────────────────────────────
// useInView hook - triggers animation when element scrolls into view
// ─────────────────────────────────────────────────────────────────────────────

function useInView(threshold = 0.2) {
  const [isInView, setIsInView] = React.useState(false);
  const [hasAnimated, setHasAnimated] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (hasAnimated) return;

    // Check for reduced motion preference - skip animation
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setIsInView(true);
      setHasAnimated(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setIsInView(true);
          setHasAnimated(true);
        }
      },
      { threshold }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold, hasAnimated]);

  return { isInView, ref };
}

// ─────────────────────────────────────────────────────────────────────────────
// useCountUp hook - animates number from 0 to target
// ─────────────────────────────────────────────────────────────────────────────

function useCountUp(target: number, isInView: boolean, duration = 1000) {
  const [count, setCount] = React.useState(0);
  const hasAnimatedRef = React.useRef(false);

  React.useEffect(() => {
    if (!isInView || hasAnimatedRef.current) return;
    hasAnimatedRef.current = true;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setCount(target);
      return;
    }

    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [target, isInView, duration]);

  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// StackedPercentBar - Reusable grid-aligned stacked bar with labels
// ─────────────────────────────────────────────────────────────────────────────

interface StackedPercentBarProps {
  metrics: MetricWithPercent[];
  palette: SegmentGradient[];
  hoveredKey: string | null;
  onHover: (key: string | null) => void;
  isAnimated: boolean;
  prefersReducedMotion: boolean;
  /** Compact mode hides label row */
  compact?: boolean;
  /** Bar height class */
  barHeightClass?: string;
}

function StackedPercentBar({
  metrics,
  palette,
  hoveredKey,
  onHover,
  isAnimated,
  prefersReducedMotion,
  compact = false,
  barHeightClass = "h-5 md:h-6 lg:h-7",
}: StackedPercentBarProps) {
  // Build grid template from rounded percentages
  const gridTemplate = metrics.map((m) => `${m.pctRounded}fr`).join(" ");

  return (
    <div className="w-full space-y-2">
      {/* Bar Track + Segments */}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-xl",
          "bg-white/[0.03] ring-1 ring-white/[0.08]",
          barHeightClass
        )}
        style={{ boxShadow: "inset 0 2px 4px rgba(0,0,0,0.15)" }}
        role="img"
        aria-label={`Stacked bar: ${metrics.map((m) => `${m.label} ${m.pctRounded}%`).join(", ")}`}
      >
        {/* Glass highlight */}
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 50%)",
          }}
        />

        {/* Grid-based segments for exact proportional widths */}
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {metrics.map((metric, idx) => {
            const gradient = palette[idx];
            const isHovered = hoveredKey === metric.key;
            const anyHovered = hoveredKey !== null;
            const isFirst = idx === 0;
            const isLast = idx === metrics.length - 1;

            return (
              <Tooltip key={metric.key}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "relative h-full overflow-hidden outline-none transition-all duration-200",
                      "focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                      // Rounded corners only on ends
                      isFirst && "rounded-l-xl",
                      isLast && "rounded-r-xl",
                      // Dim non-hovered when something is hovered
                      anyHovered && !isHovered && "brightness-[0.7] saturate-75"
                    )}
                    style={{
                      background: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
                      boxShadow: isHovered
                        ? `0 0 20px -4px ${gradient.glow}, inset 0 1px 0 rgba(255,255,255,0.15)`
                        : "inset 0 1px 0 rgba(255,255,255,0.1)",
                      transform: isAnimated
                        ? "scaleX(1)"
                        : "scaleX(0)",
                      transformOrigin: "left",
                      transition: prefersReducedMotion
                        ? "none"
                        : `transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 90}ms, filter 200ms ease, box-shadow 200ms ease`,
                      filter: isHovered ? "brightness(1.12) saturate(1.08)" : undefined,
                    }}
                    onMouseEnter={() => onHover(metric.key)}
                    onMouseLeave={() => onHover(null)}
                    onFocus={() => onHover(metric.key)}
                    onBlur={() => onHover(null)}
                    aria-label={`${metric.label}: ${formatNumber(metric.value)} (${metric.pctRounded}%)`}
                  >
                    {/* Sheen animation on hover */}
                    {!prefersReducedMotion && (
                      <div
                        className={cn(
                          "pointer-events-none absolute inset-0 transition-opacity duration-200",
                          isHovered ? "opacity-100" : "opacity-0"
                        )}
                        style={{
                          background: "linear-gradient(100deg, transparent 20%, rgba(255,255,255,0.12) 50%, transparent 80%)",
                          backgroundSize: "200% 100%",
                          animation: isHovered ? "metrics-bar-sheen 800ms ease-out forwards" : "none",
                        }}
                      />
                    )}
                    {/* Separator line */}
                    {!isLast && (
                      <div className="absolute right-0 top-0 h-full w-px bg-black/20" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  sideOffset={10}
                  className="flex flex-col gap-0.5 rounded-lg px-3 py-2"
                >
                  <span className="text-sm font-semibold">{metric.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatNumber(metric.value)} loads · {metric.pctRounded}%
                  </span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* Labels row - aligned to segments via same grid */}
      {!compact && (
        <div
          className="grid w-full"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {metrics.map((metric, idx) => {
            const gradient = palette[idx];
            const isHovered = hoveredKey === metric.key;
            const isSmallSegment = metric.pctRounded < COMPACT_LABEL_THRESHOLD;

            return (
              <Tooltip key={metric.key}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex flex-col items-start px-1 py-1.5 text-left transition-all duration-150",
                      "rounded-md outline-none",
                      "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                      isHovered && "bg-white/[0.04]",
                      // For tiny segments, center the dot
                      isSmallSegment && "items-center justify-center"
                    )}
                    onMouseEnter={() => onHover(metric.key)}
                    onMouseLeave={() => onHover(null)}
                    onFocus={() => onHover(metric.key)}
                    onBlur={() => onHover(null)}
                    aria-label={`${metric.label}: ${formatNumber(metric.value)}, ${metric.pctRounded}%`}
                  >
                    {isSmallSegment ? (
                      // Compact: colored dot + percent only
                      <div className="flex items-center gap-1">
                        <div
                          className="h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ background: gradient.from }}
                        />
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {metric.pctRounded}%
                        </span>
                      </div>
                    ) : (
                      // Full: label + percent · value
                      <>
                        <span
                          className={cn(
                            "text-sm font-medium leading-tight text-foreground",
                            "line-clamp-1"
                          )}
                        >
                          {metric.label}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                          <span className="font-medium text-foreground/80">{metric.pctRounded}%</span>
                          <span className="text-muted-foreground/50">·</span>
                          <span>{formatNumber(metric.value)}</span>
                        </span>
                      </>
                    )}
                  </button>
                </TooltipTrigger>
                {isSmallSegment && (
                  <TooltipContent
                    side="bottom"
                    sideOffset={4}
                    className="flex flex-col gap-0.5 rounded-lg px-3 py-2"
                  >
                    <span className="text-sm font-semibold">{metric.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatNumber(metric.value)} · {metric.pctRounded}%
                    </span>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback Legend - for mobile or many metrics
// ─────────────────────────────────────────────────────────────────────────────

interface FallbackLegendProps {
  metrics: MetricWithPercent[];
  palette: SegmentGradient[];
  hoveredKey: string | null;
  onHover: (key: string | null) => void;
}

function FallbackLegend({ metrics, palette, hoveredKey, onHover }: FallbackLegendProps) {
  // Responsive columns based on count
  const gridClass =
    metrics.length <= 3
      ? "grid-cols-1 sm:grid-cols-3"
      : metrics.length <= 4
        ? "grid-cols-2 sm:grid-cols-4"
        : "grid-cols-2 sm:grid-cols-3";

  return (
    <div className={cn("grid gap-1.5", gridClass)}>
      {metrics.map((metric, idx) => {
        const gradient = palette[idx];
        const isHovered = hoveredKey === metric.key;

        return (
          <button
            key={metric.key}
            type="button"
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all duration-150",
              "hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isHovered && "bg-white/[0.06]"
            )}
            onMouseEnter={() => onHover(metric.key)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(metric.key)}
            onBlur={() => onHover(null)}
            aria-label={`${metric.label}: ${formatNumber(metric.value)}, ${metric.pctRounded}%`}
          >
            {/* Gradient swatch */}
            <div
              className="h-2.5 w-5 flex-shrink-0 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
              }}
            />
            {/* Label */}
            <span className="flex-1 truncate text-sm font-medium text-foreground">
              {metric.label}
            </span>
            {/* Value + Percent */}
            <span className="text-sm tabular-nums text-muted-foreground">
              {formatNumber(metric.value)}
            </span>
            <span className="text-sm tabular-nums font-medium text-foreground/80">
              {metric.pctRounded}%
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function MetricsFlowCard({
  title,
  subtitle,
  totalLabel,
  metrics: rawMetrics,
  className,
  isAdmin = false,
  compact = false,
}: MetricsFlowCardProps) {
  const [hoveredKey, setHoveredKey] = React.useState<string | null>(null);
  const { isInView, ref } = useInView(0.3);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  // Check reduced motion preference on mount
  React.useEffect(() => {
    setPrefersReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  // Normalize and validate metrics
  const { metrics, hasInvalid } = normalizeMetrics(rawMetrics);
  const total = computeTotal(metrics);
  const metricsWithPercent = computeRoundedPercents(metrics, total);
  const palette = getSegmentPalette(metrics);
  const animatedTotal = useCountUp(total, isInView);

  // Determine if we need fallback legend (mobile or many metrics)
  const showFallbackLegend = metrics.length >= 5;

  // Empty state - fewer than 2 metrics
  if (metrics.length < 2) {
    return (
      <div className={cn("rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center", className)}>
        <p className="text-base font-medium text-muted-foreground">
          {metrics.length === 0 ? "Not enough data to display breakdown." : "At least 2 metrics required."}
        </p>
        {isAdmin && (
          <p className="mt-2 text-sm text-muted-foreground">
            Add at least 2 metrics in Admin → Content Studio.
          </p>
        )}
      </div>
    );
  }

  // All zeros state
  if (total === 0) {
    return (
      <div className={cn("w-full space-y-4", className)}>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {/* Empty track */}
        <div className="relative h-5 w-full overflow-hidden rounded-xl bg-white/[0.03] ring-1 ring-white/[0.08] md:h-6 lg:h-7">
          <div className="absolute inset-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]" />
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No data reported yet.</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      {/* CSS keyframes for sheen animation */}
      <style jsx global>{`
        @keyframes metrics-bar-sheen {
          0% { background-position: -100% 0; }
          100% { background-position: 100% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>

      <div ref={ref} className={cn("w-full", compact ? "space-y-3" : "space-y-5", className)}>
        {/* Admin warning for invalid values */}
        {isAdmin && hasInvalid && (
          <div className="mx-auto flex max-w-md items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <span>⚠</span>
            <span>Invalid values detected. Negative values clamped to 0.</span>
          </div>
        )}

        {/* Header + Total (tighter spacing) */}
        <div className={cn("text-center", compact ? "space-y-1" : "space-y-2")}>
          <h2 className={cn(
            "font-semibold text-foreground",
            compact ? "text-base" : "text-lg md:text-xl"
          )}>
            {title}
          </h2>
          {subtitle && !compact && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
          {/* Total display */}
          <div className={cn("flex flex-col items-center", compact ? "gap-0" : "gap-0.5 pt-1")}>
            <span className={cn(
              "font-bold tabular-nums tracking-tight text-foreground",
              compact ? "text-2xl" : "text-4xl md:text-5xl"
            )}>
              {formatNumber(prefersReducedMotion ? total : animatedTotal)}
            </span>
            <span className={cn(
              "text-muted-foreground",
              compact ? "text-[10px]" : "text-xs"
            )}>
              {totalLabel}
            </span>
          </div>
        </div>

        {/* Stacked Bar with aligned labels */}
        <StackedPercentBar
          metrics={metricsWithPercent}
          palette={palette}
          hoveredKey={hoveredKey}
          onHover={setHoveredKey}
          isAnimated={isInView}
          prefersReducedMotion={prefersReducedMotion}
          compact={compact}
          barHeightClass={compact ? "h-3" : "h-5 md:h-6 lg:h-7"}
        />

        {/* Fallback legend for many metrics or mobile */}
        {showFallbackLegend && !compact && (
          <div className="pt-2 md:hidden">
            <FallbackLegend
              metrics={metricsWithPercent}
              palette={palette}
              hoveredKey={hoveredKey}
              onHover={setHoveredKey}
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
