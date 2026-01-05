"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  isHiddenUntilExpired,
  setHiddenForDays,
  getResumeStep,
  setResumeStep,
  clearResumeStep,
} from "@/lib/cookies";

/* -------------------------------------------------------------------------- */
/*                              Constants                                     */
/* -------------------------------------------------------------------------- */

const COOKIE_HIDDEN = "sfs_calc_tour_hidden_until";
const COOKIE_RESUME = "sfs_calc_tour_resume_step";
const HIDE_DAYS = 7;
const AUTO_START_DELAY_MS = 800;
const RESUME_DELAY_MS = 750;

// Set to true to allow Esc to dismiss (off by default per stakeholder request)
const ALLOW_ESC_DISMISS = false;

/* -------------------------------------------------------------------------- */
/*                              Tour Steps                                    */
/* -------------------------------------------------------------------------- */

interface TourStep {
  target: string;
  title: string;
  content: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "upload",
    title: "Upload your stores CSV",
    content:
      "Upload a CSV of anchors + satellites. Each satellite row must include distance_miles. Use Template if you need a sample.",
  },
  {
    target: "assumptions",
    title: "Choose market & vehicle",
    content:
      "Pick market and vehicle type to apply the baseline rates. You can open Advanced assumptions later if needed.",
  },
  {
    target: "anchors",
    title: "Browse anchors",
    content:
      "This list shows cost per package with density savings. Click any anchor to view its breakdown.",
  },
  {
    target: "summary",
    title: "Review savings",
    content:
      "Compare Regular vs With density totals and see your savings. \"Details\" is optional.",
  },
  {
    target: "export",
    title: "Share results",
    content: "Use Copy for a quick summary or download CSV for all anchors.",
  },
];

/* -------------------------------------------------------------------------- */
/*                           Main Component                                   */
/* -------------------------------------------------------------------------- */

interface SfsCalculatorTourProps {
  /** Force tour to start (bypasses cookie check) */
  forceStart?: boolean;
  /** Whether CSV data has been uploaded */
  hasCsv?: boolean;
  /** Callback when tour ends */
  onEnd?: () => void;
}

