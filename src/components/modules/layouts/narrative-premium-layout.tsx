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
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/40 bg-card/20 px-4 py-4">
      <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
      <p className="text-[13px] italic text-muted-foreground/60">{text}</p>
    </div>
  );
}

function EmptyStateRoadmap({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="relative flex flex-col items-center">
        <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/30 bg-card" />
        <div className="h-8 w-[2px] bg-border/30" />
      </div>
      <div className="flex-1 rounded-lg border border-dashed border-border/40 bg-card/20 px-4 py-3">
        <p className="text-[13px] italic text-muted-foreground/60">{text}</p>
      </div>
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
        "group relative flex h-full flex-col overflow-hidden rounded-2xl",
        "border border-border/50",
        "bg-gradient-to-br from-card/50 via-card/40 to-card/30",
        "backdrop-blur-sm",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3",
        "scroll-mt-[var(--warp-anchor-offset)]",
        "transition-all duration-300 ease-out",
        "hover:border-border/70 hover:bg-card/45",
        "hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_0_32px_-10px_rgba(0,255,51,0.12)]",
        className
      )}
      style={{ animationFillMode: "backwards" }}
    >
      {/* Left accent rail */}
      <div
        className="absolute bottom-0 left-0 top-0 w-[3px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,255,51,0.5) 0%, rgba(0,255,51,0.25) 50%, transparent 100%)",
        }}
        aria-hidden="true"
      />
      {/* Header gradient glow */}
      <div
        className="pointer-events-none absolute -left-20 -top-20 h-40 w-40 opacity-30"
        style={{
          background:
            "radial-gradient(circle, rgba(0,255,51,0.15) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div className="relative flex flex-1 flex-col p-6 lg:p-8">
        {/* Compact label header */}
        <div className="mb-5 flex items-center gap-2.5">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
              "bg-primary/10 text-primary/80",
              "transition-colors duration-200 group-hover:bg-primary/15 group-hover:text-primary"
            )}
          >
            {icon}
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/70">
            {subtitle}
          </span>
        </div>
        {/* Main content - larger, hero treatment */}
        <div className="module-content narrative-premium-content narrative-premium-vision flex-1">
          {isEmpty ? (
            <EmptyStateVision text={emptyText} />
          ) : (
            <div className="max-w-[55ch]">{children}</div>
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
        "group relative flex h-full flex-col overflow-hidden rounded-2xl",
        "border border-border/50",
        "bg-card/35 backdrop-blur-sm",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2",
        "scroll-mt-[var(--warp-anchor-offset)]",
        "transition-all duration-200 ease-out",
        "hover:border-border/65 hover:bg-card/45",
        "hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_0_24px_-8px_rgba(0,255,51,0.08)]",
        className
      )}
      style={{ animationDelay: "75ms", animationFillMode: "backwards" }}
    >
      {/* Top accent line */}
      <div
        className="absolute left-0 right-0 top-0 h-[2px]"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(0,255,51,0.25) 30%, rgba(0,255,51,0.35) 50%, rgba(0,255,51,0.25) 70%, transparent 100%)",
        }}
        aria-hidden="true"
      />
      <div className="relative flex flex-1 flex-col p-5 lg:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
              "bg-primary/8 text-primary/60",
              "transition-colors duration-200 group-hover:bg-primary/12 group-hover:text-primary/80"
            )}
          >
            {icon}
          </div>
          <div>
            <h2 className="text-[14px] font-semibold tracking-tight text-foreground/90">
              {title}
            </h2>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="module-content narrative-premium-content narrative-premium-progress flex-1">
          {isEmpty ? (
            <EmptyStateProgress text={emptyText} />
          ) : (
            children
          )}
        </div>
      </div>
    </section>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Roadmap Panel - Timeline visual
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
        "group relative flex h-full flex-col overflow-hidden rounded-2xl",
        "border border-border/50",
        "bg-card/35 backdrop-blur-sm",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2",
        "scroll-mt-[var(--warp-anchor-offset)]",
        "transition-all duration-200 ease-out",
        "hover:border-border/65 hover:bg-card/45",
        "hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_0_24px_-8px_rgba(0,255,51,0.08)]",
        className
      )}
      style={{ animationDelay: "150ms", animationFillMode: "backwards" }}
    >
      {/* Left accent rail */}
      <div
        className="absolute bottom-0 left-0 top-0 w-[2px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,255,51,0.3) 0%, rgba(0,255,51,0.15) 70%, transparent 100%)",
        }}
        aria-hidden="true"
      />
      <div className="relative flex flex-1 flex-col p-5 lg:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
              "bg-primary/8 text-primary/60",
              "transition-colors duration-200 group-hover:bg-primary/12 group-hover:text-primary/80"
            )}
          >
            {icon}
          </div>
          <div>
            <h2 className="text-[14px] font-semibold tracking-tight text-foreground/90">
              {title}
            </h2>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="module-content narrative-premium-content narrative-premium-roadmap flex-1">
          {isEmpty ? (
            <EmptyStateRoadmap text={emptyText} />
          ) : (
            children
          )}
        </div>
      </div>
    </section>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Mobile Section Tabs - Premium segmented control
// ─────────────────────────────────────────────────────────────────────────────

