"use client";

import * as React from "react";
import { toast } from "sonner";

import type { NetworkEnhancementsAdminRow } from "@/components/admin/network-enhancements-setup";
import { AssetPickerDialog } from "@/components/admin/asset-picker";
import { ContentPanel } from "@/components/panels/ContentPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  NetworkCostModelSchema,
  NetworkThresholdsSchema,
  type NetworkCostModel,
  type NetworkThresholds,
} from "@/lib/network-enhancements/schema";
import { saveNetworkEnhancementsViewAction } from "@/app/(authed)/admin/network-enhancements/actions";

type SubKey = "hub" | "spoke" | "network";
type VariantKey = "example" | "future";

type ThresholdRowDraft = { threshold: string; change: string };
type UtilizationScenarioDraft = { utilization_label: string; cost_per_box: string };
type BreakdownDraft = {
  last_mile_cost_per_box: string;
  middle_mile_cost_per_box: string;
  first_mile_cost_per_box: string;
  hub_sort_cost_per_box: string;
  spoke_sort_cost_per_box: string;
  dispatch_cost_per_box: string;
};

function formatTimestamp(value: string) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleString();
}

function rowKey(sub: SubKey, variant: VariantKey | null) {
  return `${sub}:${variant ?? "none"}`;
}

function toThresholdDraft(value: NetworkThresholds | null): ThresholdRowDraft[] {
  return (value ?? []).map((r) => ({ threshold: r.threshold, change: r.change }));
}

function toScenarioDraft(value: NetworkCostModel | null): UtilizationScenarioDraft[] {
  return (value?.utilization_scenarios ?? []).map((s) => ({
    utilization_label: s.utilization_label,
    cost_per_box: String(s.cost_per_box),
  }));
}

function toBreakdownDraft(value: NetworkCostModel | null): BreakdownDraft {
  const b = value?.all_in_breakdown;
  return {
    last_mile_cost_per_box: typeof b?.last_mile_cost_per_box === "number" ? String(b.last_mile_cost_per_box) : "",
    middle_mile_cost_per_box: typeof b?.middle_mile_cost_per_box === "number" ? String(b.middle_mile_cost_per_box) : "",
    first_mile_cost_per_box: typeof b?.first_mile_cost_per_box === "number" ? String(b.first_mile_cost_per_box) : "",
    hub_sort_cost_per_box: typeof b?.hub_sort_cost_per_box === "number" ? String(b.hub_sort_cost_per_box) : "",
    spoke_sort_cost_per_box: typeof b?.spoke_sort_cost_per_box === "number" ? String(b.spoke_sort_cost_per_box) : "",
    dispatch_cost_per_box: typeof b?.dispatch_cost_per_box === "number" ? String(b.dispatch_cost_per_box) : "",
  };
}

function parseNonNegativeNumber(label: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false as const, error: `${label} is required.` };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { ok: false as const, error: `${label} must be a number.` };
  if (n < 0) return { ok: false as const, error: `${label} cannot be negative.` };
  return { ok: true as const, value: n };
}

