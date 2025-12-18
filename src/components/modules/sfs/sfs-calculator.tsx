"use client";

import * as React from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDownToLine,
  ChevronDown,
  ChevronRight,
  FileUp,
  HelpCircle,
  Settings,
  Sparkles,
  TrendingDown,
} from "lucide-react";

import { ContentPanel } from "@/components/panels/ContentPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { computeSfsEconomics } from "@/lib/sfs-calculator/compute";
import { validateSfsInputs } from "@/lib/sfs-calculator/validate";
import type {
  SfsCalculatorInputs,
  SfsRateCard,
  SfsStoreUploadError,
  SfsStoreUploadRow,
  SfsStop,
  VehicleType,
} from "@/lib/sfs-calculator/types";
import { DEFAULT_INPUTS, SFS_MARKETS } from "@/lib/sfs-calculator/types";
import type { SfsRateCardsErrorReason } from "@/lib/sfs-calculator/get-rate-cards";
import {
  generateDensityOutputText,
  generateAllAnchorsOutputText,
  formatCurrency,
  formatPercent,
} from "@/lib/sfs-calculator/format";
import { getStoresTemplateCsv, parseStoresUploadText } from "@/lib/sfs-calculator/parse-stores";
import {
  computeRegularVsDensity,
  computePerSatelliteBenefitDeltas,
  type RegularVsDensityResult,
  type SatelliteBenefitDelta,
} from "@/lib/sfs-calculator/derive-density-benefits";

export interface SfsConfigError {
  reason: SfsRateCardsErrorReason;
  message: string;
}

interface Props {
  rateCards: SfsRateCard[];
  /** Configuration error when table is missing or inaccessible */
  configError?: SfsConfigError | null;
  /** Whether current user is admin (for showing setup link and rates) */
  isAdmin?: boolean;
}

const OTHER_MARKET_VALUE = "__other__";

function getInitialInputs(): SfsCalculatorInputs {
  const defaultMarket = SFS_MARKETS[0] ?? "";
  const defaultVehicle: VehicleType = "Cargo Van";
  return {
    ...DEFAULT_INPUTS,
    market: defaultMarket,
    vehicle_type: defaultVehicle,
  };
}

