"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDownToLine,
  Copy,
  Download,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";

import { computeSfsEconomics } from "@/lib/sfs-calculator/compute";
import type {
  SfsCalculatorInputs,
  SfsDensityTier,
  SfsRateCard,
  SfsStoreUploadError,
  SfsStoreUploadRow,
  SfsStop,
  VehicleType,
} from "@/lib/sfs-calculator/types";
import { DEFAULT_INPUTS, getDefaultMarket } from "@/lib/sfs-calculator/types";
import type { SfsRateCardsErrorReason } from "@/lib/sfs-calculator/get-rate-cards";
import { validateSfsInputs } from "@/lib/sfs-calculator/validate";
import {
  generateSalesSummaryText,
  makeSatelliteResultsCsv,
} from "@/lib/sfs-calculator/format";
import {
  getStoresTemplateCsv,
  parseStoresUploadText,
  type MissingDistanceError,
} from "@/lib/sfs-calculator/parse-stores";
import {
  generateErrorReportCsv,
  generateMissingDistanceCsv,
  getAffectedAnchorIdsText,
} from "@/lib/sfs-calculator/error-report";
import {
  computeSatelliteImpacts,
  type SfsSatelliteImpactSummary,
} from "@/lib/sfs-calculator/impact";
import {
  AnchorListPanel,
  AnchorSummaryPanel,
  type AnchorListItem,
  type SortOption,
} from "@/components/modules/sfs/results";

import { SfsCalculatorHelpDialog } from "./SfsCalculatorHelpDialog";
import { SfsCalculatorTour } from "./SfsCalculatorTour";
import { CompactInputsBar } from "./CompactInputsBar";
import { CompactRouteAssumptions } from "./CompactRouteAssumptions";

function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface SfsConfigError {
  reason: SfsRateCardsErrorReason;
  message: string;
}

interface Props {
  rateCards: SfsRateCard[];
  configError?: SfsConfigError | null;
  densityTiers?: SfsDensityTier[];
  /** Admin-only warnings - kept for API compatibility but not displayed in simplified UI */
  adminWarnings?: { densityTiers?: string } | null;
  isAdmin?: boolean;
}

function getInitialInputs(): SfsCalculatorInputs {
  const defaultVehicle: VehicleType = "Cargo Van";
  return {
    ...DEFAULT_INPUTS,
    market: getDefaultMarket(),
    vehicle_type: defaultVehicle,
  };
}

