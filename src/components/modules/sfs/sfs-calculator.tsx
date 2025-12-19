"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDownToLine,
  ChevronDown,
  ChevronRight,
  FileUp,
  Settings,
  Sparkles,
} from "lucide-react";

import { ContentPanel } from "@/components/panels/ContentPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";

import { computeSfsEconomics } from "@/lib/sfs-calculator/compute";
import type {
  DistanceAssumptions,
  DistanceMode,
  SfsCalculatorInputs,
  SfsDensityTier,
  SfsRateCard,
  SfsStoreUploadError,
  SfsStoreUploadRow,
  SfsStop,
  TierMixShares,
  VehicleType,
} from "@/lib/sfs-calculator/types";
import { DEFAULT_INPUTS, SFS_MARKETS } from "@/lib/sfs-calculator/types";
import type { SfsRateCardsErrorReason } from "@/lib/sfs-calculator/get-rate-cards";
import { validateSfsInputs } from "@/lib/sfs-calculator/validate";
import {
  formatCurrency,
  formatPercent,
  generateSalesSummaryText,
  makeSatelliteResultsCsv,
} from "@/lib/sfs-calculator/format";
import { getStoresTemplateCsv, parseStoresUploadText } from "@/lib/sfs-calculator/parse-stores";
import { computeSatelliteImpacts, type SfsSatelliteImpactSummary } from "@/lib/sfs-calculator/impact";
import {
  AnchorListPanel,
  AnchorSummaryPanel,
  type AnchorListItem,
  type SortOption,
} from "@/components/modules/sfs/results";

export interface SfsConfigError {
  reason: SfsRateCardsErrorReason;
  message: string;
}

