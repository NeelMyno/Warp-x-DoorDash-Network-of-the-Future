"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-user";
import {
  AutomationNodeTypeSchema,
  AutomationStatusSchema,
} from "@/lib/network-enhancements/insights-schema";

const AutomationNodeInputSchema = z.object({
  id: z.string().uuid(),
  node_type: AutomationNodeTypeSchema,
  name: z.string().trim().min(1).max(120),
  market: z.string().trim().max(120).nullable().optional(),
  region: z.string().trim().max(120).nullable().optional(),
  automation_status: AutomationStatusSchema,
  notes: z.string().trim().max(4000).nullable().optional(),
});

const VolumeThresholdInputSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(120),
  changes: z.array(z.string().trim().min(1).max(220)).min(1).max(12),
  implication: z.string().trim().max(800).nullable().optional(),
});

const CoverageClaimInputSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  statement: z.string().trim().min(1).max(2000),
  service_level: z.string().trim().max(80).nullable().optional(),
  region: z.string().trim().max(120).nullable().optional(),
  injection: z.string().trim().max(120).nullable().optional(),
  limitations: z.string().trim().max(2000).nullable().optional(),
});

const CostScenarioInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  truck_utilization_pct: z.number().finite().min(0).max(100).nullable().optional(),
  middle_mile_cost_per_box: z.number().finite().min(0).nullable().optional(),
  all_in_cost_per_box: z.number().finite().min(0).nullable().optional(),
  last_mile_cost_per_box: z.number().finite().min(0).nullable().optional(),
  first_mile_cost_per_box: z.number().finite().min(0).nullable().optional(),
  hub_sort_cost_per_box: z.number().finite().min(0).nullable().optional(),
  spoke_sort_cost_per_box: z.number().finite().min(0).nullable().optional(),
  dispatch_cost_per_box: z.number().finite().min(0).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const InsightsInputSchema = z.object({
  automationNodes: z.array(AutomationNodeInputSchema).max(500).default([]),
  volumeThresholds: z.array(VolumeThresholdInputSchema).max(200).default([]),
  coverageClaims: z.array(CoverageClaimInputSchema).max(200).default([]),
  costScenarios: z.array(CostScenarioInputSchema).max(200).default([]),
});

const SubSchema = z.enum(["hub", "spoke", "network"]);
const VariantSchema = z.enum(["example", "future"]);

const SaveSchema = z
  .object({
    sub: SubSchema,
    variant: VariantSchema.nullable(),
    diagramAssetId: z.string().uuid().nullable(),
    pdfAssetId: z.string().uuid().nullable(),
    diagramTitle: z.string().max(160).nullable().optional(),
    diagramAlt: z.string().max(240).nullable().optional(),
    diagramCaption: z.string().max(800).nullable().optional(),
    pdfTitle: z.string().max(160).nullable().optional(),
    pdfCaption: z.string().max(800).nullable().optional(),
    expectedUpdatedAt: z.string().nullable().optional(),
    insights: InsightsInputSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.sub === "network" && value.variant !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Network view must not have a variant.",
        path: ["variant"],
      });
    }
    if ((value.sub === "hub" || value.sub === "spoke") && value.variant === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Hub/Spoke views require a variant.",
        path: ["variant"],
      });
    }

    if (value.diagramAssetId && !value.diagramAlt?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Diagram alt text is required when a diagram is selected.",
        path: ["diagramAlt"],
      });
    }

    if (value.sub !== "network" && value.insights) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Insights are only supported on the Network view.",
        path: ["insights"],
      });
    }
  });

type ActionResult =
  | { ok: true; updatedAt: string }
  | { ok: false; error: string };

type IdRow = { id?: unknown };
function getRowId(row: unknown): string | null {
  if (!row || typeof row !== "object") return null;
  if (!("id" in row)) return null;
  const id = (row as IdRow).id;
  return typeof id === "string" ? id : null;
}

