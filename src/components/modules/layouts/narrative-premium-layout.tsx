"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Compass, TrendingUp, MapIcon, Sparkles } from "lucide-react";

export interface NarrativePremiumLayoutProps {
  title: string;
  description?: string;
  sections: {
    key: string;
    label: string;
    content: React.ReactNode;
    isEmpty?: boolean;
  }[];
}

// Section configuration with visual hierarchy
type SectionVariant = "vision" | "progress" | "roadmap";

interface SectionConfig {
  icon: React.ReactNode;
  subtitle: string;
  emptyText: string;
  variant: SectionVariant;
}

const SECTION_CONFIG: Record<string, SectionConfig> = {
  "end-vision": {
    icon: <Compass className="h-4 w-4" />,
    subtitle: "North Star",
    emptyText: "No vision defined yet.",
    variant: "vision",
  },
  progress: {
    icon: <TrendingUp className="h-4 w-4" />,
    subtitle: "What's true now",
    emptyText: "No updates yet.",
    variant: "progress",
  },
  roadmap: {
    icon: <MapIcon className="h-4 w-4" />,
    subtitle: "What we'll do next",
    emptyText: "No roadmap defined yet.",
    variant: "roadmap",
  },
};

const DEFAULT_CONFIG: SectionConfig = {
  icon: <Compass className="h-4 w-4" />,
  subtitle: "",
  emptyText: "No content yet.",
  variant: "vision",
};

// ─────────────────────────────────────────────────────────────────────────────
// Empty States
// ─────────────────────────────────────────────────────────────────────────────

function EmptyStateVision({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/40 bg-card/20 px-5 py-6">
      <Sparkles className="h-5 w-5 text-primary/40" />
      <p className="text-[14px] text-muted-foreground/70">{text}</p>
    </div>
  );
}

function EmptyStateProgress({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-border/40 bg-card/20 px-4 py-4">
      <p className="text-[13px] italic text-muted-foreground/60">{text}</p>
    </div>
  );
}

function EmptyStateRoadmap({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-border/40 bg-card/20 px-4 py-4">
      <p className="text-[13px] italic text-muted-foreground/60">{text}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vision Panel (North Star) - Hero anchor panel
// ─────────────────────────────────────────────────────────────────────────────

const VisionPanel = React.forwardRef<
  HTMLElement,
  {
    id: string;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    isEmpty?: boolean;
    emptyText: string;
    children: React.ReactNode;
    className?: string;
  }
>(function VisionPanel(
  { id, title, subtitle, icon, isEmpty, emptyText, children, className },
  ref
) {
  return (
    <section
      ref={ref}
      id={id}
      aria-label={title}
      className={cn(
        // Outer root: overflow-hidden + isolate ensures all FX are clipped
        // No fixed heights - panel sizes to content
        "warp-grain group relative isolate flex flex-col overflow-hidden rounded-xl",
        "border border-border/25",
        "bg-card/30",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.015)]",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1",
        "scroll-mt-20",
        "transition-[border-color,background-color] duration-200 ease-out",
        "hover:border-border/40 hover:bg-card/38",
        className
      )}
      style={{ animationFillMode: "backwards" }}
    >
      {/* ══ FX Layer (clipped, no blur, no edge-touching elements) ══ */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        aria-hidden="true"
      >
        {/* Left accent rail - inset 1px from edge to avoid clipping artifacts */}
        <div
          className="absolute bottom-2 left-[1px] top-2 w-px"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,255,51,0.18) 0%, rgba(0,255,51,0.06) 60%, transparent 100%)",
          }}
        />
        {/* Corner accent - positioned INSIDE panel (8px offset), soft multi-stop gradient */}
        <div
          className="absolute left-2 top-2 h-24 w-24"
          style={{
            background:
              "radial-gradient(ellipse 100% 100% at 0% 0%, rgba(0,255,51,0.025) 0%, rgba(0,255,51,0.012) 35%, rgba(0,255,51,0.004) 55%, transparent 75%)",
          }}
        />
      </div>

      {/* ══ Content Layer ══ */}
      <div className="relative z-10 p-5 lg:p-6">
        <div className="mb-3 flex items-center gap-2">
          <div
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
              "bg-primary/5 text-primary/55",
              "transition-colors duration-200 group-hover:bg-primary/8 group-hover:text-primary/75"
            )}
          >
            {icon}
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-primary/50">
            {subtitle}
          </span>
        </div>
        <div className="module-content narrative-premium-content narrative-premium-vision">
          {isEmpty ? (
            <EmptyStateVision text={emptyText} />
          ) : (
            <div className="max-w-[68ch]">{children}</div>
          )}
        </div>
      </div>
    </section>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Progress Panel - Status rows
