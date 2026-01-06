"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { MetricsFlowItem, MetricsFlowIconKey } from "@/config/modules";
import { Truck, Package, Warehouse } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MetricsFlowCardProps {
  title: string;
  subtitle?: string;
  totalLabel: string;
  metrics: MetricsFlowItem[];
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────────────────────────────────────

const numberFormatter = new Intl.NumberFormat("en-US");

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function computeTotal(metrics: MetricsFlowItem[]): number {
  return metrics.reduce((sum, m) => sum + m.value, 0);
}

function computePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

// Accent colors palette for metrics (cycles for >4 metrics)
const ACCENT_PALETTE = [
  { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-500", path: "stroke-blue-400", dot: "bg-blue-500" },
  { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-500", path: "stroke-emerald-400", dot: "bg-emerald-500" },
  { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-500", path: "stroke-amber-400", dot: "bg-amber-500" },
  { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-500", path: "stroke-purple-400", dot: "bg-purple-500" },
  { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-500", path: "stroke-rose-400", dot: "bg-rose-500" },
  { bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-500", path: "stroke-cyan-400", dot: "bg-cyan-500" },
  { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-500", path: "stroke-orange-400", dot: "bg-orange-500" },
  { bg: "bg-indigo-500/10", border: "border-indigo-500/30", text: "text-indigo-500", path: "stroke-indigo-400", dot: "bg-indigo-500" },
];

function getAccent(index: number) {
  return ACCENT_PALETTE[index % ACCENT_PALETTE.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function MetricIcon({ icon, className }: { icon: MetricsFlowIconKey; className?: string }) {
  const iconClass = cn("h-5 w-5", className);
  switch (icon) {
    case "box-truck":
      return <Truck className={iconClass} />;
    case "cargo-van":
      return <Package className={iconClass} />; // Using Package as cargo van proxy
    case "trailer":
      return <Truck className={iconClass} />;
    case "package":
      return <Package className={iconClass} />;
    case "warehouse":
      return <Warehouse className={iconClass} />;
    default:
      return <Package className={iconClass} />;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// useCountUp hook
// ─────────────────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = React.useState(0);
  const [hasAnimated, setHasAnimated] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (hasAnimated) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setCount(target);
      setHasAnimated(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true);
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
        }
      },
      { threshold: 0.2 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration, hasAnimated]);

  return { count, ref };
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric Source Card
// ─────────────────────────────────────────────────────────────────────────────

function MetricSourceCard({
  metric,
  index,
  total,
  isHovered,
  onHover,
  compact = false,
}: {
  metric: MetricsFlowItem;
  index: number;
  total: number;
  isHovered: boolean;
  onHover: (key: string | null) => void;
  compact?: boolean;
}) {
  const accent = getAccent(index);
  const percentage = computePercentage(metric.value, total);
  const { count, ref } = useCountUp(metric.value);

  const tooltipContent = `${metric.label}: ${formatNumber(metric.value)} (${percentage}% of total)`;

  if (compact) {
    // Compact row layout for 5+ metrics
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={ref}
            className={cn(
              "flex cursor-default items-center gap-3 rounded-lg border px-3 py-2 transition-all duration-200",
              accent.bg,
              accent.border,
              isHovered && "ring-2 ring-offset-1 ring-offset-background",
              isHovered && accent.text.replace("text-", "ring-")
            )}
            onMouseEnter={() => onHover(metric.key)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(metric.key)}
            onBlur={() => onHover(null)}
            tabIndex={0}
            role="button"
            aria-label={tooltipContent}
          >
            <div className={cn("rounded p-1.5", accent.bg)}>
              <MetricIcon icon={metric.icon} className={cn(accent.text, "h-4 w-4")} />
            </div>
            <span className="flex-1 text-sm font-medium text-foreground">{metric.label}</span>
            <span className={cn("text-lg font-semibold tabular-nums", accent.text)}>
              {formatNumber(count)}
            </span>
            <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
              {percentage}%
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Card layout for 2-4 metrics
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={ref}
          className={cn(
            "relative flex cursor-default flex-col items-center gap-2 rounded-xl border p-4 transition-all duration-200",
            accent.bg,
            accent.border,
            isHovered && "ring-2 ring-offset-2 ring-offset-background",
            isHovered && accent.text.replace("text-", "ring-")
          )}
          onMouseEnter={() => onHover(metric.key)}
          onMouseLeave={() => onHover(null)}
          onFocus={() => onHover(metric.key)}
          onBlur={() => onHover(null)}
          tabIndex={0}
          role="button"
          aria-label={tooltipContent}
        >
          <div className={cn("rounded-lg p-2", accent.bg)}>
            <MetricIcon icon={metric.icon} className={accent.text} />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
          <span className={cn("text-2xl font-semibold tabular-nums", accent.text)}>
            {formatNumber(count)}
          </span>
          <span className="text-[10px] text-muted-foreground">{percentage}% of total</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipContent}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Total Card
// ─────────────────────────────────────────────────────────────────────────────

function TotalCard({
  total,
  label,
  metricLabels,
}: {
  total: number;
  label: string;
  metricLabels: string[];
}) {
  const { count, ref } = useCountUp(total);
  // Build equation string: "= Label1 + Label2 + ..."
  const equation =
    metricLabels.length <= 4
      ? `= ${metricLabels.join(" + ")}`
      : `= sum of ${metricLabels.length} sources`;

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-primary/30 bg-primary/5 p-6",
        "shadow-[0_0_30px_-8px] shadow-primary/20"
      )}
    >
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-4xl font-bold tabular-nums text-primary md:text-5xl">
        {formatNumber(count)}
      </span>
      <span className="text-[10px] text-muted-foreground">{equation}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Flow Paths SVG
// ─────────────────────────────────────────────────────────────────────────────

function FlowPaths({
  metrics,
  hoveredKey,
}: {
  metrics: MetricsFlowItem[];
  hoveredKey: string | null;
}) {
  const count = metrics.length;
  // Dynamically calculate viewBox height based on metric count
  const spacing = count <= 4 ? 60 : 40;
  const padding = 20;
  const totalHeight = padding * 2 + (count - 1) * spacing;
  const centerY = totalHeight / 2;

  const paths = metrics.map((metric, idx) => {
    const accent = getAccent(idx);
    const isHovered = hoveredKey === metric.key;
    const y1 = padding + idx * spacing;
    const y2 = centerY;

    // Bezier curve from (0, y1) to (100, y2)
    const d = `M 0 ${y1} C 40 ${y1}, 60 ${y2}, 100 ${y2}`;

    return (
      <path
        key={metric.key}
        d={d}
        fill="none"
        className={cn(
          "transition-all duration-300",
          accent.path,
          isHovered ? "opacity-100" : "opacity-40",
          isHovered && "stroke-[3]"
        )}
        strokeWidth={isHovered ? 3 : 2}
        strokeLinecap="round"
        style={{
          strokeDasharray: isHovered ? "none" : "6 4",
        }}
      />
    );
  });

  return (
    <svg
      viewBox={`0 0 100 ${totalHeight}`}
      className="hidden w-24 flex-shrink-0 md:block"
      style={{ height: Math.min(totalHeight, 320) }}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Breakdown Row
// ─────────────────────────────────────────────────────────────────────────────

function BreakdownRow({ metrics, total }: { metrics: MetricsFlowItem[]; total: number }) {
  return (
    <div className="flex flex-wrap justify-center gap-4 pt-4">
      {metrics.map((metric, idx) => {
        const accent = getAccent(idx);
        const percentage = computePercentage(metric.value, total);
        return (
          <div key={metric.key} className="flex items-center gap-2 text-xs">
            <div className={cn("h-2 w-2 rounded-full", accent.dot)} />
            <span className="text-muted-foreground">{metric.label}:</span>
            <span className="font-medium tabular-nums">{percentage}%</span>
          </div>
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
  metrics,
  className,
}: MetricsFlowCardProps) {
  const [hoveredKey, setHoveredKey] = React.useState<string | null>(null);
  const total = computeTotal(metrics);
  const metricLabels = metrics.map((m) => m.label);

  // Empty state - no metrics
  if (!metrics.length) {
    return (
      <div className={cn("rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center", className)}>
        <p className="text-sm text-muted-foreground">No metrics configured yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">Add a Metrics Flow block in Admin → Content Studio.</p>
      </div>
    );
  }

  // All zeros state - show placeholder
  if (total === 0) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
          <p className="text-sm text-muted-foreground">No data recorded yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Metrics will appear here once values are entered.
          </p>
        </div>
      </div>
    );
  }

  // Use compact layout for 5+ metrics
  const useCompactLayout = metrics.length >= 5;

  // Grid columns for card layout
  const getGridCols = () => {
    if (metrics.length === 2) return "grid-cols-2";
    if (metrics.length <= 4) return "grid-cols-2 sm:grid-cols-4";
    return "";
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("space-y-6", className)}>
        {/* Header */}
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        {/* Flow visualization */}
        <div className={cn(
          "flex items-center justify-center gap-6",
          useCompactLayout ? "flex-col md:flex-row md:items-stretch" : "flex-col md:flex-row md:gap-4"
        )}>
          {/* Source cards/rows */}
          {useCompactLayout ? (
            // Compact stacked rows for 5+ metrics
            <div className="flex w-full max-w-md flex-col gap-2 md:w-auto md:min-w-[320px]">
              {metrics.map((metric, idx) => (
                <MetricSourceCard
                  key={metric.key}
                  metric={metric}
                  index={idx}
                  total={total}
                  isHovered={hoveredKey === metric.key}
                  onHover={setHoveredKey}
                  compact
                />
              ))}
            </div>
          ) : (
            // Card grid for 2-4 metrics
            <div className={cn("grid gap-3 md:flex md:flex-col md:gap-4", getGridCols())}>
              {metrics.map((metric, idx) => (
                <MetricSourceCard
                  key={metric.key}
                  metric={metric}
                  index={idx}
                  total={total}
                  isHovered={hoveredKey === metric.key}
                  onHover={setHoveredKey}
                />
              ))}
            </div>
          )}

          {/* Flow paths (desktop only, hide for compact layout) */}
          {!useCompactLayout && (
            <FlowPaths metrics={metrics} hoveredKey={hoveredKey} />
          )}

          {/* Merge spine for compact layout */}
          {useCompactLayout && (
            <div className="hidden w-8 flex-shrink-0 items-center justify-center md:flex">
              <div className="h-full w-0.5 rounded-full bg-gradient-to-b from-primary/20 via-primary/50 to-primary/20" />
            </div>
          )}

          {/* Total card */}
          <TotalCard total={total} label={totalLabel} metricLabels={metricLabels} />
        </div>

        {/* Breakdown row (hide for compact since it's already shown in rows) */}
        {!useCompactLayout && <BreakdownRow metrics={metrics} total={total} />}
      </div>
    </TooltipProvider>
  );
}
