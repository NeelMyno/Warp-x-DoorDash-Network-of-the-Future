"use client";

import * as React from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDownToLine,
  CheckCircle2,
  FileUp,
  ListFilter,
  Settings,
  XCircle,
} from "lucide-react";

import { ContentPanel } from "@/components/panels/ContentPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { computeSfsEconomics } from "@/lib/sfs-calculator/compute";
import { validateSfsInputs } from "@/lib/sfs-calculator/validate";
import type {
  SfsCalculatorInputs,
  SfsAnchorResult,
  SfsRateCard,
  SfsStoreUploadError,
  SfsStoreUploadRow,
  SfsStop,
  VehicleType,
} from "@/lib/sfs-calculator/types";
import { DEFAULT_INPUTS, SFS_MARKETS } from "@/lib/sfs-calculator/types";
import type { SfsRateCardsErrorReason } from "@/lib/sfs-calculator/get-rate-cards";
import { generateOutputText, formatCurrency } from "@/lib/sfs-calculator/format";
import { getStoresTemplateCsv, parseStoresUploadText } from "@/lib/sfs-calculator/parse-stores";

export interface SfsConfigError {
  reason: SfsRateCardsErrorReason;
  message: string;
}

interface Props {
  rateCards: SfsRateCard[];
  /** Configuration error when table is missing or inaccessible */
  configError?: SfsConfigError | null;
  /** Whether current user is admin (for showing setup link) */
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

  const anchorResults: SfsAnchorResult[] = React.useMemo(() => {
    if (!canCompute || !uploadedStops || !rateCard) return [];
    return computeSfsEconomics(inputs, uploadedStops, rateCard);
  }, [canCompute, inputs, uploadedStops, rateCard]);

  const sortedAnchors = React.useMemo(() => {
    return [...anchorResults].sort((a, b) => {
      const aEligible = a.isValid && a.total_packages > 0;
      const bEligible = b.isValid && b.total_packages > 0;
      if (aEligible !== bEligible) return aEligible ? -1 : 1;
      if (!aEligible && !bEligible) return a.anchor_id.localeCompare(b.anchor_id);
      return a.blended_cpp - b.blended_cpp;
    });
  }, [anchorResults]);

  React.useEffect(() => {
    if (!sortedAnchors.length) {
      setSelectedAnchorId(null);
      return;
    }
    if (selectedAnchorId && sortedAnchors.some((a) => a.anchor_id === selectedAnchorId)) return;
    setSelectedAnchorId(sortedAnchors[0].anchor_id);
  }, [sortedAnchors, selectedAnchorId]);

  const selectedAnchor = React.useMemo(() => {
    if (!selectedAnchorId) return null;
    return sortedAnchors.find((a) => a.anchor_id === selectedAnchorId) ?? null;
  }, [sortedAnchors, selectedAnchorId]);

