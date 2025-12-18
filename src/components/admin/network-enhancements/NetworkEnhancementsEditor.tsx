"use client";

import * as React from "react";
import { toast } from "sonner";

import type { NetworkEnhancementsAdminRow } from "@/components/admin/network-enhancements-setup";
import type { NetworkInsights } from "@/lib/network-enhancements/insights-schema";
import { AssetPickerDialog } from "@/components/admin/asset-picker";
import { ContentPanel } from "@/components/panels/ContentPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { saveNetworkEnhancementsViewAction } from "@/app/(authed)/admin/network-enhancements/actions";

type SubKey = "hub" | "spoke" | "network";
type VariantKey = "example" | "future";
type NetworkTabKey = "assets" | "insights";

type AutomationNodeDraft = {
  id: string;
  node_type: "hub" | "spoke";
  name: string;
  market: string;
  region: string;
  automation_status: "automated" | "partial" | "manual";
  notes: string;
};

type VolumeThresholdDraft = {
  id: string;
  label: string;
  changes: string[];
  implication: string;
};

type CoverageClaimDraft = {
  id: string;
  title: string;
  statement: string;
  service_level: string;
  region: string;
  injection: string;
  limitations: string;
};

type CostScenarioDraft = {
  id: string;
  name: string;
  truck_utilization_pct: string;
  middle_mile_cost_per_box: string;
  all_in_cost_per_box: string;
  last_mile_cost_per_box: string;
  first_mile_cost_per_box: string;
  hub_sort_cost_per_box: string;
  spoke_sort_cost_per_box: string;
  dispatch_cost_per_box: string;
  notes: string;
};

type Baseline = {
  diagramAssetId: string | null;
  diagramFilename: string | null;
  pdfAssetId: string | null;
  pdfFilename: string | null;
  diagramTitle: string;
  diagramAlt: string;
  diagramCaption: string;
  pdfTitle: string;
  pdfCaption: string;
  nodes: AutomationNodeDraft[];
  thresholds: VolumeThresholdDraft[];
  claims: CoverageClaimDraft[];
  scenarios: CostScenarioDraft[];
  updatedAt: string | null;
};

function formatTimestamp(value: string) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleString();
}

function rowKey(sub: SubKey, variant: VariantKey | null) {
  return `${sub}:${variant ?? "none"}`;
}

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    // Best-effort fallback
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function toText(value: string | null | undefined) {
  return typeof value === "string" ? value : "";
}

function toNullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalNonNegative(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true as const, value: null };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { ok: false as const, error: `${label} must be a number.` };
  if (n < 0) return { ok: false as const, error: `${label} cannot be negative.` };
  return { ok: true as const, value: n };
}

function parseOptionalPercent(value: string) {
  const parsed = parseOptionalNonNegative(value, "Truck utilization");
  if (!parsed.ok) return parsed;
  if (parsed.value === null) return parsed;
  if (parsed.value > 100) return { ok: false as const, error: "Truck utilization must be 0–100." };
  return parsed;
}

function toDraftsFromInsights(insights: NetworkInsights | null) {
  const nodes: AutomationNodeDraft[] = (insights?.automationNodes ?? []).map((n) => ({
    id: n.id,
    node_type: n.node_type,
    name: n.name,
    market: n.market ?? "",
    region: n.region ?? "",
    automation_status: n.automation_status,
    notes: n.notes ?? "",
  }));

  const thresholds: VolumeThresholdDraft[] = (insights?.volumeThresholds ?? []).map((t) => ({
    id: t.id,
    label: t.label,
    changes: t.changes,
    implication: t.implication ?? "",
  }));

  const claims: CoverageClaimDraft[] = (insights?.coverageClaims ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    statement: c.statement,
    service_level: c.service_level ?? "",
    region: c.region ?? "",
    injection: c.injection ?? "",
    limitations: c.limitations ?? "",
  }));

  const scenarios: CostScenarioDraft[] = (insights?.costScenarios ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    truck_utilization_pct: typeof s.truck_utilization_pct === "number" ? String(s.truck_utilization_pct) : "",
    middle_mile_cost_per_box: typeof s.middle_mile_cost_per_box === "number" ? String(s.middle_mile_cost_per_box) : "",
    all_in_cost_per_box: typeof s.all_in_cost_per_box === "number" ? String(s.all_in_cost_per_box) : "",
    last_mile_cost_per_box: typeof s.last_mile_cost_per_box === "number" ? String(s.last_mile_cost_per_box) : "",
    first_mile_cost_per_box: typeof s.first_mile_cost_per_box === "number" ? String(s.first_mile_cost_per_box) : "",
    hub_sort_cost_per_box: typeof s.hub_sort_cost_per_box === "number" ? String(s.hub_sort_cost_per_box) : "",
    spoke_sort_cost_per_box: typeof s.spoke_sort_cost_per_box === "number" ? String(s.spoke_sort_cost_per_box) : "",
    dispatch_cost_per_box: typeof s.dispatch_cost_per_box === "number" ? String(s.dispatch_cost_per_box) : "",
    notes: s.notes ?? "",
  }));

  return { nodes, thresholds, claims, scenarios };
}

function makeBaseline(input: Omit<Baseline, "updatedAt"> & { updatedAt: string | null }): Baseline {
  return input;
}

function snapshotFromBaseline(input: Baseline, includeInsights: boolean) {
  const base = {
    diagramAssetId: input.diagramAssetId,
    pdfAssetId: input.pdfAssetId,
    diagramTitle: input.diagramTitle,
    diagramAlt: input.diagramAlt,
    diagramCaption: input.diagramCaption,
    pdfTitle: input.pdfTitle,
    pdfCaption: input.pdfCaption,
  };
  if (!includeInsights) return JSON.stringify(base);
  return JSON.stringify({
    ...base,
    nodes: input.nodes,
    thresholds: input.thresholds,
    claims: input.claims,
    scenarios: input.scenarios,
  });
}