export function NetworkEnhancementsEditor({ initialRows }: { initialRows: NetworkEnhancementsAdminRow[] }) {
  const rowsByKey = React.useMemo(() => {
    const map = new Map<string, NetworkEnhancementsAdminRow>();
    for (const r of initialRows) map.set(rowKey(r.sub, r.variant), r);
    return map;
  }, [initialRows]);

  const [sub, setSub] = React.useState<SubKey>("hub");
  const [variant, setVariant] = React.useState<VariantKey>("example");

  const activeKey = rowKey(sub, sub === "network" ? null : variant);
  const activeRow = rowsByKey.get(activeKey) ?? null;

  const [diagramAssetId, setDiagramAssetId] = React.useState<string | null>(null);
  const [diagramFilename, setDiagramFilename] = React.useState<string | null>(null);
  const [pdfAssetId, setPdfAssetId] = React.useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = React.useState<string | null>(null);
  const [highlightsMd, setHighlightsMd] = React.useState("");
  const [coverageMd, setCoverageMd] = React.useState("");
  const [thresholds, setThresholds] = React.useState<ThresholdRowDraft[]>([]);
  const [scenarios, setScenarios] = React.useState<UtilizationScenarioDraft[]>([]);
  const [breakdown, setBreakdown] = React.useState<BreakdownDraft>({
    last_mile_cost_per_box: "",
    middle_mile_cost_per_box: "",
    first_mile_cost_per_box: "",
    hub_sort_cost_per_box: "",
    spoke_sort_cost_per_box: "",
    dispatch_cost_per_box: "",
  });

  const [openDiagramPicker, setOpenDiagramPicker] = React.useState(false);
  const [openPdfPicker, setOpenPdfPicker] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    setError(null);
    setSavedAt(null);

    setDiagramAssetId(activeRow?.diagramAssetId ?? null);
    setDiagramFilename(activeRow?.diagramFilename ?? null);
    setPdfAssetId(activeRow?.pdfAssetId ?? null);
    setPdfFilename(activeRow?.pdfFilename ?? null);

    setHighlightsMd(activeRow?.networkHighlightsMd ?? "");
    setCoverageMd(activeRow?.networkCoverageMd ?? "");
    setThresholds(toThresholdDraft(activeRow?.networkThresholds ?? null));
    setScenarios(toScenarioDraft(activeRow?.networkCostModel ?? null));
    setBreakdown(toBreakdownDraft(activeRow?.networkCostModel ?? null));
  }, [activeKey, activeRow]);

  const updatedAt = savedAt ?? activeRow?.updatedAt ?? null;

  function validateNetworkJson(): {
    ok: true;
    thresholds: NetworkThresholds | null;
    costModel: NetworkCostModel | null;
  } | { ok: false; error: string } {
    const filteredThresholds = thresholds
      .map((r) => ({ threshold: r.threshold.trim(), change: r.change.trim() }))
      .filter((r) => r.threshold || r.change);

    const thresholdsResult = filteredThresholds.length
      ? NetworkThresholdsSchema.safeParse(filteredThresholds)
      : { success: true as const, data: null };

    if (!thresholdsResult.success) {
      return { ok: false, error: thresholdsResult.error.issues[0]?.message ?? "Invalid thresholds." };
    }

    const filteredScenarios = scenarios
      .map((s) => ({
        utilization_label: s.utilization_label.trim(),
        cost_per_box: s.cost_per_box.trim(),
      }))
      .filter((s) => s.utilization_label || s.cost_per_box);

    const utilization_scenarios: Array<{ utilization_label: string; cost_per_box: number }> = [];
    for (const s of filteredScenarios) {
      if (!s.utilization_label) return { ok: false, error: "Utilization label is required." };
      const n = parseNonNegativeNumber("Cost per box", s.cost_per_box);
      if (!n.ok) return { ok: false, error: n.error };
      utilization_scenarios.push({ utilization_label: s.utilization_label, cost_per_box: n.value });
    }

    const breakdownAny = Object.values(breakdown).some((v) => v.trim().length > 0);
    let all_in_breakdown: NetworkCostModel["all_in_breakdown"] | undefined;
    if (breakdownAny) {
      const parts: Array<[keyof BreakdownDraft, string]> = [
        ["last_mile_cost_per_box", "Last mile cost/box"],
        ["middle_mile_cost_per_box", "Middle mile cost/box"],
        ["first_mile_cost_per_box", "First mile cost/box"],
        ["hub_sort_cost_per_box", "Hub sort cost/box"],
        ["spoke_sort_cost_per_box", "Spoke sort cost/box"],
        ["dispatch_cost_per_box", "Dispatch cost/box"],
      ];
      const out: Record<string, number> = {};
      for (const [key, label] of parts) {
        const parsed = parseNonNegativeNumber(label, breakdown[key]);
        if (!parsed.ok) return { ok: false, error: parsed.error };
        out[key] = parsed.value;
      }
      all_in_breakdown = out as NetworkCostModel["all_in_breakdown"];
    }

    const costCandidate: unknown = {
      utilization_scenarios,
      ...(all_in_breakdown ? { all_in_breakdown } : {}),
    };
    const costResult = utilization_scenarios.length || all_in_breakdown
      ? NetworkCostModelSchema.safeParse(costCandidate)
      : { success: true as const, data: null };

    if (!costResult.success) {
      return { ok: false, error: costResult.error.issues[0]?.message ?? "Invalid cost model." };
    }

    return {
      ok: true,
      thresholds: thresholdsResult.data,
      costModel: costResult.data,
    };
  }

  const save = () => {
    setError(null);
    startTransition(async () => {
      let thresholdsValue: NetworkThresholds | null = null;
      let costModelValue: NetworkCostModel | null = null;

      if (sub === "network") {
        const validation = validateNetworkJson();
        if (!validation.ok) {
          setError(validation.error);
          toast.error(validation.error);
          return;
        }
        thresholdsValue = validation.thresholds;
        costModelValue = validation.costModel;
      }

      const payload = {
        sub,
        variant: sub === "network" ? null : variant,
        diagramAssetId,
        pdfAssetId,
        networkHighlightsMd: sub === "network" ? (highlightsMd.trim() || null) : null,
        networkThresholds: sub === "network" ? thresholdsValue : null,
        networkCoverageMd: sub === "network" ? (coverageMd.trim() || null) : null,
        networkCostModel: sub === "network" ? costModelValue : null,
      };

      const result = await saveNetworkEnhancementsViewAction(payload);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      setSavedAt(result.updatedAt);
      toast.success("Saved");
    });
  };

  return (
    <ContentPanel
      title="Network enhancements"
      description="Configure diagram + SOP PDFs for Hub/Spoke/Network. Any save publishes immediately."
      right={
        updatedAt ? (
          <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
            Updated <span className="ml-1 font-mono">{formatTimestamp(updatedAt)}</span>
          </Badge>
        ) : null
      }
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={sub} onValueChange={(v) => setSub(v as SubKey)}>
            <TabsList className="h-9">
              <TabsTrigger value="hub" className="text-xs">
                Hub
              </TabsTrigger>
              <TabsTrigger value="spoke" className="text-xs">
                Spoke
              </TabsTrigger>
              <TabsTrigger value="network" className="text-xs">
                Network
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {sub === "hub" || sub === "spoke" ? (
            <Tabs value={variant} onValueChange={(v) => setVariant(v as VariantKey)}>
              <TabsList className="h-9">
                <TabsTrigger value="example" className="text-xs">
                  Example
                </TabsTrigger>
                <TabsTrigger value="future" className="text-xs">
                  Future (Automation)
                </TabsTrigger>
              </TabsList>
            </Tabs>
          ) : null}
        </div>

        {(activeRow?.thresholdsInvalid || activeRow?.costModelInvalid) && sub === "network" ? (
          <div className="rounded-xl border border-border bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
            Existing JSON in the database is invalid. Saving will replace it with the values below.
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Diagram asset</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Top-down map / diagram (image).
                </div>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setOpenDiagramPicker(true)}>
                Select
              </Button>
            </div>
            <div className="mt-3 rounded-xl border border-border/70 bg-background/15 px-3 py-2 text-xs text-muted-foreground">
              <div className="font-mono text-foreground">{diagramAssetId ?? "—"}</div>
              {diagramFilename ? <div className="mt-1 truncate">{diagramFilename}</div> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">PDF asset</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  SOP / supporting doc (PDF).
                </div>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setOpenPdfPicker(true)}>
                Select
              </Button>
            </div>
            <div className="mt-3 rounded-xl border border-border/70 bg-background/15 px-3 py-2 text-xs text-muted-foreground">
              <div className="font-mono text-foreground">{pdfAssetId ?? "—"}</div>
              {pdfFilename ? <div className="mt-1 truncate">{pdfFilename}</div> : null}
            </div>
          </div>
        </div>

        {sub === "network" ? (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Automation coverage (markdown)
                </label>
                <Textarea
                  value={highlightsMd}
                  onChange={(e) => setHighlightsMd(e.target.value)}
                  placeholder={"- East Coast hubs: automated\n- Spokes: manual in Phase 1"}
                  className="min-h-[140px]"
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Population coverage / sales highlights (markdown)
                </label>
                <Textarea
                  value={coverageMd}
                  onChange={(e) => setCoverageMd(e.target.value)}
                  placeholder={"- 2-day delivery for any injection on the East Coast…"}
                  className="min-h-[140px]"
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">Volume thresholds</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Table of thresholds and what changes at each level.
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setThresholds((prev) => [...prev, { threshold: "", change: "" }])}
                >
                  Add row
                </Button>
              </div>

              <div className="mt-3 space-y-2">
                {thresholds.length ? (
                  thresholds.map((row, idx) => (
                    <div
                      key={idx}
                      className="grid gap-2 rounded-xl border border-border/60 bg-background/15 p-3 lg:grid-cols-[220px_1fr_auto]"
                    >
                      <Input
                        value={row.threshold}
                        onChange={(e) =>
                          setThresholds((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, threshold: e.target.value } : r)),
                          )
                        }
                        placeholder="<X boxes/day"
                        disabled={isPending}
                      />
                      <Input
                        value={row.change}
                        onChange={(e) =>
                          setThresholds((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, change: e.target.value } : r)),
                          )
                        }
                        placeholder="What changes at this threshold?"
                        disabled={isPending}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-10 px-3"
                        disabled={isPending}
                        onClick={() => setThresholds((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
                    No thresholds configured yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">Cost model</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Utilization scenarios and all-in breakdown.
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() =>
                    setScenarios((prev) => [...prev, { utilization_label: "", cost_per_box: "" }])
                  }
                >
                  Add scenario
                </Button>
              </div>

              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    Utilization scenarios
                  </div>
                  {scenarios.length ? (
                    <div className="space-y-2">
                      {scenarios.map((s, idx) => (
                        <div
                          key={idx}
                          className="grid gap-2 rounded-xl border border-border/60 bg-background/15 p-3 lg:grid-cols-[1fr_140px_auto]"
                        >
                          <Input
                            value={s.utilization_label}
                            onChange={(e) =>
                              setScenarios((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, utilization_label: e.target.value } : r,
                                ),
                              )
                            }
                            placeholder="e.g. 75%"
                            disabled={isPending}
                          />
                          <Input
                            value={s.cost_per_box}
                            onChange={(e) =>
                              setScenarios((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, cost_per_box: e.target.value } : r,
                                ),
                              )
                            }
                            placeholder="0.00"
                            inputMode="decimal"
                            disabled={isPending}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-10 px-3"
                            disabled={isPending}
                            onClick={() => setScenarios((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
                      No scenarios configured yet.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    All-in breakdown (optional)
                  </div>
                  <div className="grid gap-2 rounded-xl border border-border/60 bg-background/15 p-3">
                    {(
                      [
                        ["last_mile_cost_per_box", "Last mile"],
                        ["middle_mile_cost_per_box", "Middle mile"],
                        ["first_mile_cost_per_box", "First mile"],
                        ["hub_sort_cost_per_box", "Hub sort"],
                        ["spoke_sort_cost_per_box", "Spoke sort"],
                        ["dispatch_cost_per_box", "Dispatch"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key} className="grid grid-cols-[1fr_140px] items-center gap-3">
                        <div className="text-sm text-muted-foreground">{label}</div>
                        <Input
                          value={breakdown[key]}
                          onChange={(e) => setBreakdown((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder="0.00"
                          inputMode="decimal"
                          disabled={isPending}
                        />
                      </div>
                    ))}
                    <div className="text-xs text-muted-foreground">
                      Leave all fields empty to omit this section.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" disabled={isPending} onClick={() => {
            if (!activeRow) return;
            setDiagramAssetId(activeRow.diagramAssetId ?? null);
            setDiagramFilename(activeRow.diagramFilename ?? null);
            setPdfAssetId(activeRow.pdfAssetId ?? null);
            setPdfFilename(activeRow.pdfFilename ?? null);
            setHighlightsMd(activeRow.networkHighlightsMd ?? "");
            setCoverageMd(activeRow.networkCoverageMd ?? "");
            setThresholds(toThresholdDraft(activeRow.networkThresholds ?? null));
            setScenarios(toScenarioDraft(activeRow.networkCostModel ?? null));
            setBreakdown(toBreakdownDraft(activeRow.networkCostModel ?? null));
            setError(null);
            toast.message("Reverted local changes");
          }}>
            Cancel
          </Button>
          <Button type="button" disabled={isPending} onClick={save}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <AssetPickerDialog
        open={openDiagramPicker}
        onOpenChange={setOpenDiagramPicker}
        moduleSlug="network-enhancements"
        imagesOnly
        onSelect={(asset) => {
          setDiagramAssetId(asset.id);
          setDiagramFilename(asset.filename);
        }}
      />

      <AssetPickerDialog
        open={openPdfPicker}
        onOpenChange={setOpenPdfPicker}
        moduleSlug="network-enhancements"
        pdfOnly
        onSelect={(asset) => {
          setPdfAssetId(asset.id);
          setPdfFilename(asset.filename);
        }}
      />
    </ContentPanel>
  );
}