interface Props {
  rateCards: SfsRateCard[];
  /** Configuration error when table is missing or inaccessible */
  configError?: SfsConfigError | null;
  /** Density discount tiers (DB-backed, with fallback in server) */
  densityTiers?: SfsDensityTier[];
  /** Admin-only warning strings when using fallbacks */
  adminWarnings?: { densityTiers?: string } | null;
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

export function SfsCalculator({
  rateCards,
  configError,
  densityTiers: initialDensityTiers = [],
  adminWarnings = null,
  isAdmin = false,
}: Props) {

  const [inputs, setInputs] = React.useState<SfsCalculatorInputs>(() => getInitialInputs());
  const [uploadedFileName, setUploadedFileName] = React.useState<string | null>(null);
  const [uploadedRows, setUploadedRows] = React.useState<SfsStoreUploadRow[] | null>(null);
  const [uploadedStops, setUploadedStops] = React.useState<SfsStop[] | null>(null);
  const [uploadErrors, setUploadErrors] = React.useState<SfsStoreUploadError[]>([]);
  const [hasDistanceMiles, setHasDistanceMiles] = React.useState(false);
  const [selectedAnchorId, setSelectedAnchorId] = React.useState<string | null>(null);
  const [assumptionsExpanded, setAssumptionsExpanded] = React.useState(false);
  const [ratesExpanded, setRatesExpanded] = React.useState(false);
  const [diagnosticsExpanded, setDiagnosticsExpanded] = React.useState(false);
  const [densityTiers, setDensityTiers] = React.useState<SfsDensityTier[]>(() => initialDensityTiers);

  // Distance mode state
  const [distanceMode, setDistanceMode] = React.useState<DistanceMode>("average");
  const [avgMiles, setAvgMiles] = React.useState<number>(10);
  const [storeSearchQuery, setStoreSearchQuery] = React.useState<string>("");
  const [tierMix, setTierMix] = React.useState<TierMixShares>({ le10: 25, le20: 25, le30: 25, gt30: 25 });

  const [impactSummary, setImpactSummary] = React.useState<SfsSatelliteImpactSummary | null>(null);
  const [impactError, setImpactError] = React.useState<string | null>(null);
  const [impactPending, startImpactTransition] = React.useTransition();

  // Results sorting
  const [resultsSortBy, setResultsSortBy] = React.useState<SortOption>("cpp");

  React.useEffect(() => {
    setDensityTiers((prev) => (prev.length ? prev : initialDensityTiers));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-detect distance mode from CSV
  React.useEffect(() => {
    if (hasDistanceMiles) {
      setDistanceMode("per_store");
    }
  }, [hasDistanceMiles]);

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

  // Build distance assumptions from current state
  const distanceAssumptions = React.useMemo<DistanceAssumptions>(() => {
    if (distanceMode === "per_store") {
      return { mode: "per_store" };
    }
    if (distanceMode === "tier_mix") {
      return { mode: "tier_mix", tierMix };
    }
    return { mode: "average", avgMiles };
  }, [distanceMode, avgMiles, tierMix]);

  const canCompute =
    !!rateCard &&
    !hasErrors &&
    !!uploadedStops &&
    uploadErrors.length === 0 &&
    uploadedStops.length > 0;

  const computed = React.useMemo(() => {
    if (!canCompute || !uploadedStops || !rateCard) {
      return { results: [], error: null as Error | null };
    }
    try {
      return {
        results: computeSfsEconomics(inputs, uploadedStops, rateCard, {
          densityTiers,
          distanceAssumptions,
        }),
        error: null,
      };
    } catch (err) {
      return { results: [], error: err instanceof Error ? err : new Error("Unknown compute error") };
    }
  }, [canCompute, densityTiers, distanceAssumptions, inputs, rateCard, uploadedStops]);

  const anchorResults = computed.results;
  const computeError = computed.error;

  // Build anchor list items for the new results UI
  const anchorListItems: AnchorListItem[] = React.useMemo(() => {
    return anchorResults.map((r) => {
      const regularCost = r.base_portion_before_density + r.stop_fees_total;
      const regularCpp = r.total_packages > 0 ? regularCost / r.total_packages : 0;
      const withDensityCpp = r.blended_cpp;
      const savingsCpp = Math.max(0, regularCpp - withDensityCpp);
      const savingsPct = regularCpp > 0 ? savingsCpp / regularCpp : 0;
      return {
        anchor_id: r.anchor_id,
        regularCpp,
        withDensityCpp,
        savingsCpp,
        savingsPct,
        totalPackages: r.total_packages,
      };
    });
  }, [anchorResults]);

  // Keep legacy sorted anchors for auto-selection
  const sortedAnchors = React.useMemo(() => {
    return [...anchorListItems].sort((a, b) => a.withDensityCpp - b.withDensityCpp);
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
          distanceAssumptions,
        });
        setImpactSummary(computedImpact.summary);
      } catch (e) {
        setImpactSummary(null);
        setImpactError(e instanceof Error ? e.message : "Unable to compute satellite impacts");
      }
    });
  }, [
    canCompute,
    densityTiers,
    distanceAssumptions,
    inputs,
    rateCard,
    selectedAnchorId,
    selectedAnchorStops,
  ]);

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
    setHasDistanceMiles(false);
    setDistanceMode("average");
    setAvgMiles(10);
    setStoreSearchQuery("");
    setTierMix({ le10: 25, le20: 25, le30: 25, gt30: 25 });
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
      setHasDistanceMiles(false);
      toast.error("Upload failed");
      return;
    }

    setUploadedRows(parsed.rows);
    setUploadedStops(parsed.stops);
    setUploadErrors(parsed.errors);
    setHasDistanceMiles(parsed.hasDistanceMiles);

    if (parsed.errors.length) {
      toast.error(`Uploaded with ${parsed.errors.length} validation error(s)`);
    } else {
      toast.success("Stores uploaded");
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Step 1 */}
        <ContentPanel
          title="1) Upload stores"
          description="Upload anchor + satellite stores. Include optional distance_miles column, or set average miles in Step 2."
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
            <Input
              type="file"
              accept=".csv,.tsv,text/csv,text/tab-separated-values"
              onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
              className="h-9 w-full max-w-[280px] cursor-pointer"
            />
          </div>

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
                {uploadErrors.slice(0, 8).map((err, idx) => (
                  <li key={`${err.row}-${idx}`} className="flex gap-2">
                    <span className="w-12 shrink-0 font-mono text-foreground/70">Row {err.row}</span>
                    <span>{err.message}</span>
                  </li>
                ))}
                {uploadErrors.length > 8 ? (
                  <li className="text-xs text-muted-foreground">
                    …and {uploadErrors.length - 8} more issues.
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          {isAdmin && adminWarnings?.densityTiers ? (
            <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
              <div className="text-xs font-medium text-foreground">Admin notice</div>
              <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                <li>• {adminWarnings.densityTiers}</li>
              </ul>
            </div>
          ) : null}

          {uploadedRows?.length ? (
            <details className="mt-4 group" open>
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                View uploaded rows ({uploadedRows.length})
              </summary>
              <div className="mt-2 space-y-2">
                <Input
                  type="text"
                  placeholder="Search by anchor, store name, or ID..."
                  value={storeSearchQuery}
                  onChange={(e) => setStoreSearchQuery(e.target.value)}
                  className="h-8 max-w-xs text-xs"
                />
                <div className="max-h-[300px] overflow-auto rounded-xl border border-border bg-background/10">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 border-b border-border/60 bg-background/95 backdrop-blur">
                      <tr className="text-left text-muted-foreground">
                        <th className="px-3 py-2">anchor_id</th>
                        <th className="px-3 py-2">stop_type</th>
                        <th className="px-3 py-2">store_name</th>
                        <th className="px-3 py-2">store_id</th>
                        <th className="px-3 py-2 text-right">packages</th>
                        {hasDistanceMiles && <th className="px-3 py-2 text-right">distance_miles</th>}
                        <th className="px-3 py-2">window</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {(() => {
                        const q = storeSearchQuery.toLowerCase().trim();
                        const filtered = q
                          ? uploadedRows.filter(
                              (r) =>
                                r.anchor_id.toLowerCase().includes(q) ||
                                (r.store_name?.toLowerCase().includes(q) ?? false) ||
                                (r.store_id?.toLowerCase().includes(q) ?? false)
                            )
                          : uploadedRows;
                        return filtered.slice(0, 50).map((row, idx) => (
                          <tr key={`${row.anchor_id}-${idx}`} className="text-foreground/90">
                            <td className="px-3 py-2 font-mono">{row.anchor_id}</td>
                            <td className="px-3 py-2">{row.stop_type}</td>
                            <td className="px-3 py-2">{row.store_name || "—"}</td>
                            <td className="px-3 py-2 font-mono text-muted-foreground">{row.store_id}</td>
                            <td className="px-3 py-2 text-right font-mono">{row.packages}</td>
                            {hasDistanceMiles && (
                              <td className="px-3 py-2 text-right font-mono">
                                {row.distance_miles != null ? row.distance_miles.toFixed(1) : "—"}
                              </td>
                            )}
                            <td className="px-3 py-2 font-mono text-muted-foreground">
                              {row.pickup_window_start_time}–{row.pickup_window_end_time}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
                {uploadedRows.length > 50 && !storeSearchQuery ? (
                  <div className="text-xs text-muted-foreground">
                    Showing first 50 of {uploadedRows.length} rows. Use search to filter.
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

        {/* Step 2 */}
        <ContentPanel
          title="2) Route assumptions"
          description="Choose market & vehicle. These affect baseline costs. (Admins can edit rates.)"
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
          {isAdmin && configError ? (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 text-amber-500" />
                <div className="min-w-0">
                  <div className="font-medium text-foreground">Using default rates</div>
                  <div className="mt-1">
                    Rate cards table isn’t available ({configError.reason}). Calculator will use the default vehicle
                    rates for now.
                  </div>
                  <div className="mt-2">
                    <Link href="/admin?tab=setup" className="underline hover:text-foreground">
                      Configure in Admin → Setup
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

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

          {/* Density discount distances */}
          <div className="mt-4 rounded-lg border border-border bg-background/10 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Density discount distances
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Used only to estimate density savings. Stop fees are never discounted.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { value: "per_store" as const, label: "Per-store (from CSV)", disabled: !hasDistanceMiles },
                { value: "average" as const, label: "Average miles" },
                { value: "tier_mix" as const, label: "Tier mix %" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => setDistanceMode(opt.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    distanceMode === opt.value
                      ? "bg-[var(--warp-primary)] text-white"
                      : opt.disabled
                        ? "bg-background/20 text-muted-foreground/50 cursor-not-allowed"
                        : "bg-background/20 text-muted-foreground hover:bg-background/30"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {distanceMode === "per_store" && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Using <span className="font-mono text-foreground">distance_miles</span> column from your CSV.
              </p>
            )}

            {!hasDistanceMiles && distanceMode !== "per_store" && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Tip:</span> Add a <span className="font-mono">distance_miles</span> column to your CSV for per-store distances.
              </p>
            )}

            {distanceMode === "average" && (
              <div className="mt-3 flex items-center gap-2">
                <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Avg distance (mi)</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={avgMiles}
                  onChange={(e) => setAvgMiles(Math.max(0, Number(e.target.value) || 0))}
                  className="h-8 w-24 text-right font-mono"
                />
              </div>
            )}

            {distanceMode === "tier_mix" && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { key: "le10" as const, label: "≤10 mi" },
                    { key: "le20" as const, label: "10–20 mi" },
                    { key: "le30" as const, label: "20–30 mi" },
                    { key: "gt30" as const, label: ">30 mi" },
                  ].map((tier) => (
                    <div key={tier.key} className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{tier.label}</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={tierMix[tier.key]}
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                            setTierMix((prev) => ({ ...prev, [tier.key]: v }));
                          }}
                          className="h-8 text-right font-mono"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                  ))}
                </div>
                {(() => {
                  const total = tierMix.le10 + tierMix.le20 + tierMix.le30 + tierMix.gt30;
                  const isClose = total >= 99.5 && total <= 100.5 && total !== 100;
                  const isOff = total < 99.5 || total > 100.5;
                  return (
                    <div className="flex items-center gap-2">
                      {isOff && (
                        <p className="text-[11px] text-amber-500">
                          Total is {total}% — should be 100%.
                        </p>
                      )}
                      {isClose && (
                        <>
                          <p className="text-[11px] text-muted-foreground">
                            Total is {total}% — close enough, will normalize.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px]"
                            onClick={() => {
                              const sum = tierMix.le10 + tierMix.le20 + tierMix.le30 + tierMix.gt30;
                              if (sum === 0) return;
                              setTierMix({
                                le10: Math.round((tierMix.le10 / sum) * 100),
                                le20: Math.round((tierMix.le20 / sum) * 100),
                                le30: Math.round((tierMix.le30 / sum) * 100),
                                gt30: 100 - Math.round((tierMix.le10 / sum) * 100) - Math.round((tierMix.le20 / sum) * 100) - Math.round((tierMix.le30 / sum) * 100),
                              });
                            }}
                          >
                            Normalize
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Always show discount tier table */}
            <div className="mt-4 pt-3 border-t border-border/60">
              <div className="text-[11px] text-muted-foreground mb-2">Discount by distance tier:</div>
              <div
                className="grid overflow-hidden rounded-lg border border-border/60 bg-background/10"
                style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
              >
                {[
                  { label: "≤10 mi", discount: "20%" },
                  { label: "10–20 mi", discount: "12%" },
                  { label: "20–30 mi", discount: "6%" },
                  { label: ">30 mi", discount: "0%" },
                ].map((t, idx) => (
                  <div
                    key={t.label}
                    className={`px-3 py-2 ${idx < 3 ? "border-r border-border/60" : ""}`}
                  >
                    <div className="text-[11px] font-medium text-foreground">{t.label}</div>
                    <div className="text-[11px] font-mono text-muted-foreground">{t.discount}</div>
                  </div>
                ))}
              </div>
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
                  const displayValue =
                    isLocked && "lockedValue" in field
                      ? field.lockedValue
                      : typeof value === "number"
                        ? value
                        : 0;
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
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      />
                      {err ? <p className="text-[10px] text-[var(--warp-danger)]">{err}</p> : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Admin-only Rates Applied */}
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
                      <div className="mt-2 border-t border-border/60 pt-2">
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

        {/* Step 3 */}
        <ContentPanel
          title="3) Savings & pricing"
          description="See Regular cost vs With density discount, plus per-store impact."
          right={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={!impactSummary || !canCompute || !!computeError || impactPending}
                onClick={async () => {
                  if (!selectedResult || !impactSummary) return;
                  const text = generateSalesSummaryText({
                    inputs,
                    selected: selectedResult,
                    summary: impactSummary,
                  });
                  await navigator.clipboard.writeText(text);
                  toast.success(`Copied summary for ${selectedResult.anchor_id}`);
                }}
              >
                Copy summary
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={!impactSummary || !impactSummary?.impacts?.length || !!computeError || impactPending}
                onClick={() => {
                  if (!impactSummary) return;
                  const csv = makeSatelliteResultsCsv({
                    inputs,
                    summary: impactSummary,
                  });
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `sfs-satellite-results-${impactSummary.anchor_id}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("Downloaded results CSV");
                }}
              >
                Download results CSV
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
          ) : computeError ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 text-amber-500" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">Unable to compute</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {computeError.message}
                  </div>
                </div>
              </div>
            </div>
          ) : sortedAnchors.length === 0 ? (
            <div className="rounded-xl border border-border bg-background/10 p-6 text-center text-sm text-muted-foreground">
              No anchors found in uploaded data.
            </div>
          ) : (
            <div className="grid items-stretch gap-6 lg:grid-cols-12">
              {/* Left panel: Anchor list */}
              <div className="lg:col-span-4">
                <AnchorListPanel
                  anchors={anchorListItems}
                  selectedAnchorId={selectedAnchorId}
                  onSelect={setSelectedAnchorId}
                  sortBy={resultsSortBy}
                  onSortChange={setResultsSortBy}
                />
              </div>

              {/* Right panel: Summary */}
              <div className="lg:col-span-8">
                {!selectedResult ? (
                  <div className="rounded-xl border border-border bg-background/10 p-6 text-center text-sm text-muted-foreground">
                    Select an anchor to see results.
                  </div>
                ) : impactError ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Error:</span> {impactError}
                  </div>
                ) : !impactSummary ? (
                  <div className="rounded-xl border border-border bg-background/10 p-6 text-center text-sm text-muted-foreground">
                    {impactPending ? "Computing…" : "No results available."}
                  </div>
                ) : (
                  <AnchorSummaryPanel
                    inputs={inputs}
                    result={selectedResult}
                    summary={impactSummary}
                  />
                )}

                {/* Admin diagnostics - collapsed */}
                {isAdmin && selectedResult && impactSummary && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setDiagnosticsExpanded(!diagnosticsExpanded)}
                      className="flex w-full items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-amber-500/10"
                      aria-expanded={diagnosticsExpanded}
                    >
                      {diagnosticsExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      <span className="flex items-center gap-1.5">
                        <Settings className="h-3 w-3" />
                        Admin: Diagnostics
                      </span>
                    </button>
                    {diagnosticsExpanded && (
                      <div className="mt-3 space-y-3">
                        <div className="rounded-lg border border-border bg-background/10 p-3">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Tier contributions (share × discount)
                          </div>
                          <div className="mt-2 overflow-x-auto rounded-lg border border-border/60 bg-background/10">
                            <table className="w-full text-xs">
                              <thead className="border-b border-border/60 text-left text-muted-foreground">
                                <tr>
                                  <th className="px-3 py-2">Tier</th>
                                  <th className="px-3 py-2 text-right">Discount</th>
                                  <th className="px-3 py-2 text-right">Share</th>
                                  <th className="px-3 py-2 text-right">Contribution</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/40">
                                {impactSummary.tier_distribution.map((t) => (
                                  <tr key={t.label} className="text-foreground/90">
                                    <td className="px-3 py-2">{t.label}</td>
                                    <td className="px-3 py-2 text-right font-mono">{formatPercent(t.discountPct)}</td>
                                    <td className="px-3 py-2 text-right font-mono">{formatPercent(t.satelliteShare)}</td>
                                    <td className="px-3 py-2 text-right font-mono">
                                      {formatPercent(t.contributionPctPoints)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {[
                            { label: "Base portion (no density)", value: formatCurrency(selectedResult.base_portion_before_density) },
                            { label: "Base portion (after density)", value: formatCurrency(selectedResult.base_portion_after_density) },
                            { label: "Stop fees unchanged", value: formatCurrency(selectedResult.stop_fees_total) },
                            { label: "Pickup overlap (min)", value: String(Math.round(selectedResult.pickup_overlap_minutes)) },
                            { label: "Pickup required (min)", value: String(Math.round(selectedResult.pickup_minutes_required)) },
                            { label: "Window feasible", value: selectedResult.window_feasible ? "Yes" : "No" },
                          ].map((item) => (
                            <div key={item.label} className="rounded-lg border border-border bg-background/10 px-3 py-2">
                              <div className="text-[10px] text-muted-foreground">{item.label}</div>
                              <div className="mt-1 font-mono text-sm text-foreground">{item.value}</div>
                            </div>
                          ))}
                        </div>

                        {adminWarnings?.densityTiers && (
                          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                            <div className="font-medium text-foreground">Warnings</div>
                            <ul className="mt-1 space-y-1">
                              <li>• {adminWarnings.densityTiers}</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
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
