import type { ContentBlock, ModuleConfig, ModuleSectionKey } from "@/config/modules";
import { getModuleBySlug } from "@/config/modules";
import { parseBlocksJson } from "@/lib/content/blocks";
import type { UserRole } from "@/lib/auth/roles";
import { getSignedAssetUrl } from "@/lib/assets/get-signed-url";
import { createClient } from "@/lib/supabase/server";

export type ResolvedModuleContent = {
  moduleMeta: Pick<ModuleConfig, "slug" | "title" | "description">;
  sections: Record<
    ModuleSectionKey,
    {
      published: {
        blocks: ContentBlock[];
        source: "db" | "config";
        updatedAt?: string;
        publishedAt?: string | null;
      };
      draft?: {
        blocks: ContentBlock[];
        updatedAt?: string;
      } | null;
    }
  >;
};

const SECTION_KEYS: ModuleSectionKey[] = ["end-vision", "progress", "roadmap"];

export async function getModuleContent(
  slug: string,
  options?: {
    includeDraft?: boolean;
    role?: UserRole;
  },
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

  let publishedRows: Array<{
    section_key: string;
    blocks: unknown;
    updated_at: string;
    published_at: string | null;
  }> = [];
  let draftRows: Array<{ section_key: string; blocks: unknown; updated_at: string }> = [];

  try {
    supabase = await createClient();
    const { data, error } = await supabase
      .from("module_sections")
      .select("section_key, blocks, updated_at, published_at")
      .eq("module_slug", slug)
      .eq("status", "published");

    if (!error && data) publishedRows = data;

    const includeDraft =
      options?.includeDraft === true && options?.role === "admin";

    if (includeDraft) {
      const { data: draftData, error: draftError } = await supabase
        .from("module_sections")
        .select("section_key, blocks, updated_at")
        .eq("module_slug", slug)
        .eq("status", "draft");
      if (!draftError && draftData) draftRows = draftData;
    }
  } catch {
    // If the table isn't created yet, or RLS blocks access, we fall back to config.
  }

  const resolved: ResolvedModuleContent["sections"] = {
    "end-vision": {
      published: {
        blocks: fallbackBySection["end-vision"],
        source: "config",
        publishedAt: null,
      },
    },
    progress: {
      published: {
        blocks: fallbackBySection.progress,
        source: "config",
        publishedAt: null,
      },
    },
    roadmap: {
      published: {
        blocks: fallbackBySection.roadmap,
        source: "config",
        publishedAt: null,
      },
    },
  };

  resolved["end-vision"].published.blocks = await resolveImageBlocks(
    resolved["end-vision"].published.blocks,
  );
  resolved.progress.published.blocks = await resolveImageBlocks(
    resolved.progress.published.blocks,
  );
  resolved.roadmap.published.blocks = await resolveImageBlocks(
    resolved.roadmap.published.blocks,
  );

  for (const key of SECTION_KEYS) {
    const row = publishedRows.find((r) => r.section_key === key);
    if (!row) continue;

    const parsed = parseBlocksJson(row.blocks);
    if (!parsed) continue;

    resolved[key] = {
      ...resolved[key],
      published: {
        blocks: await resolveImageBlocks(parsed),
        source: "db",
        updatedAt: row.updated_at,
        publishedAt: row.published_at,
      },
    };
  }

  if (options?.includeDraft === true && options?.role === "admin") {
    for (const key of SECTION_KEYS) {
      const row = draftRows.find((r) => r.section_key === key);
      if (!row) {
        resolved[key] = { ...resolved[key], draft: null };
        continue;
      }

      const parsed = parseBlocksJson(row.blocks);
      if (!parsed) {
        resolved[key] = { ...resolved[key], draft: null };
        continue;
      }

      resolved[key] = {
        ...resolved[key],
        draft: {
          blocks: await resolveImageBlocks(parsed),
          updatedAt: row.updated_at,
        },
      };
    }
  }

  return {
    moduleMeta: {
      slug: moduleConfig.slug,
      title: moduleConfig.title,
      description: moduleConfig.description,
    },
    sections: resolved,
  };
}
