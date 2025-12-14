import { notFound } from "next/navigation";

import {
  MODULE_SECTIONS,
  type ModuleSectionKey,
} from "@/config/modules";
import { Blocks } from "@/components/content/blocks";
import { AnchorNav } from "@/components/modules/anchor-nav";
import { CopySectionLink } from "@/components/modules/copy-section-link";
import {
  isModuleContentView,
  ModuleViewTabs,
  type ModuleContentView,
} from "@/components/modules/view-tabs";
import { Badge } from "@/components/ui/badge";
import { ContentPanel } from "@/components/panels/ContentPanel";
import { requireUser } from "@/lib/auth/require-user";
import { getModuleContent } from "@/lib/content/get-module-content";

const SECTION_KEYS: ModuleSectionKey[] = ["end-vision", "progress", "roadmap"];

export default async function ModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ section?: string; view?: string }>;
}) {
  const { slug } = await params;
  const { role } = await requireUser();
  const resolved = await getModuleContent(slug, {
    includeDraft: role === "admin",
    role,
  });
  if (!resolved) notFound();

  const { view: viewParam } = await searchParams;
  const view: ModuleContentView = isModuleContentView(viewParam)
    ? viewParam
    : "published";

  const isDraftView = role === "admin" && view === "draft";
  const hasAnyDraft =
    role === "admin" && SECTION_KEYS.some((k) => Boolean(resolved.sections[k].draft));

  const publishedTimestamps = SECTION_KEYS.map((k) => {
    const p = resolved.sections[k].published;
    if (p.source !== "db") return null;
    return p.publishedAt ?? p.updatedAt ?? null;
  }).filter((v): v is string => Boolean(v));

  const lastPublished =
    publishedTimestamps.length
      ? publishedTimestamps
          .slice()
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
      : null;
  const lastPublishedLabel = lastPublished
    ? new Date(lastPublished).toLocaleString()
    : null;

  const anchorItems = MODULE_SECTIONS.map((s) => ({ id: s.key, label: s.label }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-[length:var(--warp-fs-page-title)] font-semibold leading-[var(--warp-lh-page-title)] tracking-tight text-foreground">
          {resolved.moduleMeta.title}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {resolved.moduleMeta.description}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {role === "admin" ? (
              <ModuleViewTabs value={view} draftExists={hasAnyDraft} />
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {lastPublishedLabel ? (
              <span>
                Last published:{" "}
                <span className="font-mono text-foreground">
                  {lastPublishedLabel}
                </span>
              </span>
            ) : (
              <Badge variant="muted" className="px-2 py-0.5 text-[11px]">
                Not published yet
              </Badge>
            )}

            {role === "admin" ? (
              <>
                <span className="opacity-50">•</span>
                {hasAnyDraft ? (
                  <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
                    Drafts available
                    <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  </Badge>
                ) : (
                  <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
                    No draft yet
                  </Badge>
                )}
              </>
            ) : null}
          </div>
        </div>

        <AnchorNav items={anchorItems}>
          <div className="space-y-10">
            {SECTION_KEYS.map((key) => {
              const label = MODULE_SECTIONS.find((s) => s.key === key)?.label ?? key;
              const section = resolved.sections[key];
              const published = section.published.blocks;
              const draft = role === "admin" ? section.draft?.blocks ?? null : null;

              const blocksToRender = isDraftView ? draft : published;

              return (
                <section
                  key={key}
                  id={key}
                  className="space-y-4"
                  style={{ scrollMarginTop: "var(--warp-anchor-offset)" }}
                >
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-muted-foreground">
                        Section
                      </div>
                      <h3 className="mt-1 text-[length:var(--warp-fs-section-title)] font-semibold leading-[var(--warp-lh-section-title)] text-foreground">
                        {label}
                      </h3>
                    </div>

                    <CopySectionLink sectionId={key} label={label} />
                  </div>

                  {isDraftView ? (
                    blocksToRender ? (
                      <Blocks
                        blocks={blocksToRender}
                        showImageHints={role === "admin"}
                      />
                    ) : (
                      <ContentPanel
                        title="No draft yet"
                        description="Create a draft in Content Studio, then preview it here."
                        className="border-dashed bg-muted/20"
                      >
                        <div className="text-sm text-muted-foreground">
                          Open{" "}
                          <span className="font-mono text-foreground">
                            /admin
                          </span>{" "}
                          to create and save a draft for this section.
                        </div>
                      </ContentPanel>
                    )
                  ) : (
                    <Blocks blocks={published} showImageHints={role === "admin"} />
                  )}
                </section>
              );
            })}
          </div>
        </AnchorNav>
      </div>
    </div>
  );
}
