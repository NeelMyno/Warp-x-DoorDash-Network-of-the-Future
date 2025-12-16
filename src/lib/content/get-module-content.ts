import type { ContentBlock, ModuleConfig, ModuleSectionKey } from "@/config/modules";
import { getModuleBySlug } from "@/config/modules";
import { parseBlocksJson } from "@/lib/content/blocks";
import { getSignedAssetUrl } from "@/lib/assets/get-signed-url";
import { createClient } from "@/lib/supabase/server";

export type ResolvedModuleContent = {
  moduleMeta: Pick<ModuleConfig, "slug" | "title" | "description" | "layoutVariant">;
  sections: Record<
    ModuleSectionKey,
    {
      blocks: ContentBlock[];
      source: "db" | "config";
      updatedAt?: string;
    }
  >;
};

const SECTION_KEYS: ModuleSectionKey[] = ["end-vision", "progress", "roadmap"];

export async function getModuleContent(
  slug: string,
): Promise<ResolvedModuleContent | null> {
  const moduleConfig = getModuleBySlug(slug);
  if (!moduleConfig) return null;

  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  const assetPathById = new Map<string, string | null>();
  const signedUrlByPath = new Map<string, string | null>();

  async function resolveImageBlocks(blocks: ContentBlock[]) {
    const client = supabase;
    if (!client) return blocks;

    const resolved = await Promise.all(
      blocks.map(async (block) => {
        if (block.type !== "image") return block;

        const assetId = typeof block.assetId === "string" ? block.assetId : null;
        const fallbackPath = typeof block.path === "string" ? block.path : null;

        let resolvedPath: string | null = fallbackPath;

        if (assetId) {
          if (assetPathById.has(assetId)) {
            resolvedPath = assetPathById.get(assetId) ?? fallbackPath;
          } else {
            const { data, error } = await client
              .from("assets")
              .select("path")
              .eq("id", assetId)
              .maybeSingle();
            const pathFromDb = !error && data?.path ? (data.path as string) : null;
            assetPathById.set(assetId, pathFromDb);
            resolvedPath = pathFromDb ?? fallbackPath;
          }
        }

        if (!resolvedPath) return { ...block, url: undefined };

        if (!signedUrlByPath.has(resolvedPath)) {
          const { url } = await getSignedAssetUrl({
            path: resolvedPath,
            expiresIn: 3600,
            supabase: client,
          });
          signedUrlByPath.set(resolvedPath, url);
        }

        const url = signedUrlByPath.get(resolvedPath) ?? null;

        return {
          ...block,
          path: resolvedPath ?? block.path,
          url: url ?? undefined,
        };
      }),
    );

    return resolved;
  }

  const fallbackBySection: Record<ModuleSectionKey, ContentBlock[]> = {
    "end-vision": moduleConfig.sections["end-vision"].blocks,
    progress: moduleConfig.sections.progress.blocks,
    roadmap: moduleConfig.sections.roadmap.blocks,
  };

  let rows: Array<{
    section_key: string;
    blocks: unknown;
    updated_at: string;
  }> = [];

  try {
    supabase = await createClient();
    const { data, error } = await supabase
      .from("module_sections")
      .select("section_key, blocks, updated_at")
      .eq("module_slug", slug);

    if (!error && data) rows = data;
  } catch {
    // If the table isn't created yet, or RLS blocks access, we fall back to config.
  }

  const resolved: ResolvedModuleContent["sections"] = {
    "end-vision": {
      blocks: fallbackBySection["end-vision"],
      source: "config",
    },
    progress: {
      blocks: fallbackBySection.progress,
      source: "config",
    },
    roadmap: {
      blocks: fallbackBySection.roadmap,
      source: "config",
    },
  };

  for (const key of SECTION_KEYS) {
    const row = rows.find((r) => r.section_key === key);
    if (!row) continue;

    const parsed = parseBlocksJson(row.blocks);
    if (!parsed) continue;

    resolved[key] = {
      blocks: parsed,
      source: "db",
      updatedAt: row.updated_at,
    };
  }

  for (const key of SECTION_KEYS) {
    resolved[key] = { ...resolved[key], blocks: await resolveImageBlocks(resolved[key].blocks) };
  }

  return {
    moduleMeta: {
      slug: moduleConfig.slug,
      title: moduleConfig.title,
      description: moduleConfig.description,
      layoutVariant: moduleConfig.layoutVariant,
    },
    sections: resolved,
  };
}
