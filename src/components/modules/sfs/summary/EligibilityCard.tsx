"use client";

import * as React from "react";
import { CheckCircle2, XCircle, Shield, Info, Check, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SfsCalculatorInputs, SfsEconomicsResult } from "@/lib/sfs-calculator/types";
import { getGlossary } from "./glossary";

interface Props {
  inputs: SfsCalculatorInputs;
  result: SfsEconomicsResult;
}

interface ConstraintCheck {
  key: string;
  label: string;
  value: number;
  threshold: number;
  unit: string;
  passes: boolean;
}

/** Build constraint checks from inputs/result */
function getConstraintChecks(inputs: SfsCalculatorInputs, result: SfsEconomicsResult): ConstraintCheck[] {
  const driverTime = Math.round(
    (inputs.anchor_stops + inputs.satellite_stores * 2) * inputs.avg_routing_time_per_stop
  );

  return [
    {
      key: "pickup_window",
      label: "Pickup Window",
      value: inputs.pickup_window_minutes,
      threshold: 120,
      unit: "min",
      passes: inputs.pickup_window_minutes <= 120,
    },
    {
      key: "satellite_packages",
      label: "Satellite Packages",
      value: inputs.satellite_packages,
      threshold: inputs.max_satellite_packages_allowed,
      unit: "pkgs",
      passes: inputs.satellite_packages <= inputs.max_satellite_packages_allowed,
    },
    {
      key: "satellite_miles",
      label: "Satellite Miles",
      value: result.avg_satellite_distance,
      threshold: inputs.max_satellite_miles_allowed,
      unit: "mi",
      passes: result.avg_satellite_distance <= inputs.max_satellite_miles_allowed,
    },
    {
      key: "driver_time",
      label: "Driver Time",
      value: driverTime,
      threshold: inputs.max_driver_time_minutes,
      unit: "min",
      passes: driverTime <= inputs.max_driver_time_minutes,
    },
  ];
}

/** Get failure reasons */
function getFailedConstraints(checks: ConstraintCheck[]): string[] {
  return checks
    .filter((c) => !c.passes)
    .map((c) => `${c.label} exceeds ${c.threshold} ${c.unit}`);
}

/**
 * Card showing density eligibility status with explicit constraint checks.
 */
export function EligibilityCard({ inputs, result }: Props) {
  const isEligible = result.density_eligible;
  const checks = getConstraintChecks(inputs, result);
  const failures = getFailedConstraints(checks);
  const eligibilityGloss = getGlossary("density_eligibility");

  const interpretationText = isEligible
    ? "Meets density thresholds for this route configuration."
    : "Adjust inputs to meet density thresholds.";

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-5">
      {/* Section header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Eligibility
          </h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-muted-foreground/60 transition-colors hover:text-muted-foreground">
                  <Info className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[200px]">
                <p className="font-medium">{eligibilityGloss.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{eligibilityGloss.body}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Status badge */}
        <div
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
            isEligible
              ? "border-[var(--warp-success-muted)] bg-[var(--warp-success-soft)]"
              : "border-[var(--warp-warning-muted)] bg-[var(--warp-warning-soft)]"
          }`}
        >
          {isEligible ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--warp-success-strong)]" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-[var(--warp-warning-strong)]" />
          )}
          <span
            className={`text-xs font-semibold ${isEligible ? "text-[var(--warp-success-strong)]" : "text-[var(--warp-warning-strong)]"}`}
          >
            {isEligible ? "Eligible" : "Not Eligible"}
          </span>
        </div>
      </div>

      {/* Failure reasons */}
      {failures.length > 0 && (
        <div className="mb-4 rounded-lg border border-[var(--warp-warning-muted)] bg-[var(--warp-warning-soft)] px-3 py-2">
          <ul className="space-y-0.5">
            {failures.map((f) => (
              <li key={f} className="flex items-start gap-1.5 text-[11px] text-[var(--warp-warning-strong)]">
                <span className="mt-0.5">•</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Constraint checks */}
      <div className="space-y-3">
        {checks.map((check) => (
          <ConstraintRow key={check.key} check={check} />
        ))}
      </div>

      {/* Interpretation */}
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{interpretationText}</p>
    </div>
  );
}

/** Individual constraint row with explicit value/threshold and pass/fail */
function ConstraintRow({ check }: { check: ConstraintCheck }) {
  const percent = check.threshold > 0 ? Math.min((check.value / check.threshold) * 100, 100) : 0;
  const gloss = getGlossary(check.key);

  return (
    <div className="space-y-1.5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2">
                {check.label}
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[200px]">
              <p className="font-medium">{gloss.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{gloss.body}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex items-center gap-2">
          {/* Value / Threshold */}
          <span className="text-[11px] tabular-nums text-muted-foreground">
            <span className={check.passes ? "text-foreground" : "text-[var(--warp-warning-strong)]"}>
              {check.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </span>
            <span className="text-muted-foreground/60"> / {check.threshold.toLocaleString()}</span>
            <span className="ml-0.5 text-muted-foreground/60">{check.unit}</span>
          </span>

          {/* Pass/Fail label */}
          <span
            className={`flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
              check.passes
                ? "border-[var(--warp-success-muted)] bg-[var(--warp-success-soft)] text-[var(--warp-success-strong)]"
                : "border-[var(--warp-warning-muted)] bg-[var(--warp-warning-soft)] text-[var(--warp-warning-strong)]"
            }`}
          >
            {check.passes ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
            {check.passes ? "Pass" : "Fail"}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-border/60">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
            check.passes ? "bg-[var(--warp-success-muted)]" : "bg-[var(--warp-warning-muted)]"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