export function SfsCalculator({ rateCards, configError, isAdmin = false }: Props) {
  const [inputs, setInputs] = React.useState<SfsCalculatorInputs>(() => getInitialInputs());
  const [uploadedFileName, setUploadedFileName] = React.useState<string | null>(null);
  const [uploadedRows, setUploadedRows] = React.useState<SfsStoreUploadRow[] | null>(null);
  const [uploadedStops, setUploadedStops] = React.useState<SfsStop[] | null>(null);
  const [uploadErrors, setUploadErrors] = React.useState<SfsStoreUploadError[]>([]);
  const [selectedAnchorId, setSelectedAnchorId] = React.useState<string | null>(null);
  const [assumptionsExpanded, setAssumptionsExpanded] = React.useState(false);
  const [ratesExpanded, setRatesExpanded] = React.useState(false);
  const [detailsExpanded, setDetailsExpanded] = React.useState(false);

  const validationErrors = validateSfsInputs(inputs);
  const hasErrors = Object.keys(validationErrors).length > 0;

  const marketSelectValue = React.useMemo(() => {
    return SFS_MARKETS.includes(inputs.market as (typeof SFS_MARKETS)[number])
      ? inputs.market
      : OTHER_MARKET_VALUE;
  }, [inputs.market]);

  const rateCard = React.useMemo(
    () => rateCards.find((r) => r.vehicle_type === inputs.vehicle_type) ?? null,
    [rateCards, inputs.vehicle_type],
  );

  const canCompute =
    !configError &&
    !!rateCard &&
    !hasErrors &&
    !!uploadedStops &&
    uploadErrors.length === 0 &&
    uploadedStops.length > 0;

  const anchorResults = React.useMemo(() => {
    if (!canCompute || !uploadedStops || !rateCard) return [];
    return computeSfsEconomics(inputs, uploadedStops, rateCard);
  }, [canCompute, inputs, uploadedStops, rateCard]);

  // Compute density results for all anchors (memoized)
  const densityResults = React.useMemo<Map<string, RegularVsDensityResult>>(() => {
    const map = new Map<string, RegularVsDensityResult>();
    if (!canCompute || !uploadedStops || !rateCard) return map;
    for (const r of anchorResults) {
      const dr = computeRegularVsDensity(inputs, uploadedStops, rateCard, r.anchor_id);
      if (dr) map.set(r.anchor_id, dr);
    }
    return map;
  }, [canCompute, inputs, uploadedStops, rateCard, anchorResults]);

  // Sort anchors by best "with density" CPP (lowest first)
  const sortedAnchors = React.useMemo(() => {
    return [...anchorResults].sort((a, b) => {
      const aDr = densityResults.get(a.anchor_id);
      const bDr = densityResults.get(b.anchor_id);
      const aCpp = aDr?.withDensityCpp ?? Infinity;
      const bCpp = bDr?.withDensityCpp ?? Infinity;
      if (aCpp !== bCpp) return aCpp - bCpp;
      return a.anchor_id.localeCompare(b.anchor_id);
    });
  }, [anchorResults, densityResults]);

  // Auto-select best anchor
  React.useEffect(() => {
    if (!sortedAnchors.length) {
      setSelectedAnchorId(null);
      return;
    }
    if (selectedAnchorId && sortedAnchors.some((a) => a.anchor_id === selectedAnchorId)) return;
    setSelectedAnchorId(sortedAnchors[0].anchor_id);
  }, [sortedAnchors, selectedAnchorId]);

  const selectedDensityResult = React.useMemo(() => {
    if (!selectedAnchorId) return null;
    return densityResults.get(selectedAnchorId) ?? null;
  }, [densityResults, selectedAnchorId]);

  // Compute per-satellite deltas for selected anchor (lazy/memoized)
  const satelliteDeltas = React.useMemo<SatelliteBenefitDelta[]>(() => {
    if (!selectedAnchorId || !canCompute || !uploadedStops || !rateCard) return [];
    return computePerSatelliteBenefitDeltas(inputs, uploadedStops, rateCard, selectedAnchorId);
  }, [selectedAnchorId, canCompute, inputs, uploadedStops, rateCard]);

  const uploadSummary = React.useMemo(() => {
    if (!uploadedStops) return null;
    const anchorIds = new Set(uploadedStops.map((s) => s.anchor_id));
    const satellites = uploadedStops.filter((s) => s.stop_type === "Satellite").length;
    const totalPackages = uploadedStops.reduce((sum, s) => sum + s.packages, 0);
    return {
      rows: uploadedStops.length,
      anchors: anchorIds.size,
      satellites,
      totalPackages,
    };
  }, [uploadedStops]);

  const handleReset = () => {
    setInputs(getInitialInputs());
    setUploadedFileName(null);
    setUploadedRows(null);
    setUploadedStops(null);
    setUploadErrors([]);
    setSelectedAnchorId(null);
    toast.success("Reset complete");
  };

  const handleDownloadTemplate = () => {
    const csv = getStoresTemplateCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sfs-stores-template.csv";
    a.click();
    URL.revokeObjectURL(url);
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
      toast.error("Upload failed");
      return;
    }

    setUploadedRows(parsed.rows);
    setUploadedStops(parsed.stops);
    setUploadErrors(parsed.errors);

    if (parsed.errors.length) {
      toast.error(`Uploaded with ${parsed.errors.length} validation error(s)`);
    } else {
      toast.success("Stores uploaded");
    }
  };

  // Configuration error state (table missing, RLS, etc.)
  if (configError) {
    const title =
      configError.reason === "MISSING_TABLE"
        ? "SFS calculator isn't configured yet"
        : "Unable to load rate cards";
    const body =
      configError.reason === "MISSING_TABLE"
        ? "Rate cards table is missing or not configured. Run the migration to set up the database."
        : configError.message;

    return (
      <ContentPanel
        title={title}
        right={
          isAdmin ? (
            <Link
              href="/admin?tab=setup"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background"
            >
              <Settings className="h-3 w-3" />
              Go to Admin → Setup
            </Link>
          ) : (
            <Badge variant="outline" className="text-[11px] text-muted-foreground">
              Admin required
            </Badge>
          )
        }
      >
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 text-amber-500" />
          <p>{body}</p>
        </div>
      </ContentPanel>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Step 1: Upload */}
        <ContentPanel
          title="1) Upload stores"
          description="Upload anchor and satellite store data."
          right={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="h-8"
              >
                <ArrowDownToLine className="mr-1.5 h-3.5 w-3.5" />
                Template
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleReset} className="h-8">
                Reset
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-border bg-background/20 p-2">
                <FileUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">
                  {uploadedFileName ?? "No file uploaded"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {uploadSummary ? "CSV loaded" : "CSV or TSV file"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".csv,.tsv,text/csv,text/tab-separated-values"
                onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
                className="h-9 w-full max-w-[280px] cursor-pointer"
              />
            </div>
          </div>

          {/* Upload Summary Stats */}
          {uploadSummary && !uploadErrors.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {[
                { label: "Anchors", value: uploadSummary.anchors },
                { label: "Satellites", value: uploadSummary.satellites },
                { label: "Total stops", value: uploadSummary.rows },
                { label: "Total packages", value: uploadSummary.totalPackages.toLocaleString() },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-border bg-background/10 px-3 py-2 text-center"
                >
                  <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                  <div className="mt-0.5 font-mono text-sm font-medium text-foreground">{stat.value}</div>
                </div>
              ))}
            </div>
          ) : null}

          {uploadErrors.length ? (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-500">
                <AlertCircle className="h-4 w-4" />
                Please fix the following issues
              </div>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {uploadErrors.slice(0, 5).map((err, idx) => (
                  <li key={`${err.row}-${idx}`} className="flex gap-2">
                    <span className="w-12 shrink-0 font-mono text-foreground/70">Row {err.row}</span>
                    <span>{err.message}</span>
                  </li>
                ))}
                {uploadErrors.length > 5 ? (
                  <li className="text-xs text-muted-foreground">
                    …and {uploadErrors.length - 5} more issues.
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          {uploadedRows?.length ? (
            <details className="mt-4 group">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                View uploaded rows ({uploadedRows.length})
              </summary>
              <div className="mt-2 overflow-x-auto rounded-xl border border-border bg-background/10">
                <table className="w-full text-xs">
                  <thead className="border-b border-border/60">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-3 py-2">anchor_id</th>
                      <th className="px-3 py-2">stop_type</th>
                      <th className="px-3 py-2">store_name</th>
                      <th className="px-3 py-2 text-right">packages</th>
                      <th className="px-3 py-2">window</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {uploadedRows.slice(0, 15).map((row, idx) => (
                      <tr key={`${row.anchor_id}-${idx}`} className="text-foreground/90">
                        <td className="px-3 py-2 font-mono">{row.anchor_id}</td>
                        <td className="px-3 py-2">{row.stop_type}</td>
                        <td className="px-3 py-2">{row.store_name || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{row.packages}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">
                          {row.pickup_window_start_time}–{row.pickup_window_end_time}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {uploadedRows.length > 15 ? (
                  <div className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
                    Showing first 15 of {uploadedRows.length} rows.
                  </div>
                ) : null}
              </div>
            </details>
          ) : (
            <div className="mt-4 rounded-xl border border-border bg-background/10 p-6 text-center text-sm text-muted-foreground">
              Upload a stores file to begin.
            </div>
          )}
        </ContentPanel>

        {/* Step 2: Route Settings */}
        <ContentPanel
          title="2) Route settings"
          description="Choose your market and vehicle."
          right={
            rateCard ? (
              <Badge variant="outline" className="text-[11px]">
                Ready
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[11px] text-muted-foreground">
                {isAdmin ? "Configure rates" : "Contact admin"}
              </Badge>
            )
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[11px] text-muted-foreground">Market</Label>
              <Select
                value={marketSelectValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === OTHER_MARKET_VALUE) {
                    setInputs((prev) => ({ ...prev, market: "" }));
                  } else {
                    setInputs((prev) => ({ ...prev, market: v }));
                  }
                }}
                options={[
                  ...SFS_MARKETS.map((m) => ({ value: m, label: m })),
                  { value: OTHER_MARKET_VALUE, label: "Other…" },
                ]}
                placeholder="Select market"
                invalid={!!validationErrors.market}
              />
              {marketSelectValue === OTHER_MARKET_VALUE ? (
                <Input
                  value={inputs.market}
                  onChange={(e) => setInputs((prev) => ({ ...prev, market: e.target.value }))}
                  placeholder="Enter market"
                  className="h-9"
                />
              ) : null}
              {validationErrors.market ? (
                <p className="text-[10px] text-[var(--warp-danger)]">{validationErrors.market}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] text-muted-foreground">Vehicle type</Label>
              <Select
                value={inputs.vehicle_type}
                onChange={(e) =>
                  setInputs((prev) => ({ ...prev, vehicle_type: e.target.value as VehicleType }))
                }
                options={[
                  { value: "Cargo Van", label: "Cargo Van" },
                  { value: "26' Box Truck", label: "26' Box Truck" },
                ]}
              />
            </div>
          </div>

          {/* Collapsible Assumptions (advanced) */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setAssumptionsExpanded(!assumptionsExpanded)}
              className="flex w-full items-center gap-2 rounded-lg border border-border bg-background/10 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-background/20"
              aria-expanded={assumptionsExpanded}
            >
              {assumptionsExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Assumptions (advanced)
            </button>
            {assumptionsExpanded ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
	                {[
	                  { key: "miles_to_hub_or_spoke", label: "Miles to hub/spoke" },
	                  { key: "avg_routing_time_per_stop_minutes", label: "Time between stops" },
	                  { key: "default_service_time_minutes", label: "Time per stop" },
	                  { key: "max_driver_time_minutes", label: "Max driver time (min)", locked: true, lockedValue: 480 },
	                  { key: "avg_speed_mph", label: "Avg speed (mph)" },
	                  { key: "default_avg_cubic_inches_per_package", label: "Default avg cube / package (cu in)" },
	                ].map((field) => {
                  const key = field.key as keyof SfsCalculatorInputs;
                  const err = validationErrors[key as string];
                  const value = inputs[key];
                  const isLocked = "locked" in field && field.locked;
                  const displayValue = isLocked && "lockedValue" in field ? field.lockedValue : (typeof value === "number" ? value : 0);
                  return (
                    <div key={field.key} className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{field.label}</Label>
                      <Input
                        type="number"
                        step="any"
                        value={displayValue}
                        disabled={isLocked}
                        onChange={(e) => {
                          if (isLocked) return;
                          setInputs((prev) => ({
                            ...prev,
                            [key]: Number(e.target.value),
                          }));
                        }}
                        className={[
                          err ? "border-[var(--warp-field-error)]" : "",
                          isLocked ? "cursor-not-allowed opacity-60" : "",
                        ].filter(Boolean).join(" ")}
                      />
                      {err ? <p className="text-[10px] text-[var(--warp-danger)]">{err}</p> : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Admin-only Rates Applied - completely hidden for non-admins */}
          {isAdmin ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setRatesExpanded(!ratesExpanded)}
                className="flex w-full items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-amber-500/10"
                aria-expanded={ratesExpanded}
              >
                {ratesExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                <span className="flex items-center gap-1.5">
                  <Settings className="h-3 w-3" />
                  Admin: Rate configuration
                </span>
              </button>
              {ratesExpanded ? (
                <div className="mt-3 rounded-xl border border-border bg-background/10 p-3">
                  {rateCard ? (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>Base fee</span>
                        <span className="font-mono text-foreground">{formatCurrency(rateCard.base_fee)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Per mile</span>
                        <span className="font-mono text-foreground">{formatCurrency(rateCard.per_mile_rate)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Per stop (satellite)</span>
                        <span className="font-mono text-foreground">{formatCurrency(rateCard.per_stop_rate)}</span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-border/60">
                        <Link href="/admin?tab=setup" className="text-xs underline hover:text-foreground">
                          Edit in Admin → Setup
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Rates not configured for this vehicle type.
                      <div className="mt-2">
                        <Link href="/admin?tab=setup" className="text-xs underline hover:text-foreground">
                          Configure in Admin → Setup
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </ContentPanel>

        {/* Step 3: Results */}
        <ContentPanel
          title="3) Results"
          description="Compare costs with and without density benefits."
          right={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={!selectedDensityResult || !canCompute}
                onClick={async () => {
                  if (!selectedDensityResult) return;
                  const text = generateDensityOutputText({
                    inputs,
                    densityResult: selectedDensityResult,
                    satelliteDeltas,
                  });
                  await navigator.clipboard.writeText(text);
                  toast.success(`Copied output for ${selectedDensityResult.anchorId}`);
                }}
              >
                Copy selected
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={!canCompute || densityResults.size === 0}
                onClick={async () => {
                  const allResults = Array.from(densityResults.values());
                  const text = generateAllAnchorsOutputText(inputs, allResults);
                  await navigator.clipboard.writeText(text);
                  toast.success("Copied output for all anchors");
                }}
              >
                Copy all
              </Button>
            </div>
          }
        >
          {!canCompute ? (
            <div className="rounded-xl border border-border bg-background/10 p-6 text-center text-sm text-muted-foreground">
              {!uploadedStops
                ? "Upload a stores file to see results."
                : uploadErrors.length
                  ? "Fix upload errors above to see results."
                  : !rateCard
                    ? isAdmin
                      ? "Configure rates in Admin → Setup to compute results."
                      : "Rates need to be configured. Contact an admin."
                    : hasErrors
                      ? "Fix input errors above to see results."
                      : "No data available."}
            </div>
          ) : anchorResults.length === 0 ? (
            <div className="rounded-xl border border-border bg-background/10 p-6 text-center text-sm text-muted-foreground">
              No anchors found in uploaded data.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-12">
              {/* Anchor list - simplified */}
              <div className="lg:col-span-4">
                <div className="mb-2 text-xs text-muted-foreground">
                  Sorted by best cost with density benefits
                </div>
                <div className="space-y-2">
                  {sortedAnchors.map((row) => {
                    const isActive = row.anchor_id === selectedAnchorId;
                    const dr = densityResults.get(row.anchor_id);
                    const withDensityCpp = dr?.withDensityCpp ?? row.blended_cpp;
                    const hasBenefit = dr?.hasDensityBenefit ?? false;
                    return (
                      <button
                        key={row.anchor_id}
                        type="button"
                        onClick={() => setSelectedAnchorId(row.anchor_id)}
                        className={[
                          "w-full rounded-xl border px-3 py-2.5 text-left transition",
                          isActive
                            ? "border-primary/40 bg-primary/10"
                            : "border-border bg-background/10 hover:bg-background/15",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-mono text-xs text-foreground">{row.anchor_id}</div>
                          {hasBenefit ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warp-success-soft)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--warp-success-strong)]">
                              <Sparkles className="h-2.5 w-2.5" />
                              Density benefit
                            </span>
                          ) : (
                            <span className="text-[9px] text-muted-foreground">Regular cost</span>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-baseline justify-between">
                          <span className="text-[10px] text-muted-foreground">CPP</span>
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {row.total_packages > 0 ? formatCurrency(withDensityCpp) : "N/A"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected anchor details - cost-focused */}
              <div className="lg:col-span-8">
                {selectedDensityResult ? (
                  <div className="space-y-4">
                    {/* Primary Cost Summary */}
                    <div className="rounded-xl border border-border bg-background/10 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Anchor
                          </div>
                          <div className="mt-0.5 font-mono text-base font-semibold text-foreground">
                            {selectedDensityResult.anchorId}
                          </div>
                        </div>
                        {selectedDensityResult.hasDensityBenefit ? (
                          <Badge variant="accent" className="text-[11px]">
                            <Sparkles className="mr-1 h-3 w-3" />
                            Density benefit
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px]">
                            Regular costs
                          </Badge>
                        )}
                      </div>

                      {/* Big number: With density CPP */}
                      <div className="mt-4">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          With density benefits CPP
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="rounded p-0.5 hover:bg-background/20">
                                <HelpCircle className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[240px] text-xs">
                              Cost per package when satellites are added to the route, spreading fixed costs across more packages.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="mt-1 text-3xl font-bold tracking-tight text-foreground">
                          {selectedDensityResult.fullResult.total_packages > 0
                            ? formatCurrency(selectedDensityResult.withDensityCpp)
                            : "N/A"}
                        </div>
                      </div>

                      {/* Comparison row */}
                      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/60 pt-4">
                        <div>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            Regular CPP
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button" className="rounded p-0.5 hover:bg-background/20">
                                  <HelpCircle className="h-2.5 w-2.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[240px] text-xs">
                                Cost per package for anchor-only (baseline without satellites).
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="mt-0.5 font-mono text-sm text-foreground">
                            {selectedDensityResult.regularCpp > 0
                              ? formatCurrency(selectedDensityResult.regularCpp)
                              : "N/A"}
                          </div>
                        </div>
                        <div
                          className={[
                            "rounded-lg px-3 py-1.5",
                            selectedDensityResult.hasDensityBenefit
                              ? "bg-[var(--warp-success-soft)]"
                              : "bg-muted/20",
                          ].join(" ")}
                        >
                          <div className="text-[10px] text-muted-foreground">Savings</div>
                          <div
                            className={[
                              "flex items-center gap-1.5 font-mono text-sm font-semibold",
                              selectedDensityResult.hasDensityBenefit
                                ? "text-[var(--warp-success-strong)]"
                                : "text-muted-foreground",
                            ].join(" ")}
                          >
                            {selectedDensityResult.hasDensityBenefit ? (
                              <>
                                <TrendingDown className="h-3.5 w-3.5" />
                                {formatCurrency(selectedDensityResult.savingsAmount)} ({formatPercent(selectedDensityResult.savingsPercent)})
                              </>
                            ) : (
                              "No density savings"
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Store additions impact */}
                    {satelliteDeltas.length > 0 ? (
                      <div className="rounded-xl border border-border bg-background/10 p-4">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                          Store additions impact
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="rounded p-0.5 hover:bg-background/20">
                                <HelpCircle className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[280px] text-xs">
                              Shows whether each satellite store creates a density benefit (lower CPP) or adds at regular cost.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="mt-3 space-y-2">
                          {satelliteDeltas.map((sat, idx) => (
                            <div
                              key={`${sat.storeName}-${idx}`}
                              className="flex items-center justify-between rounded-lg border border-border bg-background/10 px-3 py-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-xs font-medium text-foreground">
                                  {sat.storeName}
                                </div>
                                <div className="mt-0.5 text-[10px] text-muted-foreground">
                                  {sat.packages} pkgs
                                </div>
                              </div>
                              <div className="ml-3 shrink-0 text-right">
                                {sat.hasBenefit ? (
                                  <>
                                    <div className="flex items-center gap-1 text-xs font-medium text-[var(--warp-success-strong)]">
                                      <Sparkles className="h-3 w-3" />
                                      Density benefit
                                    </div>
                                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                                      CPP change: {formatCurrency(sat.benefitDelta)}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-xs text-muted-foreground">Regular cost</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Summary stats for non-admins */}
                    <div className="flex flex-wrap gap-3 text-xs">
                      <div className="rounded-lg border border-border bg-background/10 px-3 py-2">
                        <span className="text-muted-foreground">Total packages:</span>{" "}
                        <span className="font-mono font-medium text-foreground">
                          {selectedDensityResult.fullResult.total_packages}
                        </span>
                      </div>
                      <div className="rounded-lg border border-border bg-background/10 px-3 py-2">
                        <span className="text-muted-foreground">Total stops:</span>{" "}
                        <span className="font-mono font-medium text-foreground">
                          {selectedDensityResult.fullResult.total_stops}
                        </span>
                      </div>
                    </div>

                    {/* Operational details - admin only */}
                    {isAdmin ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => setDetailsExpanded(!detailsExpanded)}
                          className="flex w-full items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-amber-500/10"
                          aria-expanded={detailsExpanded}
                        >
                          {detailsExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          <span className="flex items-center gap-1.5">
                            <Settings className="h-3 w-3" />
                            Admin: Operational details
                          </span>
                        </button>
                        {detailsExpanded ? (
                          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {[
                              { label: "Drivers required", value: String(selectedDensityResult.fullResult.drivers_required) },
                              { label: "Vehicles by cube", value: String(selectedDensityResult.fullResult.vehicles_required_by_cube) },
                              { label: "Drivers by time", value: String(selectedDensityResult.fullResult.drivers_by_time) },
                              { label: "Anchor route cost", value: formatCurrency(selectedDensityResult.fullResult.anchor_route_cost) },
                              { label: "Total route cost", value: formatCurrency(selectedDensityResult.fullResult.blended_cost) },
                              { label: "Pickup overlap (min)", value: String(Math.round(selectedDensityResult.fullResult.pickup_overlap_minutes)) },
                            ].map((item) => (
                              <div key={item.label} className="rounded-lg border border-border bg-background/10 px-3 py-2">
                                <div className="text-[10px] text-muted-foreground">{item.label}</div>
                                <div className="mt-1 font-mono text-sm text-foreground">{item.value}</div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-background/10 p-6 text-center text-sm text-muted-foreground">
                    Select an anchor to see cost comparison.
                  </div>
                )}
              </div>
            </div>
          )}
        </ContentPanel>
      </div>
    </TooltipProvider>
  );
}
