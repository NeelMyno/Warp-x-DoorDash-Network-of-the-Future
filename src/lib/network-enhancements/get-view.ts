import { createClient } from "@/lib/supabase/server";
import { getSignedAssetUrl } from "@/lib/assets/get-signed-url";
import {
  parseNetworkCostModel,
  parseNetworkThresholds,
  type NetworkCostModel,
  type NetworkThresholds,
} from "@/lib/network-enhancements/schema";

export type NetworkEnhancementsSub = "hub" | "spoke" | "network";
export type NetworkEnhancementsVariant = "example" | "future" | null;

export type NetworkEnhancementsView = {
  id: string;
  sub: NetworkEnhancementsSub;
  variant: NetworkEnhancementsVariant;
  diagram: { assetId: string | null; url: string | null; path: string | null };
  pdf: { assetId: string | null; url: string | null; path: string | null };
  networkHighlightsMd: string | null;
  networkCoverageMd: string | null;
  networkThresholds: NetworkThresholds | null;
  networkCostModel: NetworkCostModel | null;
  updatedAt: string;
};

export async function getNetworkEnhancementsView(input: {
  sub: NetworkEnhancementsSub;
  variant: NetworkEnhancementsVariant;
  supabase?: Awaited<ReturnType<typeof createClient>>;
}): Promise<NetworkEnhancementsView | null> {
  const supabase = input.supabase ?? (await createClient());

  const query = supabase
    .from("network_enhancements_views")
    .select(
      "id, sub, variant, diagram_asset_id, pdf_asset_id, network_highlights_md, network_thresholds, network_coverage_md, network_cost_model, updated_at",
    )
    .eq("sub", input.sub);

  const { data, error } =
    input.variant === null
      ? await query
          .is("variant", null)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : await query
          .eq("variant", input.variant)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

  if (error || !data) return null;

  const diagramAssetId =
    typeof data.diagram_asset_id === "string" ? data.diagram_asset_id : null;
  const pdfAssetId = typeof data.pdf_asset_id === "string" ? data.pdf_asset_id : null;

  const [diagram, pdf] = await Promise.all([
    getSignedAssetUrl({ assetId: diagramAssetId ?? undefined, expiresIn: 3600, supabase }),
    getSignedAssetUrl({ assetId: pdfAssetId ?? undefined, expiresIn: 3600, supabase }),
  ]);

  return {
    id: String(data.id),
    sub: input.sub,
    variant: input.variant,
    diagram: { assetId: diagramAssetId, url: diagram.url, path: diagram.path },
    pdf: { assetId: pdfAssetId, url: pdf.url, path: pdf.path },
    networkHighlightsMd:
      typeof data.network_highlights_md === "string" ? data.network_highlights_md : null,
    networkCoverageMd:
      typeof data.network_coverage_md === "string" ? data.network_coverage_md : null,
    networkThresholds: parseNetworkThresholds(data.network_thresholds),
    networkCostModel: parseNetworkCostModel(data.network_cost_model),
    updatedAt: String(data.updated_at),
  };
}
