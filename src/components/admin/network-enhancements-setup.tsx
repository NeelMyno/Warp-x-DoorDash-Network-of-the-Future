import { createClient } from "@/lib/supabase/server";
import { getNetworkEnhancementsInsights } from "@/lib/network-enhancements/get-insights";
import {
  parseNetworkCostModel,
  parseNetworkThresholds,
  type NetworkCostModel,
  type NetworkThresholds,
} from "@/lib/network-enhancements/schema";
import type { NetworkInsights } from "@/lib/network-enhancements/insights-schema";
import { ContentPanel } from "@/components/panels/ContentPanel";
import { NetworkEnhancementsEditor } from "@/components/admin/network-enhancements/NetworkEnhancementsEditor";

export type NetworkEnhancementsAdminRow = {
  id: string;
  sub: "hub" | "spoke" | "network";
  variant: "example" | "future" | null;
  diagramAssetId: string | null;
  diagramFilename: string | null;
  pdfAssetId: string | null;
  pdfFilename: string | null;
  diagramTitle: string | null;
  diagramAlt: string | null;
  diagramCaption: string | null;
  pdfTitle: string | null;
  pdfCaption: string | null;
  networkHighlightsMd: string | null;
  networkCoverageMd: string | null;
  networkThresholds: NetworkThresholds | null;
  networkCostModel: NetworkCostModel | null;
  thresholdsInvalid: boolean;
  costModelInvalid: boolean;
  updatedAt: string;
};

function assetFilenameById(
  id: string | null,
  map: Map<string, { filename: string | null }>,
) {
  if (!id) return null;
  return map.get(id)?.filename ?? null;
}

export async function NetworkEnhancementsSetupSection() {
  const supabase = await createClient();

  type Row = {
    id: string;
    sub: string;
    variant: string | null;
    diagram_asset_id: string | null;
    pdf_asset_id: string | null;
    diagram_title?: string | null;
    diagram_alt?: string | null;
    diagram_caption?: string | null;
    pdf_title?: string | null;
    pdf_caption?: string | null;
    network_highlights_md: string | null;
    network_thresholds: unknown;
    network_coverage_md: string | null;
    network_cost_model: unknown;
    updated_at: string;
  };

  let available = true;
  let errorMessage: string | null = null;
  let rows: Row[] = [];

  try {
    const { data, error } = await supabase
      .from("network_enhancements_views")
      .select(
        "id, sub, variant, diagram_asset_id, pdf_asset_id, diagram_title, diagram_alt, diagram_caption, pdf_title, pdf_caption, network_highlights_md, network_thresholds, network_coverage_md, network_cost_model, updated_at",
      );

    if (error) {
      available = false;
      errorMessage = error.message;
    } else {
      rows = (data ?? []) as Row[];
    }
  } catch (err) {
    available = false;
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  if (!available) {
    return (
      <ContentPanel
        title="Network enhancements"
        description="Run the migration to enable admin editing for Hub/Spoke/Network artifacts."
      >
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="rounded-xl border border-border bg-muted/25 px-3 py-2 font-mono text-xs text-foreground">
            supabase/sql/09_network_enhancements.sql
          </div>
          {errorMessage ? (
            <div className="text-xs text-muted-foreground">
              Error: <span className="font-mono text-foreground">{errorMessage}</span>
            </div>
          ) : null}
        </div>
      </ContentPanel>
    );
  }

  const assetIds = Array.from(
    new Set(
      rows
        .flatMap((r) => [r.diagram_asset_id, r.pdf_asset_id])
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );

  const assetMap = new Map<string, { filename: string | null }>();
  if (assetIds.length) {
    try {
      const { data } = await supabase
        .from("assets")
        .select("id, filename, content_type")
        .in("id", assetIds);
      for (const row of (data ?? []) as Array<{ id: string; filename: string; content_type?: string | null }>) {
        assetMap.set(row.id, { filename: row.filename ?? null });
      }
    } catch {
      // ignore filename lookup failures
    }
  }

  let networkInsights: NetworkInsights | null = null;
  let insightsError: string | null = null;
  const networkViewRow = rows.find((r) => r.sub === "network") ?? null;
  if (networkViewRow?.id) {
    const result = await getNetworkEnhancementsInsights({ viewId: String(networkViewRow.id), supabase });
    if (result.ok) networkInsights = result.insights;
    else insightsError = result.error;
  }

  const normalized: NetworkEnhancementsAdminRow[] = rows
    .map((r) => {
      const thresholdsParsed = parseNetworkThresholds(r.network_thresholds);
      const costParsed = parseNetworkCostModel(r.network_cost_model);

      return {
        id: String(r.id),
        sub: r.sub === "spoke" ? "spoke" : r.sub === "network" ? "network" : "hub",
        variant:
          r.variant === "future" ? "future" : r.variant === "example" ? "example" : null,
        diagramAssetId: typeof r.diagram_asset_id === "string" ? r.diagram_asset_id : null,
        diagramFilename: assetFilenameById(r.diagram_asset_id, assetMap),
        pdfAssetId: typeof r.pdf_asset_id === "string" ? r.pdf_asset_id : null,
        pdfFilename: assetFilenameById(r.pdf_asset_id, assetMap),
        diagramTitle: typeof r.diagram_title === "string" ? r.diagram_title : null,
        diagramAlt: typeof r.diagram_alt === "string" ? r.diagram_alt : null,
        diagramCaption: typeof r.diagram_caption === "string" ? r.diagram_caption : null,
        pdfTitle: typeof r.pdf_title === "string" ? r.pdf_title : null,
        pdfCaption: typeof r.pdf_caption === "string" ? r.pdf_caption : null,
        networkHighlightsMd:
          typeof r.network_highlights_md === "string" ? r.network_highlights_md : null,
        networkCoverageMd:
          typeof r.network_coverage_md === "string" ? r.network_coverage_md : null,
        networkThresholds: thresholdsParsed,
        networkCostModel: costParsed,
        thresholdsInvalid: r.network_thresholds != null && !thresholdsParsed,
        costModelInvalid: r.network_cost_model != null && !costParsed,
        updatedAt: String(r.updated_at),
      } satisfies NetworkEnhancementsAdminRow;
    })
    .sort((a, b) => {
      const order = { hub: 0, spoke: 1, network: 2 } as const;
      const bySub = order[a.sub] - order[b.sub];
      if (bySub !== 0) return bySub;
      const av = a.variant ?? "";
      const bv = b.variant ?? "";
      return av.localeCompare(bv);
    });

  return (
    <NetworkEnhancementsEditor
      initialRows={normalized}
      initialNetworkInsights={networkInsights}
      insightsError={insightsError}
    />
  );
}