export async function saveNetworkEnhancementsViewAction(
  input: unknown,
): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();

  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const value = parsed.data;

  const baseQuery = supabase
    .from("network_enhancements_views")
    .select("id, updated_at")
    .eq("sub", value.sub);

  const { data: existing } =
    value.variant === null
      ? await baseQuery.is("variant", null).order("updated_at", { ascending: false }).limit(1).maybeSingle()
      : await baseQuery.eq("variant", value.variant).limit(1).maybeSingle();

  const expectedUpdatedAt = value.expectedUpdatedAt?.trim() ? value.expectedUpdatedAt.trim() : null;

  const updatePayload: Record<string, unknown> = {
    diagram_asset_id: value.diagramAssetId,
    pdf_asset_id: value.pdfAssetId,
    diagram_title: value.diagramTitle?.trim() || null,
    diagram_alt: value.diagramAlt?.trim() || null,
    diagram_caption: value.diagramCaption?.trim() || null,
    pdf_title: value.pdfTitle?.trim() || null,
    pdf_caption: value.pdfCaption?.trim() || null,
    updated_by: user.id,
  };

  // Legacy JSON fields are deprecated in favor of structured insights tables.
  updatePayload.network_highlights_md = null;
  updatePayload.network_thresholds = null;
  updatePayload.network_coverage_md = null;
  updatePayload.network_cost_model = null;

  async function validateAssetType(assetId: string, kind: "diagram" | "pdf") {
    const { data, error } = await supabase
      .from("assets")
      .select("content_type")
      .eq("id", assetId)
      .maybeSingle();

    if (error) return { ok: false as const, error: "Unable to validate selected asset." };
    const contentType = typeof data?.content_type === "string" ? data.content_type : null;

    if (kind === "diagram") {
      if (!contentType || !contentType.startsWith("image/")) {
        return { ok: false as const, error: "Diagram asset must be an image." };
      }
    } else {
      if (!contentType || !contentType.toLowerCase().startsWith("application/pdf")) {
        return { ok: false as const, error: "PDF asset must be a PDF." };
      }
    }
    return { ok: true as const };
  }

  if (value.diagramAssetId) {
    const check = await validateAssetType(value.diagramAssetId, "diagram");
    if (!check.ok) return { ok: false, error: check.error };
  }
  if (value.pdfAssetId) {
    const check = await validateAssetType(value.pdfAssetId, "pdf");
    if (!check.ok) return { ok: false, error: check.error };
  }

  const updateQuery = existing?.id
    ? supabase
        .from("network_enhancements_views")
        .update(updatePayload)
        .eq("id", existing.id)
        .select("id, updated_at")
    : supabase
        .from("network_enhancements_views")
        .insert({
          sub: value.sub,
          variant: value.variant,
          ...updatePayload,
        })
        .select("id, updated_at");

  const { data, error } = existing?.id
    ? expectedUpdatedAt
      ? await updateQuery.eq("updated_at", expectedUpdatedAt).single()
      : await updateQuery.single()
    : await supabase
        .from("network_enhancements_views")
        .insert({
          sub: value.sub,
          variant: value.variant,
          ...updatePayload,
        })
        .select("id, updated_at")
        .single();

  if (existing?.id && expectedUpdatedAt && error && error.code === "PGRST116") {
    return {
      ok: false,
      error: "This content was updated by someone else. Reload to avoid overwriting.",
    };
  }

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to save changes." };
  }

  const viewId = getRowId(data) ?? existing?.id ?? "";

  if (value.sub === "network" && value.insights) {
    const insights = value.insights;

    const upsertTable = async (
      table: string,
      rows: Array<Record<string, unknown>>,
      idList: string[],
    ) => {
      if (rows.length) {
        const { error: upsertError } = await supabase.from(table).upsert(rows, { onConflict: "id" });
        if (upsertError) throw upsertError;
      }
      if (idList.length) {
        const inList = `(${idList.map((id) => `"${id}"`).join(",")})`;
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq("view_id", viewId)
          .not("id", "in", inList);
        if (deleteError) throw deleteError;
      } else {
        const { error: deleteAllError } = await supabase.from(table).delete().eq("view_id", viewId);
        if (deleteAllError) throw deleteAllError;
      }
    };

    try {
      const automationRows = insights.automationNodes.map((n, idx) => ({
        id: n.id,
        view_id: viewId,
        node_type: n.node_type,
        name: n.name,
        market: n.market ?? null,
        region: n.region ?? null,
        automation_status: n.automation_status,
        notes: n.notes ?? null,
        sort_order: idx,
      }));
      const thresholdRows = insights.volumeThresholds.map((t, idx) => ({
        id: t.id,
        view_id: viewId,
        label: t.label,
        changes: t.changes,
        implication: t.implication ?? null,
        sort_order: idx,
      }));
      const claimRows = insights.coverageClaims.map((c, idx) => ({
        id: c.id,
        view_id: viewId,
        title: c.title,
        statement: c.statement,
        service_level: c.service_level ?? null,
        region: c.region ?? null,
        injection: c.injection ?? null,
        limitations: c.limitations ?? null,
        sort_order: idx,
      }));
      const scenarioRows = insights.costScenarios.map((s, idx) => ({
        id: s.id,
        view_id: viewId,
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
      }));

      await upsertTable(
        "network_enhancements_automation_nodes",
        automationRows,
        automationRows.map((r) => r.id),
      );
      await upsertTable(
        "network_enhancements_volume_thresholds",
        thresholdRows,
        thresholdRows.map((r) => r.id),
      );
      await upsertTable(
        "network_enhancements_coverage_claims",
        claimRows,
        claimRows.map((r) => r.id),
      );
      await upsertTable(
        "network_enhancements_cost_scenarios",
        scenarioRows,
        scenarioRows.map((r) => r.id),
      );
    } catch (insightsError) {
      console.error("[network-enhancements] failed saving insights:", insightsError);
      return { ok: false, error: "Saved assets, but failed to save insights. Please retry." };
    }
  }

  revalidatePath("/admin");
  revalidatePath("/m/network-enhancements");

  return { ok: true, updatedAt: String(data.updated_at) };
}
