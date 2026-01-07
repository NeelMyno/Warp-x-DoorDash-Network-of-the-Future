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
        // Outer root: overflow-hidden ensures all FX are clipped to rounded shape
        "group relative flex h-full flex-col overflow-hidden rounded-xl",
        "border border-border/35",
        "bg-gradient-to-br from-card/40 via-card/30 to-card/20",
        "backdrop-blur-sm",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.025)]",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1",
        "scroll-mt-20",
        "transition-all duration-200 ease-out",
        "hover:border-border/50 hover:from-card/45 hover:via-card/35 hover:to-card/25",
        "hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),0_0_20px_-10px_rgba(0,255,51,0.06)]",
        className
      )}
      style={{ animationFillMode: "backwards" }}
    >
      {/* ══ FX Layer (clipped by parent overflow-hidden) ══ */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        aria-hidden="true"
      >
        {/* Left accent rail - inside bounds */}
        <div
          className="absolute bottom-0 left-0 top-0 w-[2px]"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,255,51,0.28) 0%, rgba(0,255,51,0.10) 70%, transparent 100%)",
          }}
        />
        {/* Corner glow - positioned inside panel, uses blur for soft edge */}
        <div
          className="absolute left-0 top-0 h-28 w-28 opacity-[0.06] blur-2xl"
          style={{
            background:
              "radial-gradient(circle at 0% 0%, rgba(0,255,51,0.5) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* ══ Content Layer ══ */}
      <div className="relative z-10 flex flex-1 flex-col p-5 lg:p-6">
        {/* Compact label header */}
        <div className="mb-3 flex items-center gap-2">
          <div
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
              "bg-primary/6 text-primary/60",
              "transition-colors duration-200 group-hover:bg-primary/10 group-hover:text-primary/80"
            )}
          >
            {icon}
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-primary/55">
            {subtitle}
          </span>
        </div>
        {/* Main content with readability max-width */}
        <div className="module-content narrative-premium-content narrative-premium-vision flex-1">
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
        // Outer root: overflow-hidden ensures all FX are clipped
        "group relative flex h-full flex-col overflow-hidden rounded-xl",
        "border border-border/35",
        "bg-card/25 backdrop-blur-sm",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1",
        "scroll-mt-20",
        "transition-all duration-200 ease-out",
        "hover:border-border/45 hover:bg-card/32",
        "hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03),0_0_16px_-8px_rgba(0,255,51,0.04)]",
        className
      )}
      style={{ animationDelay: "50ms", animationFillMode: "backwards" }}
    >
      {/* ══ FX Layer (clipped by parent overflow-hidden) ══ */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        aria-hidden="true"
      >
        {/* Top accent line */}
        <div
          className="absolute left-0 right-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(0,255,51,0.15) 30%, rgba(0,255,51,0.18) 50%, rgba(0,255,51,0.15) 70%, transparent 100%)",
          }}
        />
      </div>

      {/* ══ Content Layer ══ */}
      <div className="relative z-10 flex flex-1 flex-col p-4 lg:p-5">
        <div className="mb-3 flex items-center gap-2">
          <div
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded",
              "bg-primary/5 text-primary/45",
              "transition-colors duration-200 group-hover:bg-primary/8 group-hover:text-primary/65"
            )}
          >
            {icon}
          </div>
          <div>
            <h2 className="text-[13px] font-semibold tracking-tight text-foreground/80">
              {title}
            </h2>
            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/40">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="module-content narrative-premium-content narrative-premium-progress flex-1">
          {isEmpty ? <EmptyStateProgress text={emptyText} /> : children}
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
        // Outer root: overflow-hidden ensures all FX are clipped
        "group relative flex h-full flex-col overflow-hidden rounded-xl",
        "border border-border/35",
        "bg-card/25 backdrop-blur-sm",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1",
        "scroll-mt-20",
        "transition-all duration-200 ease-out",
        "hover:border-border/45 hover:bg-card/32",
        "hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03),0_0_16px_-8px_rgba(0,255,51,0.04)]",
        className
      )}
      style={{ animationDelay: "75ms", animationFillMode: "backwards" }}
    >
      {/* ══ FX Layer (clipped by parent overflow-hidden) ══ */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        aria-hidden="true"
      >
        {/* Left accent rail */}
        <div
          className="absolute bottom-0 left-0 top-0 w-px"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,255,51,0.16) 0%, rgba(0,255,51,0.06) 70%, transparent 100%)",
          }}
        />
      </div>

      {/* ══ Content Layer ══ */}
      <div className="relative z-10 flex flex-1 flex-col p-4 lg:p-5">
        <div className="mb-3 flex items-center gap-2">
          <div
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded",
              "bg-primary/5 text-primary/45",
              "transition-colors duration-200 group-hover:bg-primary/8 group-hover:text-primary/65"
            )}
          >
            {icon}
          </div>
          <div>
            <h2 className="text-[13px] font-semibold tracking-tight text-foreground/80">
              {title}
            </h2>
            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/40">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="module-content narrative-premium-content narrative-premium-roadmap flex-1">
          {isEmpty ? <EmptyStateRoadmap text={emptyText} /> : children}
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
  const [activeKey, setActiveKey] = React.useState<string | null>(null);

  const handleClick = (key: string) => {
    setActiveKey(key);
    onNavigate(key);
  };

  return (
    <nav
      className="relative z-10 mb-4 hidden items-center gap-0.5 lg:flex"
      aria-label="Section navigation"
    >
      {sections.map((section, index) => {
        const config = SECTION_CONFIG[section.key] ?? DEFAULT_CONFIG;
        const isActive = activeKey === section.key;
        return (
          <React.Fragment key={section.key}>
            {index > 0 && (
              <span className="mx-2 h-3 w-px bg-border/25" aria-hidden="true" />
            )}
            <button
              type="button"
              onClick={() => handleClick(section.key)}
              className={cn(
                "group/nav relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5",
                "text-[13px] font-medium transition-all duration-200",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground/55 hover:bg-card/30 hover:text-foreground/85"
              )}
              aria-current={isActive ? "true" : undefined}
            >
              <span
                className={cn(
                  "transition-colors duration-200",
                  isActive
                    ? "text-primary/80"
                    : "text-primary/35 group-hover/nav:text-primary/60"
                )}
              >
                {config.icon}
              </span>
              <span>{section.label}</span>
              {/* Active/hover indicator */}
              <span
                className={cn(
                  "absolute bottom-0 left-2 right-2 h-[2px] rounded-full transition-all duration-200",
                  isActive
                    ? "bg-primary/50"
                    : "bg-transparent group-hover/nav:bg-primary/20"
                )}
                aria-hidden="true"
              />
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
 *
 * Structure:
 * 1. Header zone (clean, no background effects)
 * 2. Section nav
 * 3. Canvas zone (premium background effects scoped here only)
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

      {/* Desktop section nav */}
      <DesktopSectionNav sections={sections} onNavigate={handleNavigate} />

      {/* Mobile tabs */}
      <div className="mb-4 lg:hidden">
        <MobileSectionTabs
          sections={sections}
          activeKey={activeTab}
          onSelect={setActiveTab}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          CANVAS ZONE - Premium background effects scoped here only
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="relative isolate pt-1">
        {/* Subtle top fade-in boundary (visual separator from header) */}
        <div
          className="pointer-events-none absolute -top-px left-0 right-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 20%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.04) 80%, transparent 100%)",
          }}
          aria-hidden="true"
        />

        {/* Premium canvas background - absolutely positioned, z-0 */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          aria-hidden="true"
        >
          {/* Soft depth wash - fades toward edges */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 30% 40%, rgba(0,0,0,0.08) 0%, transparent 55%)",
            }}
          />
          {/* Accent glow - very subtle, respects reduced motion */}
          <div
            className="absolute -left-20 -top-20 h-40 w-40 opacity-[0.05] motion-safe:animate-pulse"
            style={{
              background:
                "radial-gradient(circle, rgba(0,255,51,0.3) 0%, transparent 65%)",
              animationDuration: "12s",
            }}
          />
        </div>

        {/* Desktop: 2-column bento grid */}
        <div className="relative z-10 hidden gap-5 lg:grid lg:grid-cols-12">
          {/* Left: Vision panel spans 7 cols and 2 rows */}
          {visionSection && (
            <div className="lg:col-span-7 lg:row-span-2">
              {renderPanel(
                visionSection,
                SECTION_CONFIG["end-vision"] ?? DEFAULT_CONFIG,
                "h-full min-h-[340px]"
              )}
            </div>
          )}
          {/* Right top: Progress panel */}
          {progressSection && (
            <div className="lg:col-span-5">
              {renderPanel(
                progressSection,
                SECTION_CONFIG["progress"] ?? DEFAULT_CONFIG,
                "min-h-[160px]"
              )}
            </div>
          )}
          {/* Right bottom: Roadmap panel */}
          {roadmapSection && (
            <div className="lg:col-span-5">
              {renderPanel(
                roadmapSection,
                SECTION_CONFIG["roadmap"] ?? DEFAULT_CONFIG,
                "min-h-[160px]"
              )}
            </div>
          )}
        </div>

        {/* Mobile: Single panel view */}
        <div className="relative z-10 lg:hidden">
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
      </div>
    </article>
  );
}

