"use client";

import * as React from "react";
import { TrendingDown, TrendingUp, Info, Target } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency, formatPercent } from "@/lib/sfs-calculator/format";
import { getGlossary } from "./glossary";

interface Props {
  anchorCpp: number;
  blendedCpp: number;
  savingsAbsolute: number;
  savingsPercent: number;
  market: string;
  vehicleType: string;
}

/**
 * Hero card showing the primary outcome: Blended CPP with comparison to Anchor.
 */
export function OutcomeHeroCard({
  anchorCpp,
  blendedCpp,
  savingsAbsolute,
  savingsPercent,
  market,
  vehicleType,
}: Props) {
  const hasImprovement = savingsAbsolute > 0;
  const isWorse = savingsAbsolute < 0;
  const blendedGloss = getGlossary("blended_cpp");
  const anchorGloss = getGlossary("anchor_cpp");
  const improvementGloss = getGlossary("cpp_improvement");

  // Calculate marker positions on a 0-100 scale
  const maxCpp = Math.max(anchorCpp, blendedCpp) * 1.1; // Add 10% headroom
  const anchorPos = maxCpp > 0 ? (anchorCpp / maxCpp) * 100 : 0;
  const blendedPos = maxCpp > 0 ? (blendedCpp / maxCpp) * 100 : 0;

  // Interpretation text
  const interpretationText = hasImprovement
    ? `Blended CPP is ${formatCurrency(blendedCpp)}, improving ${formatCurrency(savingsAbsolute)} (${formatPercent(savingsPercent)}) vs Anchor.`
    : isWorse
      ? `Blended CPP is ${formatCurrency(blendedCpp)}, ${formatCurrency(Math.abs(savingsAbsolute))} higher than Anchor.`
      : `Blended CPP equals Anchor at ${formatCurrency(blendedCpp)}.`;

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-5">
      {/* Section header */}
      <div className="mb-4 flex items-center gap-2">
        <Target className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Outcome
        </h3>
      </div>

      {/* Context badges */}
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {market}
        </span>
        <span className="rounded border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {vehicleType}
        </span>
      </div>

      {/* Primary metric: Blended CPP */}
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-4xl font-bold tracking-tight tabular-nums text-[var(--warp-accent-strong)]">
          {formatCurrency(blendedCpp)}
        </span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="inline-flex items-center text-muted-foreground/60 transition-colors hover:text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[220px]">
              <p className="font-medium">{blendedGloss.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{blendedGloss.body}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <p className="text-xs text-muted-foreground">Blended Cost Per Package</p>

      {/* Comparison section */}
      <div className="mt-5 space-y-4 border-t border-border/40 pt-4">
        {/* Anchor + Delta row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-xs text-muted-foreground/80 underline decoration-dotted underline-offset-2">
                    Anchor CPP
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[200px]">
                  <p className="font-medium">{anchorGloss.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{anchorGloss.body}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-sm font-semibold tabular-nums text-foreground/80">
              {formatCurrency(anchorCpp)}
            </span>
          </div>

          {/* Delta chip */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`flex cursor-help items-center gap-1 rounded-full border px-2.5 py-0.5 ${
                    hasImprovement
                      ? "border-[var(--warp-success-muted)] bg-[var(--warp-success-soft)]"
                      : isWorse
                        ? "border-[var(--warp-warning-muted)] bg-[var(--warp-warning-soft)]"
                        : "border-border/50 bg-muted/30"
                  }`}
                >
                  {hasImprovement ? (
                    <TrendingDown className="h-3 w-3 text-[var(--warp-success-strong)]" />
                  ) : isWorse ? (
                    <TrendingUp className="h-3 w-3 text-[var(--warp-warning-strong)]" />
                  ) : null}
                  <span
                    className={`text-[11px] font-semibold ${
                      hasImprovement
                        ? "text-[var(--warp-success-strong)]"
                        : isWorse
                          ? "text-[var(--warp-warning-strong)]"
                          : "text-muted-foreground"
                    }`}
                  >
                    {hasImprovement ? "Savings" : isWorse ? "Higher" : "Even"}{" "}
                    {savingsAbsolute !== 0 && formatCurrency(Math.abs(savingsAbsolute))}
                  </span>
                  <span
                    className={`text-[10px] ${
                      hasImprovement
                        ? "text-[var(--warp-success)]/80"
                        : isWorse
                          ? "text-[var(--warp-warning)]/80"
                          : "text-muted-foreground/70"
                    }`}
                  >
                    ({formatPercent(Math.abs(savingsPercent))})
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[200px]">
                <p className="font-medium">{improvementGloss.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{improvementGloss.body}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Two-marker scale */}
        <div className="space-y-2">
          <div className="relative h-2.5 w-full rounded-full bg-border/60">
            {/* Anchor marker */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 cursor-help rounded-full bg-muted-foreground/70"
                    style={{ left: `${Math.min(anchorPos, 100)}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Anchor: {formatCurrency(anchorCpp)}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Blended marker */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`absolute top-1/2 h-4 w-1.5 -translate-y-1/2 cursor-help rounded-full ${
                      hasImprovement
                        ? "bg-[var(--warp-success-strong)]"
                        : isWorse
                          ? "bg-[var(--warp-warning-strong)]"
                          : "bg-primary"
                    }`}
                    style={{ left: `${Math.min(blendedPos, 100)}%`, marginLeft: "-3px" }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Blended: {formatCurrency(blendedCpp)}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Fill to blended */}
            <div
              className={`absolute inset-y-0 left-0 rounded-full ${
                hasImprovement
                  ? "bg-[var(--warp-success-muted)]"
                  : isWorse
                    ? "bg-[var(--warp-warning-muted)]"
                    : "bg-primary/40"
              }`}
              style={{ width: `${Math.min(blendedPos, 100)}%` }}
            />
          </div>

          {/* Scale labels */}
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>$0</span>
            <span className="text-muted-foreground/70">Lower CPP is better</span>
            <span>{formatCurrency(maxCpp)}</span>
          </div>
        </div>

        {/* Interpretation microcopy */}
        <p className="text-xs leading-relaxed text-muted-foreground">{interpretationText}</p>
      </div>
    </div>
  );
}