export function SfsCalculatorTour({
  forceStart,
  hasCsv = false,
  onEnd,
}: SfsCalculatorTourProps) {
  const [isActive, setIsActive] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(false);
  const prevForceStart = React.useRef(forceStart);
  const prevHasCsv = React.useRef(hasCsv);

  // ────────────────────────────────────────────────────────────────────────────
  // Auto-start logic on mount
  // ────────────────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    setMounted(true);

    // If in cooldown, don't auto-start
    if (!isHiddenUntilExpired(COOKIE_HIDDEN)) return;

    // Check for resume step
    const resumeStep = getResumeStep(COOKIE_RESUME);
    if (resumeStep !== null) {
      // If CSV already uploaded, start at resume step
      if (hasCsv) {
        const timer = setTimeout(() => {
          setStepIndex(resumeStep);
          setIsActive(true);
          clearResumeStep(COOKIE_RESUME);
        }, RESUME_DELAY_MS);
        return () => clearTimeout(timer);
      }
      // If no CSV, wait for upload (handled by hasCsv effect)
      return;
    }

    // First-time experience: start at step 0
    const timer = setTimeout(() => {
      setStepIndex(0);
      setIsActive(true);
    }, AUTO_START_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ────────────────────────────────────────────────────────────────────────────
  // Resume tour when CSV becomes available
  // ────────────────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    // Detect transition: hasCsv false → true
    if (hasCsv && !prevHasCsv.current) {
      prevHasCsv.current = hasCsv;

      // Check if we should resume
      if (!isHiddenUntilExpired(COOKIE_HIDDEN)) return;

      const resumeStep = getResumeStep(COOKIE_RESUME);
      if (resumeStep !== null && !isActive) {
        const timer = setTimeout(() => {
          setStepIndex(resumeStep);
          setIsActive(true);
          clearResumeStep(COOKIE_RESUME);
        }, RESUME_DELAY_MS);
        return () => clearTimeout(timer);
      }
    }
    prevHasCsv.current = hasCsv;
  }, [hasCsv, isActive]);

  // ────────────────────────────────────────────────────────────────────────────
  // Handle forceStart prop (from Help dialog)
  // ────────────────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (forceStart && !prevForceStart.current) {
      // Start at step 2 (index 2) if CSV uploaded, else step 0
      const startStep = hasCsv ? 2 : 0;
      setStepIndex(startStep);
      setIsActive(true);
      clearResumeStep(COOKIE_RESUME);
    }
    prevForceStart.current = forceStart;
  }, [forceStart, hasCsv]);

  // ────────────────────────────────────────────────────────────────────────────
  // Visibility animation
  // ────────────────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (isActive) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isActive]);

  // ────────────────────────────────────────────────────────────────────────────
  // Find and position on current step target
  // ────────────────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!isActive) return;

    const step = TOUR_STEPS[stepIndex];
    if (!step) return;

    const findTarget = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setTargetRect(null);
      }
    };

    findTarget();
    const timer = setTimeout(findTarget, 200);
    return () => clearTimeout(timer);
  }, [isActive, stepIndex]);

  // ────────────────────────────────────────────────────────────────────────────
  // Handlers
  // ────────────────────────────────────────────────────────────────────────────
  const handleDismiss = React.useCallback(() => {
    // Full dismiss: set cooldown, clear resume, close
    setIsVisible(false);
    setTimeout(() => {
      setIsActive(false);
      setHiddenForDays(COOKIE_HIDDEN, HIDE_DAYS);
      clearResumeStep(COOKIE_RESUME);
      onEnd?.();
    }, 150);
  }, [onEnd]);

  const handlePauseForUpload = React.useCallback(() => {
    // Pause without cooldown: set resume step, close
    setIsVisible(false);
    setTimeout(() => {
      setIsActive(false);
      setResumeStep(COOKIE_RESUME, 2); // Resume at step 3 (index 2)
      onEnd?.();
    }, 150);
  }, [onEnd]);

  const handleNext = React.useCallback(() => {
    const nextIndex = stepIndex + 1;

    // If on step 2 (index 1) and no CSV, pause for upload
    if (stepIndex === 1 && !hasCsv) {
      handlePauseForUpload();
      return;
    }

    if (nextIndex < TOUR_STEPS.length) {
      setStepIndex(nextIndex);
    } else {
      // Completed tour: set cooldown
      handleDismiss();
    }
  }, [stepIndex, hasCsv, handlePauseForUpload, handleDismiss]);

  const handlePrev = React.useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    }
  }, [stepIndex]);

  // ────────────────────────────────────────────────────────────────────────────
  // Keyboard navigation (optional Esc dismiss)
  // ────────────────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ALLOW_ESC_DISMISS) handleDismiss();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isActive, handleDismiss, handleNext, handlePrev]);

  // ────────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────────
  if (!mounted || !isActive) return null;

  const step = TOUR_STEPS[stepIndex];
  if (!step) return null;

  // Determine if this is the pause point (step 2, no CSV)
  const isPausePoint = stepIndex === 1 && !hasCsv;

  return createPortal(
    <TourOverlay
      step={step}
      stepIndex={stepIndex}
      totalSteps={TOUR_STEPS.length}
      targetRect={targetRect}
      isVisible={isVisible}
      isPausePoint={isPausePoint}
      onClose={handleDismiss}
      onNext={handleNext}
      onPrev={handlePrev}
    />,
    document.body
  );
}

/* -------------------------------------------------------------------------- */
/*                              TourOverlay                                   */
/* -------------------------------------------------------------------------- */

type Placement = "top" | "bottom" | "left" | "right";

const TOOLTIP_WIDTH = 340;
const TOOLTIP_HEIGHT = 180;
const SPOTLIGHT_PADDING = 10;
const BACKDROP_COLOR = "rgba(0, 0, 0, 0.6)";

interface TourOverlayProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  isVisible: boolean;
  isPausePoint: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

