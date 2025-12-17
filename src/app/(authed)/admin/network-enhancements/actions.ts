"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-user";
import {
  NetworkCostModelSchema,
  NetworkThresholdsSchema,
} from "@/lib/network-enhancements/schema";

const SubSchema = z.enum(["hub", "spoke", "network"]);
const VariantSchema = z.enum(["example", "future"]);

const SaveSchema = z
  .object({
    sub: SubSchema,
    variant: VariantSchema.nullable(),
    diagramAssetId: z.string().uuid().nullable(),
    pdfAssetId: z.string().uuid().nullable(),
    networkHighlightsMd: z.string().max(20_000).nullable(),
    networkThresholds: NetworkThresholdsSchema.nullable(),
    networkCoverageMd: z.string().max(20_000).nullable(),
    networkCostModel: NetworkCostModelSchema.nullable(),
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
  });

type ActionResult =
  | { ok: true; updatedAt: string }
  | { ok: false; error: string };

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
    .select("id")
    .eq("sub", value.sub);

  const { data: existing } =
    value.variant === null
      ? await baseQuery.is("variant", null).order("updated_at", { ascending: false }).limit(1).maybeSingle()
      : await baseQuery.eq("variant", value.variant).limit(1).maybeSingle();

  const updatePayload: Record<string, unknown> = {
    diagram_asset_id: value.diagramAssetId,
    pdf_asset_id: value.pdfAssetId,
    updated_by: user.id,
  };

  if (value.sub === "network") {
    updatePayload.network_highlights_md = value.networkHighlightsMd?.trim() || null;
    updatePayload.network_thresholds = value.networkThresholds;
    updatePayload.network_coverage_md = value.networkCoverageMd?.trim() || null;
    updatePayload.network_cost_model = value.networkCostModel;
  } else {
    updatePayload.network_highlights_md = null;
    updatePayload.network_thresholds = null;
    updatePayload.network_coverage_md = null;
    updatePayload.network_cost_model = null;
  }

  const { data, error } = existing?.id
    ? await supabase
        .from("network_enhancements_views")
        .update(updatePayload)
        .eq("id", existing.id)
        .select("updated_at")
        .single()
    : await supabase
        .from("network_enhancements_views")
        .insert({
          sub: value.sub,
          variant: value.variant,
          ...updatePayload,
        })
        .select("updated_at")
        .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to save changes." };
  }

  revalidatePath("/admin");
  revalidatePath("/m/network-enhancements");

  return { ok: true, updatedAt: String(data.updated_at) };
}