export function NetworkEnhancementsEditor({
  initialRows,
  initialNetworkInsights,
  insightsError,
}: {
  initialRows: NetworkEnhancementsAdminRow[];
  initialNetworkInsights: NetworkInsights | null;
  insightsError: string | null;
}) {
  const [rows, setRows] = React.useState<NetworkEnhancementsAdminRow[]>(initialRows);
  const [networkInsights, setNetworkInsights] = React.useState<NetworkInsights | null>(
    initialNetworkInsights,
  );

  const rowsByKey = React.useMemo(() => {
    const map = new Map<string, NetworkEnhancementsAdminRow>();
    for (const r of rows) map.set(rowKey(r.sub, r.variant), r);
    return map;
  }, [rows]);

  const [sub, setSub] = React.useState<SubKey>("hub");
  const [variant, setVariant] = React.useState<VariantKey>("example");
  const [networkTab, setNetworkTab] = React.useState<NetworkTabKey>("assets");

  const activeKey = rowKey(sub, sub === "network" ? null : variant);
  const activeRow = rowsByKey.get(activeKey) ?? null;

  const [diagramAssetId, setDiagramAssetId] = React.useState<string | null>(null);
  const [diagramFilename, setDiagramFilename] = React.useState<string | null>(null);
  const [pdfAssetId, setPdfAssetId] = React.useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = React.useState<string | null>(null);

  const [diagramTitle, setDiagramTitle] = React.useState("");
  const [diagramAlt, setDiagramAlt] = React.useState("");
  const [diagramCaption, setDiagramCaption] = React.useState("");
  const [pdfTitle, setPdfTitle] = React.useState("");
  const [pdfCaption, setPdfCaption] = React.useState("");

  const [nodes, setNodes] = React.useState<AutomationNodeDraft[]>([]);
  const [thresholds, setThresholds] = React.useState<VolumeThresholdDraft[]>([]);
  const [claims, setClaims] = React.useState<CoverageClaimDraft[]>([]);
  const [scenarios, setScenarios] = React.useState<CostScenarioDraft[]>([]);

  const [openDiagramPicker, setOpenDiagramPicker] = React.useState(false);
  const [openPdfPicker, setOpenPdfPicker] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [pendingNav, setPendingNav] = React.useState<{ sub: SubKey; variant: VariantKey } | null>(
    null,
  );
  const [conflictOpen, setConflictOpen] = React.useState(false);

  const [isPending, startTransition] = React.useTransition();

  const baselineRef = React.useRef<Baseline | null>(null);

  const includeInsights = sub === "network";

  React.useEffect(() => {
    const row = rowsByKey.get(activeKey) ?? null;
    if (!row) return;

    const drafts = toDraftsFromInsights(sub === "network" ? networkInsights : null);

    const baseline = makeBaseline({
      diagramAssetId: row.diagramAssetId ?? null,
      diagramFilename: row.diagramFilename ?? null,
      pdfAssetId: row.pdfAssetId ?? null,
      pdfFilename: row.pdfFilename ?? null,
      diagramTitle: toText(row.diagramTitle),
      diagramAlt: toText(row.diagramAlt),
      diagramCaption: toText(row.diagramCaption),
      pdfTitle: toText(row.pdfTitle),
      pdfCaption: toText(row.pdfCaption),
      nodes: drafts.nodes,
      thresholds: drafts.thresholds,
      claims: drafts.claims,
      scenarios: drafts.scenarios,
      updatedAt: row.updatedAt ?? null,
    });

    baselineRef.current = baseline;
    setDiagramAssetId(baseline.diagramAssetId);
    setDiagramFilename(baseline.diagramFilename);
    setPdfAssetId(baseline.pdfAssetId);
    setPdfFilename(baseline.pdfFilename);
    setDiagramTitle(baseline.diagramTitle);
    setDiagramAlt(baseline.diagramAlt);
    setDiagramCaption(baseline.diagramCaption);
    setPdfTitle(baseline.pdfTitle);
    setPdfCaption(baseline.pdfCaption);

    setNodes(baseline.nodes);
    setThresholds(baseline.thresholds);
    setClaims(baseline.claims);
    setScenarios(baseline.scenarios);
    setSavedAt(null);
    setError(null);
    setDirty(false);
    setNetworkTab("assets");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  React.useEffect(() => {
    if (!baselineRef.current) return;
    const current: Baseline = {
      ...baselineRef.current,
      diagramAssetId,
      diagramFilename,
      pdfAssetId,
      pdfFilename,
      diagramTitle,
      diagramAlt,
      diagramCaption,
      pdfTitle,
      pdfCaption,
      nodes,
      thresholds,
      claims,
      scenarios,
      updatedAt: savedAt ?? baselineRef.current.updatedAt,
    };

    const currentSnap = snapshotFromBaseline(current, includeInsights);
    const baseSnap = snapshotFromBaseline(baselineRef.current, includeInsights);
    setDirty(currentSnap !== baseSnap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    diagramAssetId,
    pdfAssetId,
    diagramTitle,
    diagramAlt,
    diagramCaption,
    pdfTitle,
    pdfCaption,
    nodes,
    thresholds,
    claims,
    scenarios,
    includeInsights,
    savedAt,
  ]);

  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const updatedAt = savedAt ?? activeRow?.updatedAt ?? null;

  const confirmSwitch = (nextSub: SubKey, nextVariant: VariantKey) => {
    if (!dirty) {
      setSub(nextSub);
      setVariant(nextVariant);
      return;
    }
    setPendingNav({ sub: nextSub, variant: nextVariant });
  };

  const revertLocal = () => {
    if (!baselineRef.current) return;
    const b = baselineRef.current;
    setDiagramAssetId(b.diagramAssetId);
    setDiagramFilename(b.diagramFilename);
    setPdfAssetId(b.pdfAssetId);
    setPdfFilename(b.pdfFilename);
    setDiagramTitle(b.diagramTitle);
    setDiagramAlt(b.diagramAlt);
    setDiagramCaption(b.diagramCaption);
    setPdfTitle(b.pdfTitle);
    setPdfCaption(b.pdfCaption);
    setNodes(b.nodes);
    setThresholds(b.thresholds);
    setClaims(b.claims);
    setScenarios(b.scenarios);
    setError(null);
    toast.message("Reverted local changes");
  };

  const validateInsights = () => {
    const trimmedNodes = nodes.map((n) => ({
      ...n,
      name: n.name.trim(),
      market: n.market.trim(),
      region: n.region.trim(),
      notes: n.notes.trim(),
    }));
    for (const n of trimmedNodes) {
      if (!n.name) return { ok: false as const, error: "Automation nodes: name is required." };
    }

    const trimmedThresholds = thresholds.map((t) => ({
      ...t,
      label: t.label.trim(),
      implication: t.implication.trim(),
      changes: t.changes.map((c) => c.trim()).filter(Boolean),
    }));
    for (const t of trimmedThresholds) {
      if (!t.label) return { ok: false as const, error: "Volume thresholds: label is required." };
      if (t.changes.length < 1) return { ok: false as const, error: "Volume thresholds: add at least 1 bullet." };
      if (t.changes.length > 12) return { ok: false as const, error: "Volume thresholds: max 12 bullets." };
    }

    const trimmedClaims = claims.map((c) => ({
      ...c,
      title: c.title.trim(),
      statement: c.statement.trim(),
      service_level: c.service_level.trim(),
      region: c.region.trim(),
      injection: c.injection.trim(),
      limitations: c.limitations.trim(),
    }));
    for (const c of trimmedClaims) {
      if (!c.title) return { ok: false as const, error: "Coverage claims: title is required." };
      if (!c.statement) return { ok: false as const, error: "Coverage claims: statement is required." };
    }

    const parsedScenarios = [];
    for (const s of scenarios) {
      const name = s.name.trim();
      if (!name) return { ok: false as const, error: "Cost scenarios: scenario name is required." };

      const utilization = parseOptionalPercent(s.truck_utilization_pct);
      if (!utilization.ok) return { ok: false as const, error: utilization.error };

      const middle = parseOptionalNonNegative(s.middle_mile_cost_per_box, "Middle mile cost/box");
      if (!middle.ok) return { ok: false as const, error: middle.error };

      const allIn = parseOptionalNonNegative(s.all_in_cost_per_box, "All-in cost/box");
      if (!allIn.ok) return { ok: false as const, error: allIn.error };

      const lastMile = parseOptionalNonNegative(s.last_mile_cost_per_box, "Last mile cost/box");
      if (!lastMile.ok) return { ok: false as const, error: lastMile.error };

      const firstMile = parseOptionalNonNegative(s.first_mile_cost_per_box, "First mile cost/box");
      if (!firstMile.ok) return { ok: false as const, error: firstMile.error };

      const hubSort = parseOptionalNonNegative(s.hub_sort_cost_per_box, "Hub sort cost/box");
      if (!hubSort.ok) return { ok: false as const, error: hubSort.error };

      const spokeSort = parseOptionalNonNegative(s.spoke_sort_cost_per_box, "Spoke sort cost/box");
      if (!spokeSort.ok) return { ok: false as const, error: spokeSort.error };

      const dispatch = parseOptionalNonNegative(s.dispatch_cost_per_box, "Dispatch cost/box");
      if (!dispatch.ok) return { ok: false as const, error: dispatch.error };

      parsedScenarios.push({
        id: s.id,
        name,
        truck_utilization_pct: utilization.value,
        middle_mile_cost_per_box: middle.value,
        all_in_cost_per_box: allIn.value,
        last_mile_cost_per_box: lastMile.value,
        first_mile_cost_per_box: firstMile.value,
        hub_sort_cost_per_box: hubSort.value,
        spoke_sort_cost_per_box: spokeSort.value,
        dispatch_cost_per_box: dispatch.value,
        notes: s.notes.trim() ? s.notes.trim() : null,
      });
    }

    return {
      ok: true as const,
      insights: {
        automationNodes: trimmedNodes.map((n) => ({
          id: n.id,
          node_type: n.node_type,
          name: n.name,
          market: toNullable(n.market),
          region: toNullable(n.region),
          automation_status: n.automation_status,
          notes: toNullable(n.notes),
        })),
        volumeThresholds: trimmedThresholds.map((t) => ({
          id: t.id,
          label: t.label,
          changes: t.changes,
          implication: toNullable(t.implication),
        })),
        coverageClaims: trimmedClaims.map((c) => ({
          id: c.id,
          title: c.title,
          statement: c.statement,
          service_level: toNullable(c.service_level),
          region: toNullable(c.region),
          injection: toNullable(c.injection),
          limitations: toNullable(c.limitations),
        })),
        costScenarios: parsedScenarios,
      },
    };
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const expectedUpdatedAt = savedAt ?? activeRow?.updatedAt ?? null;

      if (diagramAssetId && !diagramAlt.trim()) {
        setError("Diagram alt text is required when a diagram is selected.");
        toast.error("Diagram alt text is required.");
        return;
      }

      let insightsPayload: unknown = null;
      let latestInsights: ReturnType<typeof validateInsights> | null = null;
      if (sub === "network") {
        if (insightsError) {
          setError("Insights tables are not available. Run the migration and retry.");
          toast.error("Insights tables are not available.");
          return;
        }
        const validation = validateInsights();
        if (!validation.ok) {
          setError(validation.error);
          toast.error(validation.error);
          return;
        }
        latestInsights = validation;
        insightsPayload = validation.insights;
      }

      const payload = {
        sub,
        variant: sub === "network" ? null : variant,
        diagramAssetId,
        pdfAssetId,
        diagramTitle: toNullable(diagramTitle),
        diagramAlt: toNullable(diagramAlt),
        diagramCaption: toNullable(diagramCaption),
        pdfTitle: toNullable(pdfTitle),
        pdfCaption: toNullable(pdfCaption),
        expectedUpdatedAt,
        insights: sub === "network" ? insightsPayload : null,
      };

      const result = await saveNetworkEnhancementsViewAction(payload);
      if (!result.ok) {
        setError(result.error);
        if (result.error.toLowerCase().includes("updated by someone else")) {
          setConflictOpen(true);
        }
        toast.error(result.error);
        return;
      }

      setRows((prev) =>
        prev.map((r) =>
          rowKey(r.sub, r.variant) === activeKey
            ? {
                ...r,
                diagramAssetId,
                diagramFilename,
                pdfAssetId,
                pdfFilename,
                diagramTitle: toNullable(diagramTitle),
                diagramAlt: toNullable(diagramAlt),
                diagramCaption: toNullable(diagramCaption),
                pdfTitle: toNullable(pdfTitle),
                pdfCaption: toNullable(pdfCaption),
                updatedAt: result.updatedAt,
              }
            : r,
        ),
      );

      if (sub === "network" && latestInsights?.ok) {
        const now = result.updatedAt;
        setNetworkInsights({
          automationNodes: latestInsights.insights.automationNodes.map((n, idx) => ({
            id: n.id,
            node_type: n.node_type,
            name: n.name,
            market: n.market ?? null,
            region: n.region ?? null,
            automation_status: n.automation_status,
            notes: n.notes ?? null,
            sort_order: idx,
            updated_at: now,
          })),
          volumeThresholds: latestInsights.insights.volumeThresholds.map((t, idx) => ({
            id: t.id,
            label: t.label,
            changes: t.changes,
            implication: t.implication ?? null,
            sort_order: idx,
            updated_at: now,
          })),
          coverageClaims: latestInsights.insights.coverageClaims.map((c, idx) => ({
            id: c.id,
            title: c.title,
            statement: c.statement,
            service_level: c.service_level ?? null,
            region: c.region ?? null,
            injection: c.injection ?? null,
            limitations: c.limitations ?? null,
            sort_order: idx,
            updated_at: now,
          })),
          costScenarios: latestInsights.insights.costScenarios.map((s, idx) => ({
            id: s.id,
            name: s.name,
            truck_utilization_pct: s.truck_utilization_pct ?? null,
            middle_mile_cost_per_box: s.middle_mile_cost_per_box ?? null,
            all_in_cost_per_box: s.all_in_cost_per_box ?? null,
            last_mile_cost_per_box: s.last_mile_cost_per_box ?? null,
            first_mile_cost_per_box: s.first_mile_cost_per_box ?? null,
            hub_sort_cost_per_box: s.hub_sort_cost_per_box ?? null,
            spoke_sort_cost_per_box: s.spoke_sort_cost_per_box ?? null,
            dispatch_cost_per_box: s.dispatch_cost_per_box ?? null,
            notes: s.notes ?? null,
            sort_order: idx,
            updated_at: now,
          })),
          updatedAt: {
            automationCoverage: now,
            volumeThresholds: now,
            populationCoverage: now,
            costModeling: now,
          },
        });
      }

      setSavedAt(result.updatedAt);
      baselineRef.current = {
        diagramAssetId,
        diagramFilename,
        pdfAssetId,
        pdfFilename,
        diagramTitle,
        diagramAlt,
        diagramCaption,
        pdfTitle,
        pdfCaption,
        nodes,
        thresholds,
        claims,
        scenarios,
        updatedAt: result.updatedAt,
      };
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
          <Tabs
            value={sub}
            onValueChange={(v) => confirmSwitch(v as SubKey, variant)}
          >
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
            <Tabs
              value={variant}
              onValueChange={(v) => confirmSwitch(sub, v as VariantKey)}
            >
              <TabsList className="h-9">
                <TabsTrigger value="example" className="text-xs">
                  Example
                </TabsTrigger>
                <TabsTrigger value="future" className="text-xs">
                  Future (Automation)
                </TabsTrigger>
              </TabsList>
            </Tabs>
          ) : (
            <Tabs value={networkTab} onValueChange={(v) => setNetworkTab(v as NetworkTabKey)}>
              <TabsList className="h-9">
                <TabsTrigger value="assets" className="text-xs">
                  Assets
                </TabsTrigger>
                <TabsTrigger value="insights" className="text-xs">
                  Insights
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>

        {sub === "network" && networkTab === "insights" && insightsError ? (
          <div className="rounded-xl border border-border bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
            Insights tables are not available yet. Run{" "}
            <span className="font-mono text-foreground">supabase/sql/11_network_enhancements_insights.sql</span>{" "}
            and refresh.
          </div>
        ) : null}

        {sub !== "network" || networkTab === "assets" ? (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">Diagram asset</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Top-down map / diagram (image).
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setOpenDiagramPicker(true)}
                    disabled={isPending}
                  >
                    Select
                  </Button>
                </div>
                <div className="mt-3 rounded-xl border border-border/70 bg-background/15 px-3 py-2 text-xs text-muted-foreground">
                  <div className="font-mono text-foreground">{diagramAssetId ?? "—"}</div>
                  {diagramFilename ? <div className="mt-1 truncate">{diagramFilename}</div> : null}
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Diagram title</label>
                    <Input
                      value={diagramTitle}
                      onChange={(e) => setDiagramTitle(e.target.value)}
                      placeholder="e.g. Atlanta Hub Layout"
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Diagram alt text {diagramAssetId ? <span className="text-destructive">*</span> : null}
                    </label>
                    <Input
                      value={diagramAlt}
                      onChange={(e) => setDiagramAlt(e.target.value)}
                      placeholder="Describe the diagram for accessibility"
                      disabled={isPending}
                    />
                    <div className="text-xs text-muted-foreground">
                      Required when a diagram is selected.
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Diagram caption (optional)
                    </label>
                    <Textarea
                      value={diagramCaption}
                      onChange={(e) => setDiagramCaption(e.target.value)}
                      placeholder="Short context shown under the diagram."
                      className="min-h-[90px]"
                      disabled={isPending}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">PDF asset</div>
                    <div className="mt-1 text-xs text-muted-foreground">SOP / supporting doc (PDF).</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setOpenPdfPicker(true)}
                    disabled={isPending}
                  >
                    Select
                  </Button>
                </div>
                <div className="mt-3 rounded-xl border border-border/70 bg-background/15 px-3 py-2 text-xs text-muted-foreground">
                  <div className="font-mono text-foreground">{pdfAssetId ?? "—"}</div>
                  {pdfFilename ? <div className="mt-1 truncate">{pdfFilename}</div> : null}
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">PDF title</label>
                    <Input
                      value={pdfTitle}
                      onChange={(e) => setPdfTitle(e.target.value)}
                      placeholder="e.g. Hub SOP (Example)"
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">PDF caption (optional)</label>
                    <Textarea
                      value={pdfCaption}
                      onChange={(e) => setPdfCaption(e.target.value)}
                      placeholder="Short context shown under the PDF."
                      className="min-h-[90px]"
                      disabled={isPending}
                    />
                  </div>
                </div>
              </div>
            </div>

            {sub === "network" ? (
              <div className="rounded-xl border border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                Insights are configured under the <span className="font-medium text-foreground">Insights</span> tab.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">Automation coverage</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Which hubs/spokes have automation vs not.
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending || !!insightsError}
                    onClick={() =>
                      setNodes((prev) => [
                        ...prev,
                        {
                          id: newId(),
                          node_type: "hub",
                          name: "",
                          market: "",
                          region: "",
                          automation_status: "manual",
                          notes: "",
                        },
                      ])
                    }
                  >
                    Add row
                  </Button>
                </div>

                <div className="mt-4 space-y-3">
                  {nodes.length ? (
                    <div className="space-y-2">
                      {nodes.map((n, idx) => (
                        <div key={n.id} className="rounded-xl border border-border/60 bg-background/15 p-3">
                          <div className="grid gap-2 md:grid-cols-[120px_1fr]">
                            <div className="space-y-1">
                              <div className="text-[11px] font-medium text-muted-foreground">Type</div>
                              <select
                                value={n.node_type}
                                onChange={(e) => {
                                  const nextType: AutomationNodeDraft["node_type"] =
                                    e.target.value === "spoke" ? "spoke" : "hub";
                                  setNodes((prev) =>
                                    prev.map((r) => (r.id === n.id ? { ...r, node_type: nextType } : r)),
                                  );
                                }}
                                className={cn(
                                  "h-9 rounded-lg border border-border bg-background/25 px-3 text-sm text-foreground",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                )}
                                disabled={isPending || !!insightsError}
                              >
                                <option value="hub">Hub</option>
                                <option value="spoke">Spoke</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <div className="text-[11px] font-medium text-muted-foreground">Name</div>
                              <Input
                                value={n.name}
                                onChange={(e) =>
                                  setNodes((prev) =>
                                    prev.map((r) => (r.id === n.id ? { ...r, name: e.target.value } : r)),
                                  )
                                }
                                placeholder="e.g. Atlanta Hub"
                                disabled={isPending || !!insightsError}
                              />
                            </div>
                          </div>

                          <div className="mt-2 grid gap-2 md:grid-cols-3">
                            <div className="space-y-1">
                              <div className="text-[11px] font-medium text-muted-foreground">Market</div>
                              <Input
                                value={n.market}
                                onChange={(e) =>
                                  setNodes((prev) =>
                                    prev.map((r) => (r.id === n.id ? { ...r, market: e.target.value } : r)),
                                  )
                                }
                                placeholder="Optional"
                                disabled={isPending || !!insightsError}
                              />
                            </div>
                            <div className="space-y-1">
                              <div className="text-[11px] font-medium text-muted-foreground">Region</div>
                              <Input
                                value={n.region}
                                onChange={(e) =>
                                  setNodes((prev) =>
                                    prev.map((r) => (r.id === n.id ? { ...r, region: e.target.value } : r)),
                                  )
                                }
                                placeholder="Optional"
                                disabled={isPending || !!insightsError}
                              />
                            </div>
                            <div className="space-y-1">
                              <div className="text-[11px] font-medium text-muted-foreground">Status</div>
                              <select
                                value={n.automation_status}
                                onChange={(e) => {
                                  const nextStatus: AutomationNodeDraft["automation_status"] =
                                    e.target.value === "automated"
                                      ? "automated"
                                      : e.target.value === "partial"
                                        ? "partial"
                                        : "manual";
                                  setNodes((prev) =>
                                    prev.map((r) =>
                                      r.id === n.id ? { ...r, automation_status: nextStatus } : r,
                                    ),
                                  );
                                }}
                                className={cn(
                                  "h-9 rounded-lg border border-border bg-background/25 px-3 text-sm text-foreground",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                )}
                                disabled={isPending || !!insightsError}
                              >
                                <option value="automated">Automated</option>
                                <option value="partial">Partial</option>
                                <option value="manual">Manual</option>
                              </select>
                            </div>
                          </div>

                          <div className="mt-2 space-y-1">
                            <div className="text-[11px] font-medium text-muted-foreground">Notes</div>
                            <Textarea
                              value={n.notes}
                              onChange={(e) =>
                                setNodes((prev) =>
                                  prev.map((r) => (r.id === n.id ? { ...r, notes: e.target.value } : r)),
                                )
                              }
                              placeholder="Optional"
                              className="min-h-[80px]"
                              disabled={isPending || !!insightsError}
                            />
                          </div>

                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isPending || !!insightsError || idx === 0}
                                onClick={() =>
                                  setNodes((prev) => {
                                    const next = [...prev];
                                    const [item] = next.splice(idx, 1);
                                    next.splice(idx - 1, 0, item);
                                    return next;
                                  })
                                }
                              >
                                Move up
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isPending || !!insightsError || idx === nodes.length - 1}
                                onClick={() =>
                                  setNodes((prev) => {
                                    const next = [...prev];
                                    const [item] = next.splice(idx, 1);
                                    next.splice(idx + 1, 0, item);
                                    return next;
                                  })
                                }
                              >
                                Move down
                              </Button>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={isPending || !!insightsError}
                              onClick={() => {
                                const ok = window.confirm("Delete this node?");
                                if (!ok) return;
                                setNodes((prev) => prev.filter((r) => r.id !== n.id));
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
                      No nodes configured yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">Volume thresholds</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      What changes at each volume threshold.
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending || !!insightsError}
                    onClick={() =>
                      setThresholds((prev) => [
                        ...prev,
                        { id: newId(), label: "", changes: [""], implication: "" },
                      ])
                    }
                  >
                    Add threshold
                  </Button>
                </div>

                <div className="mt-4 space-y-3">
                  {thresholds.length ? (
                    thresholds.map((t, idx) => (
                      <div key={t.id} className="rounded-xl border border-border/60 bg-background/15 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-medium text-muted-foreground">Label</div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isPending || !!insightsError || idx === 0}
                              onClick={() =>
                                setThresholds((prev) => {
                                  const next = [...prev];
                                  const [item] = next.splice(idx, 1);
                                  next.splice(idx - 1, 0, item);
                                  return next;
                                })
                              }
                            >
                              Up
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isPending || !!insightsError || idx === thresholds.length - 1}
                              onClick={() =>
                                setThresholds((prev) => {
                                  const next = [...prev];
                                  const [item] = next.splice(idx, 1);
                                  next.splice(idx + 1, 0, item);
                                  return next;
                                })
                              }
                            >
                              Down
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={isPending || !!insightsError}
                              onClick={() => {
                                const ok = window.confirm("Delete this threshold?");
                                if (!ok) return;
                                setThresholds((prev) => prev.filter((r) => r.id !== t.id));
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>

                        <Input
                          value={t.label}
                          onChange={(e) =>
                            setThresholds((prev) =>
                              prev.map((r) => (r.id === t.id ? { ...r, label: e.target.value } : r)),
                            )
                          }
                          placeholder="e.g. 0–5k boxes/day"
                          disabled={isPending || !!insightsError}
                          className="mt-2"
                        />

                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-medium text-muted-foreground">Bullets</div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isPending || !!insightsError || t.changes.length >= 12}
                              onClick={() =>
                                setThresholds((prev) =>
                                  prev.map((r) => (r.id === t.id ? { ...r, changes: [...r.changes, ""] } : r)),
                                )
                              }
                            >
                              Add bullet
                            </Button>
                          </div>

                          <div className="space-y-2">
                            {t.changes.map((c, cIdx) => (
                              <div key={`${t.id}-c-${cIdx}`} className="grid gap-2 md:grid-cols-[1fr_auto]">
                                <Input
                                  value={c}
                                  onChange={(e) =>
                                    setThresholds((prev) =>
                                      prev.map((r) =>
                                        r.id === t.id
                                          ? {
                                              ...r,
                                              changes: r.changes.map((x, i) =>
                                                i === cIdx ? e.target.value : x,
                                              ),
                                            }
                                          : r,
                                      ),
                                    )
                                  }
                                  placeholder={`Bullet ${cIdx + 1}`}
                                  disabled={isPending || !!insightsError}
                                />
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={isPending || !!insightsError || cIdx === 0}
                                    onClick={() =>
                                      setThresholds((prev) =>
                                        prev.map((r) => {
                                          if (r.id !== t.id) return r;
                                          const next = [...r.changes];
                                          const [item] = next.splice(cIdx, 1);
                                          next.splice(cIdx - 1, 0, item);
                                          return { ...r, changes: next };
                                        }),
                                      )
                                    }
                                  >
                                    ↑
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={isPending || !!insightsError || cIdx === t.changes.length - 1}
                                    onClick={() =>
                                      setThresholds((prev) =>
                                        prev.map((r) => {
                                          if (r.id !== t.id) return r;
                                          const next = [...r.changes];
                                          const [item] = next.splice(cIdx, 1);
                                          next.splice(cIdx + 1, 0, item);
                                          return { ...r, changes: next };
                                        }),
                                      )
                                    }
                                  >
                                    ↓
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    disabled={isPending || !!insightsError || t.changes.length <= 1}
                                    onClick={() =>
                                      setThresholds((prev) =>
                                        prev.map((r) => {
                                          if (r.id !== t.id) return r;
                                          return { ...r, changes: r.changes.filter((_, i) => i !== cIdx) };
                                        }),
                                      )
                                    }
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-3 space-y-1">
                          <div className="text-xs font-medium text-muted-foreground">Operational implication (optional)</div>
                          <Textarea
                            value={t.implication}
                            onChange={(e) =>
                              setThresholds((prev) =>
                                prev.map((r) => (r.id === t.id ? { ...r, implication: e.target.value } : r)),
                              )
                            }
                            className="min-h-[80px]"
                            disabled={isPending || !!insightsError}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
                      No thresholds configured yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">Population coverage</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Sales enablement coverage claims.
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending || !!insightsError}
                    onClick={() =>
                      setClaims((prev) => [
                        ...prev,
                        {
                          id: newId(),
                          title: "",
                          statement: "",
                          service_level: "",
                          region: "",
                          injection: "",
                          limitations: "",
                        },
                      ])
                    }
                  >
                    Add claim
                  </Button>
                </div>

                <div className="mt-4 space-y-3">
                  {claims.length ? (
                    claims.map((c, idx) => (
                      <div key={c.id} className="rounded-xl border border-border/60 bg-background/15 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-medium text-muted-foreground">Claim</div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isPending || !!insightsError || idx === 0}
                              onClick={() =>
                                setClaims((prev) => {
                                  const next = [...prev];
                                  const [item] = next.splice(idx, 1);
                                  next.splice(idx - 1, 0, item);
                                  return next;
                                })
                              }
                            >
                              Up
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isPending || !!insightsError || idx === claims.length - 1}
                              onClick={() =>
                                setClaims((prev) => {
                                  const next = [...prev];
                                  const [item] = next.splice(idx, 1);
                                  next.splice(idx + 1, 0, item);
                                  return next;
                                })
                              }
                            >
                              Down
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={isPending || !!insightsError}
                              onClick={() => {
                                const ok = window.confirm("Delete this claim?");
                                if (!ok) return;
                                setClaims((prev) => prev.filter((r) => r.id !== c.id));
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>

                        <div className="mt-2 space-y-2">
                          <Input
                            value={c.title}
                            onChange={(e) =>
                              setClaims((prev) =>
                                prev.map((r) => (r.id === c.id ? { ...r, title: e.target.value } : r)),
                              )
                            }
                            placeholder="Title"
                            disabled={isPending || !!insightsError}
                          />
                          <Textarea
                            value={c.statement}
                            onChange={(e) =>
                              setClaims((prev) =>
                                prev.map((r) => (r.id === c.id ? { ...r, statement: e.target.value } : r)),
                              )
                            }
                            placeholder="Statement (1–3 sentences)"
                            className="min-h-[90px]"
                            disabled={isPending || !!insightsError}
                          />
                        </div>

                        <div className="mt-3 grid gap-2 md:grid-cols-3">
                          <Input
                            value={c.service_level}
                            onChange={(e) =>
                              setClaims((prev) =>
                                prev.map((r) => (r.id === c.id ? { ...r, service_level: e.target.value } : r)),
                              )
                            }
                            placeholder="Service level (optional)"
                            disabled={isPending || !!insightsError}
                          />
                          <Input
                            value={c.region}
                            onChange={(e) =>
                              setClaims((prev) =>
                                prev.map((r) => (r.id === c.id ? { ...r, region: e.target.value } : r)),
                              )
                            }
                            placeholder="Region (optional)"
                            disabled={isPending || !!insightsError}
                          />
                          <Input
                            value={c.injection}
                            onChange={(e) =>
                              setClaims((prev) =>
                                prev.map((r) => (r.id === c.id ? { ...r, injection: e.target.value } : r)),
                              )
                            }
                            placeholder="Injection (optional)"
                            disabled={isPending || !!insightsError}
                          />
                        </div>

                        <div className="mt-3 space-y-1">
                          <div className="text-xs font-medium text-muted-foreground">
                            Limitations / notes (optional)
                          </div>
                          <Textarea
                            value={c.limitations}
                            onChange={(e) =>
                              setClaims((prev) =>
                                prev.map((r) => (r.id === c.id ? { ...r, limitations: e.target.value } : r)),
                              )
                            }
                            className="min-h-[80px]"
                            disabled={isPending || !!insightsError}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
                      No claims configured yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">Cost scenarios</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Middle-mile and all-in costs per box.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isPending || !!insightsError}
                      onClick={() =>
                        setScenarios((prev) => [
                          ...prev,
                          {
                            id: newId(),
                            name: "",
                            truck_utilization_pct: "",
                            middle_mile_cost_per_box: "",
                            all_in_cost_per_box: "",
                            last_mile_cost_per_box: "",
                            first_mile_cost_per_box: "",
                            hub_sort_cost_per_box: "",
                            spoke_sort_cost_per_box: "",
                            dispatch_cost_per_box: "",
                            notes: "",
                          },
                        ])
                      }
                    >
                      Add
                    </Button>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {scenarios.length ? (
                    scenarios.map((s, idx) => (
                      <div key={s.id} className="rounded-xl border border-border/60 bg-background/15 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-medium text-muted-foreground">Scenario</div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isPending || !!insightsError}
                              onClick={() =>
                                setScenarios((prev) => [
                                  ...prev,
                                  {
                                    ...s,
                                    id: newId(),
                                    name: s.name ? `${s.name} (copy)` : "",
                                  },
                                ])
                              }
                            >
                              Duplicate
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={isPending || !!insightsError}
                              onClick={() => {
                                const ok = window.confirm("Delete this scenario?");
                                if (!ok) return;
                                setScenarios((prev) => prev.filter((r) => r.id !== s.id));
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>

                        <Input
                          value={s.name}
                          onChange={(e) =>
                            setScenarios((prev) =>
                              prev.map((r) => (r.id === s.id ? { ...r, name: e.target.value } : r)),
                            )
                          }
                          placeholder="Scenario name"
                          disabled={isPending || !!insightsError}
                          className="mt-2"
                        />

                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          <Input
                            value={s.truck_utilization_pct}
                            onChange={(e) =>
                              setScenarios((prev) =>
                                prev.map((r) =>
                                  r.id === s.id ? { ...r, truck_utilization_pct: e.target.value } : r,
                                ),
                              )
                            }
                            placeholder="Utilization % (optional)"
                            inputMode="decimal"
                            disabled={isPending || !!insightsError}
                          />
                          <Input
                            value={s.middle_mile_cost_per_box}
                            onChange={(e) =>
                              setScenarios((prev) =>
                                prev.map((r) =>
                                  r.id === s.id ? { ...r, middle_mile_cost_per_box: e.target.value } : r,
                                ),
                              )
                            }
                            placeholder="Middle mile $/box (optional)"
                            inputMode="decimal"
                            disabled={isPending || !!insightsError}
                          />
                          <Input
                            value={s.all_in_cost_per_box}
                            onChange={(e) =>
                              setScenarios((prev) =>
                                prev.map((r) =>
                                  r.id === s.id ? { ...r, all_in_cost_per_box: e.target.value } : r,
                                ),
                              )
                            }
                            placeholder="All-in $/box (optional)"
                            inputMode="decimal"
                            disabled={isPending || !!insightsError}
                          />
                          <Input
                            value={s.last_mile_cost_per_box}
                            onChange={(e) =>
                              setScenarios((prev) =>
                                prev.map((r) =>
                                  r.id === s.id ? { ...r, last_mile_cost_per_box: e.target.value } : r,
                                ),
                              )
                            }
                            placeholder="Last mile $/box (optional)"
                            inputMode="decimal"
                            disabled={isPending || !!insightsError}
                          />
                          <Input
                            value={s.first_mile_cost_per_box}
                            onChange={(e) =>
                              setScenarios((prev) =>
                                prev.map((r) =>
                                  r.id === s.id ? { ...r, first_mile_cost_per_box: e.target.value } : r,
                                ),
                              )
                            }
                            placeholder="First mile $/box (optional)"
                            inputMode="decimal"
                            disabled={isPending || !!insightsError}
                          />
                          <Input
                            value={s.hub_sort_cost_per_box}
                            onChange={(e) =>
                              setScenarios((prev) =>
                                prev.map((r) =>
                                  r.id === s.id ? { ...r, hub_sort_cost_per_box: e.target.value } : r,
                                ),
                              )
                            }
                            placeholder="Hub sort $/box (optional)"
                            inputMode="decimal"
                            disabled={isPending || !!insightsError}
                          />
                          <Input
                            value={s.spoke_sort_cost_per_box}
                            onChange={(e) =>
                              setScenarios((prev) =>
                                prev.map((r) =>
                                  r.id === s.id ? { ...r, spoke_sort_cost_per_box: e.target.value } : r,
                                ),
                              )
                            }
                            placeholder="Spoke sort $/box (optional)"
                            inputMode="decimal"
                            disabled={isPending || !!insightsError}
                          />
                          <Input
                            value={s.dispatch_cost_per_box}
                            onChange={(e) =>
                              setScenarios((prev) =>
                                prev.map((r) =>
                                  r.id === s.id ? { ...r, dispatch_cost_per_box: e.target.value } : r,
                                ),
                              )
                            }
                            placeholder="Dispatch $/box (optional)"
                            inputMode="decimal"
                            disabled={isPending || !!insightsError}
                          />
                        </div>

                        <div className="mt-3 space-y-1">
                          <div className="text-xs font-medium text-muted-foreground">Notes (optional)</div>
                          <Textarea
                            value={s.notes}
                            onChange={(e) =>
                              setScenarios((prev) =>
                                prev.map((r) => (r.id === s.id ? { ...r, notes: e.target.value } : r)),
                              )
                            }
                            className="min-h-[80px]"
                            disabled={isPending || !!insightsError}
                          />
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isPending || !!insightsError || idx === 0}
                            onClick={() =>
                              setScenarios((prev) => {
                                const next = [...prev];
                                const [item] = next.splice(idx, 1);
                                next.splice(idx - 1, 0, item);
                                return next;
                              })
                            }
                          >
                            Move up
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isPending || !!insightsError || idx === scenarios.length - 1}
                            onClick={() =>
                              setScenarios((prev) => {
                                const next = [...prev];
                                const [item] = next.splice(idx, 1);
                                next.splice(idx + 1, 0, item);
                                return next;
                              })
                            }
                          >
                            Move down
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
                      No scenarios configured yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <div className="text-xs text-muted-foreground">
            {dirty ? "Unsaved changes" : "No pending changes"}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" disabled={isPending} onClick={revertLocal}>
              Cancel
            </Button>
            <Button type="button" disabled={isPending} onClick={save}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
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

      <Dialog open={!!pendingNav} onOpenChange={(open) => (!open ? setPendingNav(null) : null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Switching views will discard them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingNav(null)}>
              Keep editing
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const next = pendingNav;
                setPendingNav(null);
                if (!next) return;
                setSub(next.sub);
                setVariant(next.variant);
              }}
            >
              Discard & switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conflict detected</DialogTitle>
            <DialogDescription>
              This content was updated by someone else. Reload to avoid overwriting their changes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConflictOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                window.location.reload();
              }}
            >
              Reload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentPanel>
  );
}