// ─────────────────────────────────────────────────────────────────────────────

const ProgressPanel = React.forwardRef<
  HTMLElement,
  {
    id: string;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    isEmpty?: boolean;
    emptyText: string;
    children: React.ReactNode;
    className?: string;
  }
>(function ProgressPanel(
  { id, title, subtitle, icon, isEmpty, emptyText, children, className },
  ref
) {
  return (
    <section
      ref={ref}
      id={id}
      className={cn(
        // Outer root: overflow-hidden + isolate ensures all FX are clipped
        // No fixed heights - panel sizes to content
        "warp-grain group relative isolate flex flex-col overflow-hidden rounded-xl",
        "border border-border/25",
        "bg-card/22",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.01)]",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1",
        "scroll-mt-20",
        "transition-[border-color,background-color] duration-200 ease-out",
        "hover:border-border/38 hover:bg-card/30",
        className
      )}
      style={{ animationDelay: "50ms", animationFillMode: "backwards" }}
    >
      {/* ══ FX Layer (clipped, no edge-touching elements) ══ */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        aria-hidden="true"
      >
        {/* Top accent line - inset from edges */}
        <div
          className="absolute left-3 right-3 top-[1px] h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(0,255,51,0.08) 25%, rgba(0,255,51,0.12) 50%, rgba(0,255,51,0.08) 75%, transparent 100%)",
          }}
        />
      </div>

      {/* ══ Content Layer ══ */}
      <div className="relative z-10 p-4 lg:p-5">
        <div className="mb-3 flex items-center gap-2">
          <div
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded",
              "bg-primary/4 text-primary/40",
              "transition-colors duration-200 group-hover:bg-primary/6 group-hover:text-primary/60"
            )}
          >
            {icon}
          </div>
          <div>
            <h2 className="text-[13px] font-semibold tracking-tight text-foreground/75">
              {title}
            </h2>
            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/35">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="module-content narrative-premium-content narrative-premium-progress">
          {isEmpty ? <EmptyStateProgress text={emptyText} /> : children}
        </div>
      </div>
    </section>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Roadmap Panel - Bullet list (no timeline)
// ─────────────────────────────────────────────────────────────────────────────

const RoadmapPanel = React.forwardRef<
  HTMLElement,
  {
    id: string;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    isEmpty?: boolean;
    emptyText: string;
    children: React.ReactNode;
    className?: string;
  }
>(function RoadmapPanel(
  { id, title, subtitle, icon, isEmpty, emptyText, children, className },
  ref
) {
  return (
    <section
      ref={ref}
      id={id}
      className={cn(
        // Outer root: overflow-hidden + isolate ensures all FX are clipped
        // No fixed heights - panel sizes to content
        "warp-grain group relative isolate flex flex-col overflow-hidden rounded-xl",
        "border border-border/25",
        "bg-card/22",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.01)]",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1",
        "scroll-mt-20",
        "transition-[border-color,background-color] duration-200 ease-out",
        "hover:border-border/38 hover:bg-card/30",
        className
      )}
      style={{ animationDelay: "75ms", animationFillMode: "backwards" }}
    >
      {/* ══ FX Layer (clipped, no edge-touching elements) ══ */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        aria-hidden="true"
      >
        {/* Left accent rail - inset from edges */}
        <div
          className="absolute bottom-3 left-[1px] top-3 w-px"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,255,51,0.10) 0%, rgba(0,255,51,0.03) 70%, transparent 100%)",
          }}
        />
      </div>

      {/* ══ Content Layer ══ */}
      <div className="relative z-10 p-4 lg:p-5">
        <div className="mb-3 flex items-center gap-2">
          <div
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded",
              "bg-primary/4 text-primary/40",
              "transition-colors duration-200 group-hover:bg-primary/6 group-hover:text-primary/60"
            )}
          >
            {icon}
          </div>
          <div>
            <h2 className="text-[13px] font-semibold tracking-tight text-foreground/75">
              {title}
            </h2>
            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/35">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="module-content narrative-premium-content narrative-premium-roadmap">
          {isEmpty ? <EmptyStateRoadmap text={emptyText} /> : children}
        </div>
      </div>
    </section>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Section Jump Nav - Compact anchor links (works on all screen sizes)
// ─────────────────────────────────────────────────────────────────────────────