  const uploadSummary = React.useMemo(() => {
    if (!uploadedStops) return null;
    const anchorIds = new Set(uploadedStops.map((s) => s.anchor_id));
    return {
      rows: uploadedStops.length,
      anchors: anchorIds.size,
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
    <div className="space-y-4">
      {/* Step 1 */}
      <ContentPanel
        title="1) Upload your stores"
        description="Upload a CSV/TSV to compute one result per unique anchor_id."
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
              Download template CSV
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
                {uploadSummary ? `${uploadSummary.rows} stops • ${uploadSummary.anchors} anchors` : "CSV or TSV"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept=".csv,.tsv,text/csv,text/tab-separated-values"
              onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
              className="h-9 w-full max-w-[320px] cursor-pointer"
            />
          </div>
        </div>

        {uploadErrors.length ? (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-500">
              <AlertCircle className="h-4 w-4" />
              Validation errors
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
                  …and {uploadErrors.length - 8} more.
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {uploadedRows?.length ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-background/10">
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
                {uploadedRows.slice(0, 20).map((row, idx) => (
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
            {uploadedRows.length > 20 ? (
              <div className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
                Showing first 20 rows.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-border bg-background/10 p-6 text-center text-sm text-muted-foreground">
            Upload a stores file to begin.
          </div>
        )}
      </ContentPanel>

      {/* Step 2 */}
      <ContentPanel
        title="2) Select equipment"
        description="Set route assumptions and choose a vehicle type."
        right={
          rateCard ? (
            <Badge variant="outline" className="text-[11px]">
              Rates applied
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[11px] text-muted-foreground">
              Rates missing
            </Badge>
          )
        }
      >
        <div className="grid gap-4 lg:grid-cols-3">
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

          <div className="rounded-xl border border-border bg-background/10 p-3">
            <div className="text-xs font-medium text-foreground">Rates applied</div>
            {rateCard ? (
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
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
              </div>
            ) : (
              <div className="mt-2 text-xs text-muted-foreground">
                Rates not configured for this vehicle type.
                {isAdmin ? (
                  <div className="mt-2">
                    <Link href="/admin?tab=setup" className="text-xs underline hover:text-foreground">
                      Configure in Admin → Setup
                    </Link>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              key: "miles_to_hub_or_spoke",
              label: "Miles to hub/spoke",
              step: "any",
            },
            {
              key: "avg_routing_time_per_stop_minutes",
              label: "Avg routing time / stop (min)",
              step: "any",
            },
            {
              key: "default_service_time_minutes",
              label: "Default service time (min)",
              step: "any",
            },
            {
              key: "max_driver_time_minutes",
              label: "Max driver time (min)",
              step: "any",
            },
            {
              key: "avg_speed_mph",
              label: "Avg speed (mph)",
              step: "any",
            },
            {
              key: "default_avg_cubic_inches_per_package",
              label: "Default avg cube / package (cu in)",
              step: "any",
            },
          ].map((field) => {
            const key = field.key as keyof SfsCalculatorInputs;
            const err = validationErrors[key as string];
            const value = inputs[key];
            return (
              <div key={field.key} className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">{field.label}</Label>
                <Input
                  type="number"
                  step={field.step}
                  value={typeof value === "number" ? value : 0}
                  onChange={(e) =>
                    setInputs((prev) => ({
                      ...prev,
                      [key]: Number(e.target.value),
                    }))
                  }
                  className={err ? "border-[var(--warp-field-error)]" : ""}
                />
                {err ? <p className="text-[10px] text-[var(--warp-danger)]">{err}</p> : null}
              </div>
            );
          })}
        </div>
      </ContentPanel>

      {/* Step 3 */}
      <ContentPanel
        title="3) Review feasibility"
        description="Pickup window overlap must cover pickup minutes required."
        right={
          canCompute ? (
            <Badge variant="accent" className="text-[11px]">
              Ready
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[11px] text-muted-foreground">
              Waiting for inputs
            </Badge>
          )
        }
      >
        {!uploadedStops ? (
          <div className="rounded-xl border border-border bg-background/10 p-6 text-center text-sm text-muted-foreground">
            Upload a stores file to review feasibility.
          </div>
        ) : uploadErrors.length ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-muted-foreground">
            Fix upload validation errors to compute feasibility.
          </div>
        ) : !rateCard ? (
          <div className="rounded-xl border border-border bg-background/10 p-6 text-sm text-muted-foreground">
            Rates must be configured to compute results.
          </div>
        ) : hasErrors ? (
          <div className="rounded-xl border border-border bg-background/10 p-6 text-sm text-muted-foreground">
            Fix input validation errors to compute results.
          </div>
        ) : anchorResults.length === 0 ? (
          <div className="rounded-xl border border-border bg-background/10 p-6 text-sm text-muted-foreground">
            No anchors found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-background/10">
            <table className="w-full text-xs">
              <thead className="border-b border-border/60">
                <tr className="text-left text-muted-foreground">
                  <th className="px-3 py-2">anchor_id</th>
                  <th className="px-3 py-2">feasible</th>
                  <th className="px-3 py-2 text-right">overlap (min)</th>
                  <th className="px-3 py-2 text-right">required (min)</th>
                  <th className="px-3 py-2 text-right">stops</th>
                  <th className="px-3 py-2 text-right">packages</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {sortedAnchors.map((row) => (
                  <tr key={row.anchor_id} className="text-foreground/90">
                    <td className="px-3 py-2 font-mono">{row.anchor_id}</td>
                    <td className="px-3 py-2">
                      {row.isValid ? (
                        row.window_feasible ? (
                          <span className="inline-flex items-center gap-1 text-[var(--warp-success-strong)]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Pass
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-500">
                            <XCircle className="h-3.5 w-3.5" />
                            Fail
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-500">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Invalid data
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{Math.round(row.pickup_overlap_minutes)}</td>
                    <td className="px-3 py-2 text-right font-mono">{Math.round(row.pickup_minutes_required)}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.total_stops}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.total_packages}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ContentPanel>

      {/* Step 4 */}
      <ContentPanel
        title="4) Compare economics"
        description="Sorted by best blended CPP by default."
        right={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={!selectedAnchor || !canCompute}
              onClick={async () => {
                if (!selectedAnchor) return;
                const text = generateOutputText(inputs, [selectedAnchor]);
                await navigator.clipboard.writeText(text);
                toast.success(`Copied output for ${selectedAnchor.anchor_id}`);
              }}
            >
              Copy selected
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={!canCompute || sortedAnchors.length === 0}
              onClick={async () => {
                const text = generateOutputText(inputs, sortedAnchors);
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
            Upload stores + ensure rates are configured to compare economics.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <ListFilter className="h-3.5 w-3.5" />
                Anchors
              </div>
              <div className="space-y-2">
                {sortedAnchors.map((row) => {
                  const isActive = row.anchor_id === selectedAnchorId;
                  const isFeasible = row.isValid && row.window_feasible;
                  const blendedLabel =
                    row.total_packages > 0 ? formatCurrency(row.blended_cpp) : "N/A";
                  return (
                    <button
                      key={row.anchor_id}
                      type="button"
                      onClick={() => setSelectedAnchorId(row.anchor_id)}
                      className={[
                        "w-full rounded-xl border px-3 py-2 text-left transition",
                        isActive
                          ? "border-primary/40 bg-primary/10"
                          : "border-border bg-background/10 hover:bg-background/15",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-mono text-xs text-foreground">{row.anchor_id}</div>
                        <Badge
                          variant={isFeasible ? "accent" : "outline"}
                          className="px-2 py-0.5 text-[10px]"
                        >
                          {row.isValid ? (row.window_feasible ? "Pass" : "Fail") : "Invalid"}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Blended CPP</span>
                        <span className="font-mono text-foreground">{blendedLabel}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-8">
              {selectedAnchor ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-background/10 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-muted-foreground">Selected anchor</div>
                        <div className="mt-1 font-mono text-sm text-foreground">
                          {selectedAnchor.anchor_id}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedAnchor.isValid ? (
                          selectedAnchor.window_feasible ? (
                            <Badge variant="accent" className="text-[11px]">
                              Feasible
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[11px] text-amber-500">
                              Not feasible
                            </Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="text-[11px] text-amber-500">
                            Invalid data
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[11px]">
                          Drivers: {selectedAnchor.drivers_required}
                        </Badge>
                      </div>
                    </div>
                    {selectedAnchor.issues?.length ? (
                      <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-muted-foreground">
                        {selectedAnchor.issues.join(" ")}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-background/10 p-4">
                      <div className="text-xs text-muted-foreground">Anchor CPP</div>
                      <div className="mt-1 text-lg font-semibold text-foreground">
                        {selectedAnchor.anchor_packages > 0 ? formatCurrency(selectedAnchor.anchor_cpp) : "N/A"}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Anchor route cost: <span className="font-mono text-foreground">{formatCurrency(selectedAnchor.anchor_route_cost)}</span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-background/10 p-4">
                      <div className="text-xs text-muted-foreground">Blended CPP</div>
                      <div className="mt-1 text-lg font-semibold text-foreground">
                        {selectedAnchor.total_packages > 0 ? formatCurrency(selectedAnchor.blended_cpp) : "N/A"}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Total route cost: <span className="font-mono text-foreground">{formatCurrency(selectedAnchor.blended_cost)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-background/10 p-4">
                    <div className="text-xs font-medium text-foreground">Details</div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        { label: "Total packages", value: String(selectedAnchor.total_packages) },
                        { label: "Total stops", value: String(selectedAnchor.total_stops) },
                        { label: "Vehicles by cube", value: String(selectedAnchor.vehicles_required_by_cube) },
                        { label: "Pickup overlap (min)", value: String(Math.round(selectedAnchor.pickup_overlap_minutes)) },
                        { label: "Pickup required (min)", value: String(Math.round(selectedAnchor.pickup_minutes_required)) },
                        { label: "Drivers by time", value: String(selectedAnchor.drivers_by_time) },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg border border-border bg-background/10 px-3 py-2">
                          <div className="text-[10px] text-muted-foreground">{item.label}</div>
                          <div className="mt-1 font-mono text-sm text-foreground">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-background/10 p-6 text-center text-sm text-muted-foreground">
                  Select an anchor to see details.
                </div>
              )}
            </div>
          </div>
        )}
      </ContentPanel>
    </div>
  );
}