function MobileSectionTabs({
  sections,
  activeKey,
  onSelect,
}: {
  sections: { key: string; label: string }[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div
      className={cn(
        "relative flex w-full overflow-hidden rounded-xl p-1",
        "border border-border/50 bg-card/25 backdrop-blur-sm"
      )}
    >
      {sections.map((section) => {
        const isActive = section.key === activeKey;
        const config = SECTION_CONFIG[section.key] ?? DEFAULT_CONFIG;
        return (
          <button
            key={section.key}
            type="button"
            onClick={() => onSelect(section.key)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5",
              "text-[13px] font-medium transition-all duration-200",
              isActive
                ? "bg-card text-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground/80"
            )}
            aria-pressed={isActive}
          >
            <span
              className={cn(
                "transition-colors duration-200",
                isActive ? "text-primary" : "text-muted-foreground/50"
              )}
            >
              {config.icon}
            </span>
            <span>{section.label}</span>
            {isActive && (
              <div
                className="absolute bottom-0 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full"
                style={{ background: "rgba(0,255,51,0.5)" }}
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Desktop Section Nav - Premium indicator bar
// ─────────────────────────────────────────────────────────────────────────────

function DesktopSectionNav({
  sections,
  onNavigate,
}: {
  sections: { key: string; label: string }[];
  onNavigate: (key: string) => void;
}) {
  return (
    <nav
      className="mb-6 hidden items-center gap-1 lg:flex"
      aria-label="Section navigation"
    >
      {sections.map((section, index) => {
        const config = SECTION_CONFIG[section.key] ?? DEFAULT_CONFIG;
        return (
          <React.Fragment key={section.key}>
            {index > 0 && (
              <span className="mx-3 h-4 w-px bg-border/40" aria-hidden="true" />
            )}
            <button
              type="button"
              onClick={() => onNavigate(section.key)}
              className={cn(
                "group/nav flex items-center gap-2 rounded-lg px-3 py-1.5",
                "text-[13px] font-medium text-muted-foreground/70",
                "transition-all duration-200",
                "hover:bg-card/30 hover:text-foreground/90"
              )}
            >
              <span className="text-primary/50 transition-colors duration-200 group-hover/nav:text-primary/80">
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
 * Desktop: 2-column bento (Vision anchors left, Progress/Roadmap stacked right).
 * Mobile: Segmented tabs with single panel view.
 */
export function NarrativePremiumLayout({
  title,
  description,
  sections,
}: NarrativePremiumLayoutProps) {
  const [activeTab, setActiveTab] = React.useState(
    sections[0]?.key ?? "end-vision"
  );

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

  // Lookup sections by key for grid placement
  const visionSection = sections.find((s) => s.key === "end-vision");
  const progressSection = sections.find((s) => s.key === "progress");
  const roadmapSection = sections.find((s) => s.key === "roadmap");

  return (
    <article className="relative w-full max-w-none">
      {/* Canvas background treatment */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        {/* Radial gradient wash */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 30% 20%, rgba(0,0,0,0.3) 0%, transparent 70%)",
          }}
        />
        {/* Warp green accent glow */}
        <div
          className="absolute -left-32 -top-32 h-64 w-64 opacity-20 motion-safe:animate-pulse"
          style={{
            background:
              "radial-gradient(circle, rgba(0,255,51,0.15) 0%, transparent 60%)",
            animationDuration: "8s",
          }}
        />
        {/* Subtle noise texture via CSS gradients */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `
              repeating-linear-gradient(
                45deg,
                transparent,
                transparent 2px,
                rgba(255,255,255,0.03) 2px,
                rgba(255,255,255,0.03) 4px
              )
            `,
          }}
        />
      </div>

      {showHeader && (
        <header className="mb-8 space-y-2">
          <h1 className="text-[24px] font-semibold leading-[1.25] tracking-[-0.025em] text-foreground">
            {title}
          </h1>
          {description && (
            <p className="max-w-[65ch] text-[14px] leading-[1.65] text-muted-foreground/85">
              {description}
            </p>
          )}
        </header>
      )}

      <DesktopSectionNav sections={sections} onNavigate={handleNavigate} />

      <div className="mb-5 lg:hidden">
        <MobileSectionTabs
          sections={sections}
          activeKey={activeTab}
          onSelect={setActiveTab}
        />
      </div>

      {/* Desktop: 2-column bento grid */}
      <div className="hidden gap-5 lg:grid lg:grid-cols-12 lg:grid-rows-[auto_auto]">
        {/* Left: Vision panel spans 7 cols and 2 rows */}
        {visionSection && (
          <div className="lg:col-span-7 lg:row-span-2">
            {renderPanel(
              visionSection,
              SECTION_CONFIG["end-vision"] ?? DEFAULT_CONFIG,
              "h-full"
            )}
          </div>
        )}
        {/* Right top: Progress panel */}
        {progressSection && (
          <div className="lg:col-span-5">
            {renderPanel(
              progressSection,
              SECTION_CONFIG["progress"] ?? DEFAULT_CONFIG
            )}
          </div>
        )}
        {/* Right bottom: Roadmap panel */}
        {roadmapSection && (
          <div className="lg:col-span-5">
            {renderPanel(
              roadmapSection,
              SECTION_CONFIG["roadmap"] ?? DEFAULT_CONFIG
            )}
          </div>
        )}
      </div>

      {/* Mobile: Single panel view */}
      <div className="lg:hidden">
        {sections.map((section) => {
          if (section.key !== activeTab) return null;
          const config = SECTION_CONFIG[section.key] ?? DEFAULT_CONFIG;
          return (
            <div
              key={section.key}
              className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150"
            >
              {renderPanel(section, config)}
            </div>
          );
        })}
      </div>
    </article>
  );
}