function SectionJumpNav({
  sections,
  onNavigate,
}: {
  sections: { key: string; label: string }[];
  onNavigate: (key: string) => void;
}) {
  return (
    <nav
      className="relative z-10 mb-4 flex flex-wrap items-center gap-1"
      aria-label="Jump to section"
    >
      <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/40">
        Jump to:
      </span>
      {sections.map((section, index) => {
        const config = SECTION_CONFIG[section.key] ?? DEFAULT_CONFIG;
        return (
          <React.Fragment key={section.key}>
            {index > 0 && (
              <span className="mx-1 h-3 w-px bg-border/20" aria-hidden="true" />
            )}
            <button
              type="button"
              onClick={() => onNavigate(section.key)}
              className={cn(
                "group/nav flex items-center gap-1.5 rounded-md px-2 py-1",
                "text-[12px] font-medium transition-all duration-200",
                "text-muted-foreground/60 hover:bg-card/30 hover:text-foreground/85"
              )}
            >
              <span className="text-primary/40 transition-colors duration-200 group-hover/nav:text-primary/70">
                {config.icon}
              </span>
              <span>{section.label}</span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Render Panel - Dispatch to correct variant
// ─────────────────────────────────────────────────────────────────────────────

function renderPanel(
  section: { key: string; label: string; content: React.ReactNode; isEmpty?: boolean },
  config: SectionConfig,
  className?: string
) {
  const commonProps = {
    id: section.key,
    title: section.label,
    subtitle: config.subtitle,
    icon: config.icon,
    isEmpty: section.isEmpty,
    emptyText: config.emptyText,
    className,
  };

  switch (config.variant) {
    case "vision":
      return <VisionPanel {...commonProps}>{section.content}</VisionPanel>;
    case "progress":
      return <ProgressPanel {...commonProps}>{section.content}</ProgressPanel>;
    case "roadmap":
      return <RoadmapPanel {...commonProps}>{section.content}</RoadmapPanel>;
    default:
      return <VisionPanel {...commonProps}>{section.content}</VisionPanel>;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Layout
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Premium full-width narrative layout for strategic module pages.
 * All screen sizes: Stacked vertical layout with full-width panels.
 * No tabs, no content hiding - all sections always visible.
 *
 * Structure:
 * 1. Header zone (clean, no background effects)
 * 2. Section jump nav (anchor links to scroll)
 * 3. Canvas zone (stacked panels with premium background effects)
 */
export function NarrativePremiumLayout({
  title,
  description,
  sections,
}: NarrativePremiumLayoutProps) {
  // Navigate to section via ID (panels have id={section.key})
  const handleNavigate = React.useCallback((key: string) => {
    const el = document.getElementById(key);
    if (!el) return;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    el.scrollIntoView({
      behavior: prefersReducedMotion ? "instant" : "smooth",
      block: "start",
    });
  }, []);

  const showHeader = Boolean(title);

  // Lookup sections by key for rendering order
  const visionSection = sections.find((s) => s.key === "end-vision");
  const progressSection = sections.find((s) => s.key === "progress");
  const roadmapSection = sections.find((s) => s.key === "roadmap");

  return (
    <article className="narrative-premium relative w-full max-w-none">
      {/* ═══════════════════════════════════════════════════════════════════════
          HEADER ZONE - Clean, no background effects
          ═══════════════════════════════════════════════════════════════════════ */}
      {showHeader && (
        <header className="relative z-10 mb-5 space-y-1">
          <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.025em] text-foreground">
            {title}
          </h1>
          {description && (
            <p className="max-w-[65ch] text-[14px] leading-[1.55] text-muted-foreground/75">
              {description}
            </p>
          )}
        </header>
      )}

      {/* Section jump nav - works on all screen sizes */}
      <SectionJumpNav sections={sections} onNavigate={handleNavigate} />

      {/* ═══════════════════════════════════════════════════════════════════════
          CANVAS ZONE - Stacked vertical layout (full-width panels)
          All sections always visible, no tabs/hiding
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="warp-grain-canvas relative isolate overflow-hidden rounded-xl pt-1">
        {/* Subtle top boundary line - inset from edges */}
        <div
          className="pointer-events-none absolute left-4 right-4 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.025) 30%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.025) 70%, transparent 100%)",
          }}
          aria-hidden="true"
        />

        {/* All sections stacked vertically (mobile + desktop) */}
        <div className="relative z-10 flex flex-col gap-4 sm:gap-5">
          {visionSection &&
            renderPanel(
              visionSection,
              SECTION_CONFIG["end-vision"] ?? DEFAULT_CONFIG
            )}
          {progressSection &&
            renderPanel(
              progressSection,
              SECTION_CONFIG["progress"] ?? DEFAULT_CONFIG
            )}
          {roadmapSection &&
            renderPanel(
              roadmapSection,
              SECTION_CONFIG["roadmap"] ?? DEFAULT_CONFIG
            )}
        </div>
      </div>
    </article>
  );
}