export function SfsCalculatorV2({
  rateCards,
  configError,
  densityTiers: initialDensityTiers = [],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  adminWarnings: _adminWarnings = null,
  isAdmin = false,
}: Props) {
  const [inputs, setInputs] = React.useState<SfsCalculatorInputs>(() => getInitialInputs());
  const [uploadedFileName, setUploadedFileName] = React.useState<string | null>(null);
  const [uploadedRows, setUploadedRows] = React.useState<SfsStoreUploadRow[] | null>(null);
  const [uploadedStops, setUploadedStops] = React.useState<SfsStop[] | null>(null);
  const [uploadErrors, setUploadErrors] = React.useState<SfsStoreUploadError[]>([]);
  const [missingDistanceErrors, setMissingDistanceErrors] = React.useState<MissingDistanceError[]>([]);
  const [hasAnyZipCodes, setHasAnyZipCodes] = React.useState<boolean | undefined>(undefined);
  const [selectedAnchorId, setSelectedAnchorId] = React.useState<string | null>(null);
  const [densityTiers, setDensityTiers] = React.useState<SfsDensityTier[]>(() => initialDensityTiers);
  const [impactSummary, setImpactSummary] = React.useState<SfsSatelliteImpactSummary | null>(null);
  const [impactError, setImpactError] = React.useState<string | null>(null);
  const [impactPending, startImpactTransition] = React.useTransition();
  const [resultsSortBy, setResultsSortBy] = React.useState<SortOption>("savings_dollars");
  const [tourForceStart, setTourForceStart] = React.useState(false);

  const handleStartTour = React.useCallback(() => {
    setTourForceStart(true);
  }, []);

  const handleTourEnd = React.useCallback(() => {
    setTourForceStart(false);
  }, []);

  React.useEffect(() => {
    setDensityTiers((prev) => (prev.length ? prev : initialDensityTiers));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validationErrors = validateSfsInputs(inputs);
  const hasErrors = Object.keys(validationErrors).length > 0;
  const hasMissingDistances = missingDistanceErrors.length > 0;

  const rateCard = React.useMemo(
    () => rateCards.find((r) => r.vehicle_type === inputs.vehicle_type) ?? null,
    [rateCards, inputs.vehicle_type]
  );

  const canCompute =
    !!rateCard &&
    !hasErrors &&
    !!uploadedStops &&
    uploadErrors.length === 0 &&
    !hasMissingDistances &&
    uploadedStops.length > 0;

  const computed = React.useMemo(() => {
    if (!canCompute || !uploadedStops || !rateCard) {
      return { results: [], error: null as Error | null };
    }
    try {
      return {
        results: computeSfsEconomics(inputs, uploadedStops, rateCard, { densityTiers }),
        error: null,
      };
    } catch (err) {
      return { results: [], error: err instanceof Error ? err : new Error("Unknown compute error") };
    }
  }, [canCompute, densityTiers, inputs, rateCard, uploadedStops]);

  const anchorResults = computed.results;
  const computeError = computed.error;

  // Build anchor list items
  const anchorListItems: AnchorListItem[] = React.useMemo(() => {
    return anchorResults.map((r) => {
      const regularCost = r.base_portion_before_density + r.stop_fees_total;
      const regularCpp = r.total_packages > 0 ? regularCost / r.total_packages : 0;
      const withDensityCpp = r.blended_cpp;
      const savingsCpp = Math.max(0, regularCpp - withDensityCpp);
      const savingsPct = regularCpp > 0 ? savingsCpp / regularCpp : 0;
      return { anchor_id: r.anchor_id, regularCpp, withDensityCpp, savingsCpp, savingsPct, totalPackages: r.total_packages };
    });
  }, [anchorResults]);

  const sortedAnchors = React.useMemo(() => {
    return [...anchorListItems].sort((a, b) => b.savingsCpp - a.savingsCpp);
  }, [anchorListItems]);

  React.useEffect(() => {
    if (!sortedAnchors.length) {
      setSelectedAnchorId(null);
      return;
    }
    if (selectedAnchorId && sortedAnchors.some((a) => a.anchor_id === selectedAnchorId)) return;
    setSelectedAnchorId(sortedAnchors[0].anchor_id);
  }, [sortedAnchors, selectedAnchorId]);

  const selectedResult = React.useMemo(() => {
    if (!selectedAnchorId) return null;
    return anchorResults.find((r) => r.anchor_id === selectedAnchorId) ?? null;
  }, [anchorResults, selectedAnchorId]);

  const selectedAnchorStops = React.useMemo(() => {
    if (!uploadedStops || !selectedAnchorId) return null;
    return uploadedStops.filter((s) => s.anchor_id === selectedAnchorId);
  }, [uploadedStops, selectedAnchorId]);

  React.useEffect(() => {
    if (!canCompute || !selectedAnchorId || !selectedAnchorStops || !rateCard) {
      setImpactSummary(null);
      setImpactError(null);
      return;
    }
    startImpactTransition(() => {
      try {
        setImpactError(null);
        const computedImpact = computeSatelliteImpacts({
          inputs,
          anchorId: selectedAnchorId,
          anchorStops: selectedAnchorStops,
          rateCard,
          densityTiers,
        });
        setImpactSummary(computedImpact.summary);
      } catch (e) {
        setImpactSummary(null);
        setImpactError(e instanceof Error ? e.message : "Unable to compute satellite impacts");
      }
    });
  }, [canCompute, densityTiers, inputs, rateCard, selectedAnchorId, selectedAnchorStops]);

  const uploadSummary = React.useMemo(() => {
    if (!uploadedStops) return null;
    const anchorIds = new Set(uploadedStops.map((s) => s.anchor_id));
    const satellites = uploadedStops.filter((s) => s.stop_type === "Satellite").length;
    const totalPackages = uploadedStops.reduce((sum, s) => sum + s.packages, 0);
    return { rows: uploadedStops.length, anchors: anchorIds.size, satellites, totalPackages };
  }, [uploadedStops]);

  const handleReset = () => {
    setInputs(getInitialInputs());
    setUploadedFileName(null);
    setUploadedRows(null);
    setUploadedStops(null);
    setUploadErrors([]);
    setMissingDistanceErrors([]);
    setHasAnyZipCodes(undefined);
    setSelectedAnchorId(null);
    toast.success("Reset complete");
  };

  const handleDownloadTemplate = () => {
    const csv = getStoresTemplateCsv();
    downloadCsv(csv, "sfs-stores-template.csv");
    toast.success("Template downloaded");
  };

  const handleFileSelected = async (file: File | null) => {
    if (!file) return;
    setUploadedFileName(file.name);
    const text = await file.text();
    const parsed = parseStoresUploadText(text);
    if (!parsed.ok) {
      setUploadedRows(null);
      setUploadedStops(null);
      setUploadErrors(parsed.errors);
      setMissingDistanceErrors([]);
      setHasAnyZipCodes(undefined);
      toast.error("Upload failed");
      return;
    }
    setUploadedRows(parsed.rows);
    setUploadedStops(parsed.stops);
    setUploadErrors(parsed.errors);
    setMissingDistanceErrors(parsed.missingDistanceErrors);
    setHasAnyZipCodes(parsed.hasAnyZipCodes);
    if (parsed.missingDistanceErrors.length) {
      toast.error(`${parsed.missingDistanceErrors.length} satellite row(s) missing distance_miles`);
    } else if (parsed.errors.length) {
      toast.error(`Uploaded with ${parsed.errors.length} validation error(s)`);
    } else {
      toast.success("Stores uploaded");
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">SFS Route Economics</h1>
            <p className="text-xs text-muted-foreground">
              Calculate density discounts for Ship-From-Store routes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SfsCalculatorHelpDialog onStartTour={handleStartTour} />
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="h-8 gap-1.5">
              <ArrowDownToLine className="h-3.5 w-3.5" />
              Template
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset} className="h-8">
              Reset
            </Button>
          </div>
        </div>

        {/* Compact inputs bar */}
        <CompactInputsBar
          uploadedFileName={uploadedFileName}
          uploadSummary={uploadSummary}
          hasErrors={uploadErrors.length > 0}
          hasMissingDistances={hasMissingDistances}
          hasAnyZipCodes={hasAnyZipCodes}
          onFileSelected={handleFileSelected}
        />

        {/* Error callouts */}
        {uploadErrors.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-amber-500">
                <AlertCircle className="h-3.5 w-3.5" />
                {uploadErrors.length} validation error{uploadErrors.length > 1 ? "s" : ""}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={async () => {
                    const text = uploadErrors.map((e) => `Row ${e.row}: ${e.message}`).join("\n");
                    await navigator.clipboard.writeText(text);
                    toast.success("Errors copied");
                  }}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Copy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => {
                    const csv = generateErrorReportCsv(uploadErrors, uploadedRows);
                    downloadCsv(csv, "sfs-error-report.csv");
                    toast.success("Error report downloaded");
                  }}
                >
                  <Download className="mr-1 h-3 w-3" />
                  CSV
                </Button>
              </div>
            </div>
            <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
              {uploadErrors.slice(0, 3).map((err, idx) => (
                <li key={`${err.row}-${idx}`}>
                  Row {err.row}: {err.message}
                </li>
              ))}
              {uploadErrors.length > 3 && (
                <li className="text-muted-foreground/70">…and {uploadErrors.length - 3} more</li>
              )}
            </ul>
          </div>
        )}

        {missingDistanceErrors.length > 0 && (
          <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                Missing distance_miles ({missingDistanceErrors.length})
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={async () => {
                    const text = getAffectedAnchorIdsText(missingDistanceErrors);
                    await navigator.clipboard.writeText(text);
                    toast.success("Anchor Store IDs copied");
                  }}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Anchor Stores
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => {
                    const csv = generateMissingDistanceCsv(missingDistanceErrors, uploadedRows);
                    downloadCsv(csv, "sfs-missing-distance.csv");
                    toast.success("Missing distance CSV downloaded");
                  }}
                >
                  <Download className="mr-1 h-3 w-3" />
                  CSV
                </Button>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Add <span className="font-medium text-foreground">distance_miles</span> to each satellite row.
            </p>
          </div>
        )}

        {/* Route assumptions */}
        <CompactRouteAssumptions
          inputs={inputs}
          onInputsChange={setInputs}
          validationErrors={validationErrors}
          rateCard={rateCard}
          isAdmin={isAdmin}
        />

        {/* Config error for admins */}
        {isAdmin && configError && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 text-amber-500" />
              <div>
                <span className="font-medium text-foreground">Using default rates</span>
                <span className="text-muted-foreground"> — {configError.message}</span>
                <Link href="/admin?tab=setup" className="ml-2 underline hover:text-foreground">
                  Configure
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Results section */}
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-foreground">Results</h2>
              <p className="text-[11px] text-muted-foreground">
                Regular CPP vs With density CPP per anchor store
              </p>
            </div>
            {canCompute && impactSummary && selectedResult && (
              <div data-tour="export" className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={async () => {
                    const text = generateSalesSummaryText({
                      inputs,
                      selected: selectedResult,
                      summary: impactSummary,
                    });
                    await navigator.clipboard.writeText(text);
                    toast.success(`Copied summary for ${selectedResult.anchor_id}`);
                  }}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    const csv = makeSatelliteResultsCsv({ inputs, summary: impactSummary });
                    downloadCsv(csv, `sfs-results-${impactSummary.anchor_id}.csv`);
                    toast.success("Downloaded results CSV");
                  }}
                >
                  <Download className="mr-1 h-3 w-3" />
                  CSV
                </Button>
              </div>
            )}
          </div>

          {!canCompute ? (
            <div className="rounded-lg border border-border bg-background/10 p-6 text-center text-sm text-muted-foreground">
              {!uploadedStops
                ? "Upload a stores CSV to see results."
                : uploadErrors.length
                  ? "Fix upload errors to see results."
                  : hasMissingDistances
                    ? "Add distance_miles to all satellite rows."
                    : !rateCard
                      ? isAdmin
                        ? "Configure rates in Admin → Setup."
                        : "Rates need to be configured."
                      : hasErrors
                        ? "Fix input errors to see results."
                        : "No data available."}
            </div>
          ) : computeError ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 text-amber-500" />
                <div>
                  <div className="text-sm font-medium text-foreground">Unable to compute</div>
                  <div className="mt-1 text-xs text-muted-foreground">{computeError.message}</div>
                </div>
              </div>
            </div>
          ) : sortedAnchors.length === 0 ? (
            <div className="rounded-lg border border-border bg-background/10 p-6 text-center text-sm text-muted-foreground">
              No anchor stores found in uploaded data.
            </div>
          ) : (
            <div className="grid items-start gap-4 lg:grid-cols-12">
              {/* Left: Anchor list */}
              <div className="lg:col-span-4 lg:max-h-[600px] lg:overflow-y-auto">
                <AnchorListPanel
                  anchors={anchorListItems}
                  selectedAnchorId={selectedAnchorId}
                  onSelect={setSelectedAnchorId}
                  sortBy={resultsSortBy}
                  onSortChange={setResultsSortBy}
                />
              </div>

              {/* Right: Summary */}
              <div className="lg:col-span-8">
                {!selectedResult ? (
                  <div className="rounded-lg border border-border bg-background/10 p-6 text-center text-sm text-muted-foreground">
                    Select an anchor store to see results.
                  </div>
                ) : impactError ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Error:</span> {impactError}
                  </div>
                ) : !impactSummary ? (
                  <div className="rounded-lg border border-border bg-background/10 p-6 text-center text-sm text-muted-foreground">
                    {impactPending ? "Computing…" : "No results available."}
                  </div>
                ) : (
                  <AnchorSummaryPanel inputs={inputs} result={selectedResult} summary={impactSummary} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Guided tour */}
      <SfsCalculatorTour
        forceStart={tourForceStart}
        hasCsv={!!uploadedStops}
        onEnd={handleTourEnd}
      />
    </TooltipProvider>
  );
}