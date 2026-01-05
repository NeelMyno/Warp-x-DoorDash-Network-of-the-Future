"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isHiddenUntilExpired, setHiddenForDays } from "@/lib/cookies";

const COOKIE_NAME = "sfs_calc_tour_hidden_until";
const HIDE_DAYS = 7;
const AUTO_START_DELAY_MS = 900;

interface TourStep {
  target: string;
  title: string;
  content: string;
  /** If true, step requires data to be loaded (CSV uploaded) */
  requiresData?: boolean;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "upload",
    title: "Upload your stores",
    content: "Download the template, add anchors and satellites with distances, then upload.",
  },
  {
    target: "assumptions",
    title: "Set assumptions",
    content: "Pick market and vehicle type to calculate base costs.",
  },
  {
    target: "anchors",
    title: "Select an anchor",
    content: "Click any anchor store to see its savings breakdown.",
    requiresData: true,
  },
  {
    target: "summary",
    title: "Savings summary",
    content: "See total cost before vs after density savings.",
    requiresData: true,
  },
  {
    target: "export",
    title: "Export results",
    content: "Copy summary or download CSV with all details.",
    requiresData: true,
  },
];

interface SfsCalculatorTourProps {
  /** Force tour to start (bypasses cookie check) */
  forceStart?: boolean;
  /** Callback when tour ends */
  onEnd?: () => void;
}

export function SfsCalculatorTour({ forceStart, onEnd }: SfsCalculatorTourProps) {
  const [isActive, setIsActive] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null);
  const [targetMissing, setTargetMissing] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(false);
  const prevForceStart = React.useRef(forceStart);

  // Mount and auto-start check
  React.useEffect(() => {
    setMounted(true);
    // Auto-start only if cookie is missing or expired
    if (isHiddenUntilExpired(COOKIE_NAME)) {
      const timer = setTimeout(() => {
        setStepIndex(0);
        setIsActive(true);
      }, AUTO_START_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, []);

  // Handle forceStart prop changes (manual trigger from Help dialog)
  React.useEffect(() => {
    if (forceStart && !prevForceStart.current) {
      setStepIndex(0);
      setIsActive(true);
    }
    prevForceStart.current = forceStart;
  }, [forceStart]);

  // Animate in when active
  React.useEffect(() => {
    if (isActive) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isActive]);

  // Find and position on current step target
  React.useEffect(() => {
    if (!isActive) return;

    const step = TOUR_STEPS[stepIndex];
    if (!step) return;

    const findTarget = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        setTargetMissing(false);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setTargetRect(null);
        setTargetMissing(true);
      }
    };

    findTarget();
    const timer = setTimeout(findTarget, 200);
    return () => clearTimeout(timer);
  }, [isActive, stepIndex]);

  const handleClose = React.useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      setIsActive(false);
      setHiddenForDays(COOKIE_NAME, HIDE_DAYS);
      onEnd?.();
    }, 150);
  }, [onEnd]);

  const handleNext = React.useCallback(() => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      handleClose();
    }
  }, [stepIndex, handleClose]);

  const handlePrev = React.useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    }
  }, [stepIndex]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowRight" && !targetMissing) handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isActive, handleClose, handleNext, handlePrev, targetMissing]);

  if (!mounted || !isActive) return null;

  const step = TOUR_STEPS[stepIndex];
  if (!step) return null;

  return createPortal(
    <TourOverlay
      step={step}
      stepIndex={stepIndex}
      totalSteps={TOUR_STEPS.length}
      targetRect={targetRect}
      targetMissing={targetMissing}
      isVisible={isVisible}
      onClose={handleClose}
      onNext={handleNext}
      onPrev={handlePrev}
      onBackdropClick={handleClose}
    />,
    document.body
  );
}

/* -------------------------------------------------------------------------- */
/*                              TourOverlay                                   */
/* -------------------------------------------------------------------------- */

type Placement = "top" | "bottom" | "left" | "right";

interface TourOverlayProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  targetMissing: boolean;
  isVisible: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onBackdropClick: () => void;
}

