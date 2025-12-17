import type { UserRole } from "@/lib/auth/roles";
import type { createClient } from "@/lib/supabase/server";
import { getNetworkEnhancementsView } from "@/lib/network-enhancements/get-view";
import { ContentPanel } from "@/components/panels/ContentPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SplitView } from "@/components/modules/network-enhancements/SplitView";
import { DiagramViewer } from "@/components/modules/network-enhancements/DiagramViewer";
import { PdfViewer } from "@/components/modules/network-enhancements/PdfViewer";
import { MarkdownLite } from "@/components/modules/network-enhancements/MarkdownLite";
import { NetworkCostModelPanel } from "@/components/modules/network-enhancements/NetworkCostModelPanel";
import { NetworkEnhancementsTabs } from "@/components/modules/network-enhancements/network-enhancements-tabs";

function formatTimestamp(value: string) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleString();
}

function filenameFromPath(path: string | null) {
  if (!path) return null;
  const parts = path.split("/");
  return parts[parts.length - 1] ?? null;
}

function normalizeSub(value: string | undefined) {
  if (value === "spoke") return "spoke";
  if (value === "network") return "network";
  return "hub";
}

function normalizeVariant(value: string | undefined) {
  if (value === "future") return "future";
  return "example";
}

function normalizePanel(value: string | undefined) {
  if (value === "highlights") return "highlights";
  if (value === "cost") return "cost";
  return "pdf";
}

export async function NetworkEnhancementsModule({
  slug,
  role,
  subParam,
  variantParam,
  panelParam,
  supabase,
}: {
  slug: string;
  role: UserRole;
  subParam?: string;
  variantParam?: string;
  panelParam?: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  const sub = normalizeSub(subParam);
  const variant = sub === "network" ? null : normalizeVariant(variantParam);
  const panel = sub === "network" ? normalizePanel(panelParam) : null;

  const view = await getNetworkEnhancementsView({
    sub,
    variant,
    supabase,
  });

  const diagramFilename = filenameFromPath(view?.diagram.path ?? null);
  const pdfFilename = filenameFromPath(view?.pdf.path ?? null);

  const title = "Network enhancements";
  const subtitle =
    sub === "hub"
      ? "Hub artifacts: top-down facility diagram and SOP."
      : sub === "spoke"
        ? "Spoke artifacts: top-down facility diagram and SOP."
        : "Network design artifacts with supporting analysis.";

  const variantLabel =
    sub === "network" ? null : variant === "future" ? "Future (Automation)" : "Example";

  return (
    <article className="mx-auto w-full max-w-[1180px] space-y-6">
      <header className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-[22px] font-semibold leading-[1.3] tracking-[-0.02em] text-foreground">
              {title}
            </h1>
            <p className="max-w-[72ch] text-[14px] leading-[1.65] text-muted-foreground/90">
              {subtitle}
            </p>
          </div>
          {view?.updatedAt ? (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
                Updated{" "}
                <span className="ml-1 font-mono">{formatTimestamp(view.updatedAt)}</span>
              </Badge>
              {variantLabel ? (
                <Badge variant="accent" className="px-2 py-0.5 text-[11px]">
                  {variantLabel}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>

        <NetworkEnhancementsTabs
          sub={subParam}
          variant={variantParam}
          panel={panelParam}
        />
      </header>

      <SplitView
        slug={slug}
        sub={sub}
        variant={variant}
        initialFocus={panel === "pdf" ? "pdf" : "reset"}
        left={
          <DiagramViewer
            url={view?.diagram.url ?? null}
            filename={diagramFilename}
            isAdmin={role === "admin"}
          />
        }
        right={
          <PdfViewer
            url={view?.pdf.url ?? null}
            filename={pdfFilename}
            isAdmin={role === "admin"}
          />
        }
      />

      {sub === "network" ? (
        <div className="space-y-4">
          {panel === "pdf" ? (
            <ContentPanel
              title="Supporting PDF"
              description="Full-width view for reading. The split view above remains available."
              right={
                view?.pdf.url ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={view.pdf.url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </Button>
                ) : null
              }
            >
              {view?.pdf.url ? (
                <div className="h-[720px] overflow-hidden rounded-2xl border border-border bg-background/15">
                  <iframe
                    title="Network PDF"
                    src={view.pdf.url}
                    className="h-full w-full"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-5 text-sm text-muted-foreground">
                  Content not available yet.
                  {role === "admin" ? (
                    <span className="ml-1">
                      Configure in <span className="font-medium text-foreground">Admin</span>.
                    </span>
                  ) : null}
                </div>
              )}
            </ContentPanel>
          ) : null}

          {panel === "highlights" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <ContentPanel
                title="Automation coverage"
                description="Which hubs/spokes have automation vs not."
              >
                {view?.networkHighlightsMd?.trim() ? (
                  <MarkdownLite value={view.networkHighlightsMd} />
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Not configured yet.
                    {role === "admin" ? (
                      <span className="ml-1">
                        Configure in{" "}
                        <a
                          className="font-medium text-foreground underline underline-offset-4"
                          href="/admin?tab=setup"
                        >
                          Admin → Setup & Diagnostics
                        </a>
                        .
                      </span>
                    ) : null}
                  </div>
                )}
              </ContentPanel>

              <ContentPanel
                title="Population coverage"
                description="Sales enablement highlights (markdown)."
              >
                {view?.networkCoverageMd?.trim() ? (
                  <MarkdownLite value={view.networkCoverageMd} />
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Not configured yet.
                  </div>
                )}
              </ContentPanel>

              <ContentPanel
                title="Volume thresholds"
                description="What changes at each volume threshold."
                className="lg:col-span-2"
              >
                {view?.networkThresholds?.length ? (
                  <div className="overflow-hidden rounded-2xl border border-border bg-background/10">
                    <div className="grid grid-cols-[260px_1fr] gap-0 border-b border-border/60 px-4 py-3 text-xs font-medium text-muted-foreground">
                      <div>Threshold</div>
                      <div>What changes</div>
                    </div>
                    <div className="divide-y divide-border/60">
                      {view.networkThresholds.map((row, idx) => (
                        <div
                          key={`${row.threshold}-${idx}`}
                          className="grid grid-cols-[260px_1fr] gap-0 px-4 py-3 text-sm"
                        >
                          <div className="font-mono text-foreground">
                            {row.threshold}
                          </div>
                          <div className="text-muted-foreground">{row.change}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Not configured yet.
                  </div>
                )}
              </ContentPanel>
            </div>
          ) : null}

          {panel === "cost" ? (
            <ContentPanel
              title="Cost modeling"
              description="Scenario picker and all-in breakdown (placeholder)."
            >
              {view?.networkCostModel ? (
                <NetworkCostModelPanel value={view.networkCostModel} />
              ) : (
                <div className="text-sm text-muted-foreground">
                  Not configured yet.
                  {role === "admin" ? (
                    <span className="ml-1">
                      Configure in{" "}
                      <a
                        className="font-medium text-foreground underline underline-offset-4"
                        href="/admin?tab=setup"
                      >
                        Admin → Setup & Diagnostics
                      </a>
                      .
                    </span>
                  ) : null}
                </div>
              )}
            </ContentPanel>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