/**
 * Overlay component using 4-div layout around spotlight cutout.
 * This allows:
 * - Clicking backdrop does NOT dismiss (just blocks)
 * - Clicking the spotlight target element is possible
 * - Only X button dismisses the tour
 */
function TourOverlay({
  step,
  stepIndex,
  totalSteps,
  targetRect,
  isVisible,
  isPausePoint,
  onClose,
  onNext,
  onPrev,
}: TourOverlayProps) {
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  // Block clicks on backdrop divs (no dismissal)
  const handleBackdropClick = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Intentionally do nothing - no dismiss
  }, []);

  // Calculate tooltip position with smart placement
  const { tooltipStyle, arrowStyle } = React.useMemo(() => {
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
          width: TOOLTIP_WIDTH,
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

  // Determine button label
  let nextLabel = "Next";
  if (isLast) {
    nextLabel = "Done";
  } else if (isPausePoint) {
    nextLabel = "Continue after upload";
  }

  // Calculate spotlight cutout bounds
  const spotlight = targetRect
    ? {
        top: targetRect.top - SPOTLIGHT_PADDING,
        left: targetRect.left - SPOTLIGHT_PADDING,
        right: targetRect.right + SPOTLIGHT_PADDING,
        bottom: targetRect.bottom + SPOTLIGHT_PADDING,
        width: targetRect.width + SPOTLIGHT_PADDING * 2,
        height: targetRect.height + SPOTLIGHT_PADDING * 2,
      }
    : null;

  return (
    <div
      className={[
        "fixed inset-0 z-[9999] transition-opacity duration-150",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none",
      ].join(" ")}
    >
      {/* 4-div backdrop layout around spotlight cutout */}
      {spotlight ? (
        <>
          {/* Top backdrop */}
          <div
            className="fixed left-0 right-0 top-0"
            style={{ height: spotlight.top, background: BACKDROP_COLOR }}
            onClick={handleBackdropClick}
          />
          {/* Left backdrop */}
          <div
            className="fixed left-0"
            style={{
              top: spotlight.top,
              width: spotlight.left,
              height: spotlight.height,
              background: BACKDROP_COLOR,
            }}
            onClick={handleBackdropClick}
          />
          {/* Right backdrop */}
          <div
            className="fixed right-0"
            style={{
              top: spotlight.top,
              left: spotlight.right,
              height: spotlight.height,
              background: BACKDROP_COLOR,
            }}
            onClick={handleBackdropClick}
          />
          {/* Bottom backdrop */}
          <div
            className="fixed bottom-0 left-0 right-0"
            style={{ top: spotlight.bottom, background: BACKDROP_COLOR }}
            onClick={handleBackdropClick}
          />
        </>
      ) : (
        /* Full backdrop when no target */
        <div
          className="fixed inset-0"
          style={{ background: BACKDROP_COLOR }}
          onClick={handleBackdropClick}
        />
      )}

      {/* Spotlight ring with subtle glow */}
      {spotlight && (
        <div
          className="pointer-events-none absolute rounded-xl border-2 border-[var(--warp-success)] shadow-[0_0_0_4px_rgba(34,197,94,0.15)]"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
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
        onClick={(e) => e.stopPropagation()}
      >
        {/* Arrow */}
        {targetRect && <div className="pointer-events-none" style={arrowStyle} />}

        {/* Close button (X) - ONLY way to dismiss */}
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
            {step.content}
          </p>
          {/* Helper line for pause point */}
          {isPausePoint && (
            <p className="mt-2 text-[11px] italic text-muted-foreground/70">
              Upload a CSV whenever you&apos;re ready — we&apos;ll resume tips from Step 3.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between">
          {/* Step indicator as text */}
          <span className="text-xs text-muted-foreground">
            Step {stepIndex + 1} of {totalSteps}
          </span>

          {/* Navigation - Next is ALWAYS clickable */}
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
              className="h-7 px-3"
            >
              {nextLabel}
              {!isLast && !isPausePoint && <ChevronRight className="ml-1 h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
