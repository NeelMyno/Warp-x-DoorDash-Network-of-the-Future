import { createClient } from "@/lib/supabase/server";
import {
  NetworkInsightsSchema,
  type AutomationNode,
  type CoverageClaim,
  type CostScenario,
  type NetworkInsights,
  type VolumeThreshold,
} from "@/lib/network-enhancements/insights-schema";

function asUuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function maxUpdatedAt(rows: Array<{ updated_at: string }>) {
  if (!rows.length) return null;
  let best = rows[0]?.updated_at ?? null;
  for (const row of rows) {
    if (!best || row.updated_at > best) best = row.updated_at;
  }
  return best;
}

export async function getNetworkEnhancementsInsights(input: {
  viewId: string;
  supabase?: Awaited<ReturnType<typeof createClient>>;
}): Promise<{ ok: true; insights: NetworkInsights } | { ok: false; error: string }> {
  const viewId = asUuid(input.viewId);
  if (!viewId) return { ok: false, error: "Invalid viewId." };

  const supabase = input.supabase ?? (await createClient());

  try {
    const [nodesRes, thresholdsRes, claimsRes, costRes] = await Promise.all([
      supabase
        .from("network_enhancements_automation_nodes")
        .select(
          "id, node_type, name, market, region, automation_status, notes, sort_order, updated_at",
        )
        .eq("view_id", viewId)
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false }),
      supabase
        .from("network_enhancements_volume_thresholds")
        .select("id, label, changes, implication, sort_order, updated_at")
        .eq("view_id", viewId)
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false }),
      supabase
        .from("network_enhancements_coverage_claims")
        .select(
          "id, title, statement, service_level, region, injection, limitations, sort_order, updated_at",
        )
        .eq("view_id", viewId)
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false }),
      supabase
        .from("network_enhancements_cost_scenarios")
        .select(
          "id, name, truck_utilization_pct, middle_mile_cost_per_box, all_in_cost_per_box, last_mile_cost_per_box, first_mile_cost_per_box, hub_sort_cost_per_box, spoke_sort_cost_per_box, dispatch_cost_per_box, notes, sort_order, updated_at",
        )
        .eq("view_id", viewId)
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false }),
    ]);

    const firstError =
      nodesRes.error ?? thresholdsRes.error ?? claimsRes.error ?? costRes.error;
    if (firstError) {
      console.error("[network-enhancements] insights query error:", firstError);
      return {
        ok: false,
        error: "Unable to load Network insights. Run `supabase/sql/11_network_enhancements_insights.sql`.",
      };
    }

    const rawNodes = (nodesRes.data ?? []) as unknown as Array<Record<string, unknown>>;
    const automationNodes: AutomationNode[] = rawNodes.map((row) => ({
      id: typeof row.id === "string" ? row.id : "",
      node_type: row.node_type as AutomationNode["node_type"],
      name: typeof row.name === "string" ? row.name : "",
      market: typeof row.market === "string" ? row.market : null,
      region: typeof row.region === "string" ? row.region : null,
      automation_status: row.automation_status as AutomationNode["automation_status"],
      notes: typeof row.notes === "string" ? row.notes : null,
      sort_order: typeof row.sort_order === "number" ? row.sort_order : Number(row.sort_order ?? 0),
      updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
    }));

    const rawThresholds = (thresholdsRes.data ?? []) as unknown as Array<Record<string, unknown>>;
    const volumeThresholds: VolumeThreshold[] = rawThresholds.map((row) => ({
      id: typeof row.id === "string" ? row.id : "",
      label: typeof row.label === "string" ? row.label : "",
      changes: Array.isArray(row.changes)
        ? row.changes
            .filter((value: unknown): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter(Boolean)
        : [],
      implication: typeof row.implication === "string" ? row.implication : null,
      sort_order: typeof row.sort_order === "number" ? row.sort_order : Number(row.sort_order ?? 0),
      updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
    }));

    const rawClaims = (claimsRes.data ?? []) as unknown as Array<Record<string, unknown>>;
    const coverageClaims: CoverageClaim[] = rawClaims.map((row) => ({
      id: typeof row.id === "string" ? row.id : "",
      title: typeof row.title === "string" ? row.title : "",
      statement: typeof row.statement === "string" ? row.statement : "",
      service_level: typeof row.service_level === "string" ? row.service_level : null,
      region: typeof row.region === "string" ? row.region : null,
      injection: typeof row.injection === "string" ? row.injection : null,
      limitations: typeof row.limitations === "string" ? row.limitations : null,
      sort_order: typeof row.sort_order === "number" ? row.sort_order : Number(row.sort_order ?? 0),
      updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
    }));

    const rawCosts = (costRes.data ?? []) as unknown as Array<Record<string, unknown>>;
    const costScenarios: CostScenario[] = rawCosts.map((row) => ({
      id: typeof row.id === "string" ? row.id : "",
      name: typeof row.name === "string" ? row.name : "",
      truck_utilization_pct: toNumberOrNull(row.truck_utilization_pct),
      middle_mile_cost_per_box: toNumberOrNull(row.middle_mile_cost_per_box),
      all_in_cost_per_box: toNumberOrNull(row.all_in_cost_per_box),
      last_mile_cost_per_box: toNumberOrNull(row.last_mile_cost_per_box),
      first_mile_cost_per_box: toNumberOrNull(row.first_mile_cost_per_box),
      hub_sort_cost_per_box: toNumberOrNull(row.hub_sort_cost_per_box),
      spoke_sort_cost_per_box: toNumberOrNull(row.spoke_sort_cost_per_box),
      dispatch_cost_per_box: toNumberOrNull(row.dispatch_cost_per_box),
      notes: typeof row.notes === "string" ? row.notes : null,
      sort_order: typeof row.sort_order === "number" ? row.sort_order : Number(row.sort_order ?? 0),
      updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
    }));

    const candidate: NetworkInsights = {
      automationNodes,
      volumeThresholds,
      coverageClaims,
      costScenarios,
      updatedAt: {
        automationCoverage: maxUpdatedAt(automationNodes),
        volumeThresholds: maxUpdatedAt(volumeThresholds),
        populationCoverage: maxUpdatedAt(coverageClaims),
        costModeling: maxUpdatedAt(costScenarios),
      },
    };

    const parsed = NetworkInsightsSchema.safeParse(candidate);
    if (!parsed.success) {
      console.error("[network-enhancements] insights validation error:", parsed.error);
      return { ok: false, error: "Insights data is invalid. Ask an admin to review." };
    }

    return { ok: true, insights: parsed.data };
  } catch (err) {
    console.error("[network-enhancements] insights unexpected error:", err);
    return { ok: false, error: "Unable to load insights." };
  }
}