function TourOverlay({
  step,
  stepIndex,
  totalSteps,
  targetRect,
  targetMissing,
  isVisible,
  onClose,
  onNext,
  onPrev,
  onBackdropClick,
}: TourOverlayProps) {
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  // Calculate tooltip position with smart placement
  const { tooltipStyle, arrowStyle } = React.useMemo(() => {
    const TOOLTIP_WIDTH = 340;
    const TOOLTIP_HEIGHT = 160;
    const PADDING = 16;
    const ARROW_SIZE = 8;
    const GAP = 12;

    // Centered fallback if no target
    if (!targetRect) {
      return {
        tooltipStyle: {
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        } as React.CSSProperties,
        placement: "bottom" as Placement,
        arrowStyle: { display: "none" } as React.CSSProperties,
      };
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    // Check available space on each side
    const spaceRight = vw - targetRect.right - PADDING;
    const spaceLeft = targetRect.left - PADDING;
    const spaceBelow = vh - targetRect.bottom - PADDING;

    let pos: Placement = "right";
    let top = 0;
    let left = 0;

    // Prefer right, then left, then below, then above
    if (spaceRight >= TOOLTIP_WIDTH + GAP) {
      pos = "right";
      left = targetRect.right + GAP;
      top = targetCenterY - TOOLTIP_HEIGHT / 2;
    } else if (spaceLeft >= TOOLTIP_WIDTH + GAP) {
      pos = "left";
      left = targetRect.left - TOOLTIP_WIDTH - GAP;
      top = targetCenterY - TOOLTIP_HEIGHT / 2;
    } else if (spaceBelow >= TOOLTIP_HEIGHT + GAP) {
      pos = "bottom";
      top = targetRect.bottom + GAP;
      left = targetCenterX - TOOLTIP_WIDTH / 2;
    } else {
      pos = "top";
      top = targetRect.top - TOOLTIP_HEIGHT - GAP;
      left = targetCenterX - TOOLTIP_WIDTH / 2;
    }

    // Clamp to viewport
    top = Math.max(PADDING, Math.min(top, vh - TOOLTIP_HEIGHT - PADDING));
    left = Math.max(PADDING, Math.min(left, vw - TOOLTIP_WIDTH - PADDING));

    // Arrow positioning
    const arrow: React.CSSProperties = { position: "absolute" };
    if (pos === "right") {
      arrow.left = -ARROW_SIZE;
      arrow.top = Math.min(Math.max(targetCenterY - top - ARROW_SIZE, 16), TOOLTIP_HEIGHT - 32);
      arrow.borderWidth = `${ARROW_SIZE}px ${ARROW_SIZE}px ${ARROW_SIZE}px 0`;
      arrow.borderColor = "transparent var(--card) transparent transparent";
    } else if (pos === "left") {
      arrow.right = -ARROW_SIZE;
      arrow.top = Math.min(Math.max(targetCenterY - top - ARROW_SIZE, 16), TOOLTIP_HEIGHT - 32);
      arrow.borderWidth = `${ARROW_SIZE}px 0 ${ARROW_SIZE}px ${ARROW_SIZE}px`;
      arrow.borderColor = "transparent transparent transparent var(--card)";
    } else if (pos === "bottom") {
      arrow.top = -ARROW_SIZE;
      arrow.left = Math.min(Math.max(targetCenterX - left - ARROW_SIZE, 16), TOOLTIP_WIDTH - 32);
      arrow.borderWidth = `0 ${ARROW_SIZE}px ${ARROW_SIZE}px ${ARROW_SIZE}px`;
      arrow.borderColor = "transparent transparent var(--card) transparent";
    } else {
      arrow.bottom = -ARROW_SIZE;
      arrow.left = Math.min(Math.max(targetCenterX - left - ARROW_SIZE, 16), TOOLTIP_WIDTH - 32);
      arrow.borderWidth = `${ARROW_SIZE}px ${ARROW_SIZE}px 0 ${ARROW_SIZE}px`;
      arrow.borderColor = "var(--card) transparent transparent transparent";
    }

    return {
      tooltipStyle: { top, left, width: TOOLTIP_WIDTH } as React.CSSProperties,
      placement: pos,
      arrowStyle: { ...arrow, borderStyle: "solid" } as React.CSSProperties,
    };
  }, [targetRect]);

  const showMissingMessage = targetMissing && step.requiresData;

  return (
    <div
      className={[
        "fixed inset-0 z-[9999] transition-opacity duration-150",
        isVisible ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      {/* Backdrop with spotlight cutout */}
      <svg className="absolute inset-0 h-full w-full" onClick={onBackdropClick}>
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - 10}
                y={targetRect.top - 10}
                width={targetRect.width + 20}
                height={targetRect.height + 20}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.6)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {/* Spotlight ring with subtle glow */}
      {targetRect && (
        <div
          className="pointer-events-none absolute rounded-xl border-2 border-[var(--warp-success)] shadow-[0_0_0_4px_rgba(34,197,94,0.15)]"
          style={{
            top: targetRect.top - 10,
            left: targetRect.left - 10,
            width: targetRect.width + 20,
            height: targetRect.height + 20,
            transition: "all 200ms ease-out",
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className={[
          "absolute z-10 rounded-2xl border border-border/80 bg-card p-4 shadow-xl transition-all duration-150",
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0",
        ].join(" ")}
        style={tooltipStyle}
      >
        {/* Arrow */}
        {targetRect && <div className="pointer-events-none" style={arrowStyle} />}

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          aria-label="Close tour"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="pr-8">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
              {stepIndex + 1}
            </span>
            <span className="text-sm font-semibold text-foreground">{step.title}</span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            {showMissingMessage
              ? "Upload a CSV to see this section."
              : step.content}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between">
          {/* Step indicator as text */}
          <span className="text-xs text-muted-foreground">
            Step {stepIndex + 1} of {totalSteps}
          </span>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={onPrev} className="h-7 px-2">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={onNext}
              disabled={showMissingMessage}
              className="h-7 px-3"
            >
              {isLast ? "Done" : "Next"}
              {!isLast && <ChevronRight className="ml-1 h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

