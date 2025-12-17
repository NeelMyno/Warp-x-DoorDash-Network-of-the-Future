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

export type SignedAsset = {
  assetId: string | null;
  url: string | null;
  path: string | null;
  expiresAt: string | null;
};

export type NetworkEnhancementsView = {
  id: string;
  sub: NetworkEnhancementsSub;
  variant: NetworkEnhancementsVariant;
  diagram: SignedAsset;
  pdf: SignedAsset;
  diagramTitle: string | null;
  diagramAlt: string | null;
  diagramCaption: string | null;
  pdfTitle: string | null;
  pdfCaption: string | null;
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
  const expiresInSeconds = 3600;

  const query = supabase
    .from("network_enhancements_views")
    .select(
      "id, sub, variant, diagram_asset_id, pdf_asset_id, diagram_title, diagram_alt, diagram_caption, pdf_title, pdf_caption, network_highlights_md, network_thresholds, network_coverage_md, network_cost_model, updated_at",
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
    getSignedAssetUrl({
      assetId: diagramAssetId ?? undefined,
      expiresIn: expiresInSeconds,
      supabase,
    }),
    getSignedAssetUrl({
      assetId: pdfAssetId ?? undefined,
      expiresIn: expiresInSeconds,
      supabase,
    }),
  ]);

  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  return {
    id: String(data.id),
    sub: input.sub,
    variant: input.variant,
    diagram: {
      assetId: diagramAssetId,
      url: diagram.url,
      path: diagram.path,
      expiresAt: diagram.url ? expiresAt : null,
    },
    pdf: {
      assetId: pdfAssetId,
      url: pdf.url,
      path: pdf.path,
      expiresAt: pdf.url ? expiresAt : null,
    },
    diagramTitle: typeof data.diagram_title === "string" ? data.diagram_title : null,
    diagramAlt: typeof data.diagram_alt === "string" ? data.diagram_alt : null,
    diagramCaption:
      typeof data.diagram_caption === "string" ? data.diagram_caption : null,
    pdfTitle: typeof data.pdf_title === "string" ? data.pdf_title : null,
    pdfCaption: typeof data.pdf_caption === "string" ? data.pdf_caption : null,
    networkHighlightsMd:
      typeof data.network_highlights_md === "string" ? data.network_highlights_md : null,
    networkCoverageMd:
      typeof data.network_coverage_md === "string" ? data.network_coverage_md : null,
    networkThresholds: parseNetworkThresholds(data.network_thresholds),
    networkCostModel: parseNetworkCostModel(data.network_cost_model),
    updatedAt: String(data.updated_at),
  };
}
