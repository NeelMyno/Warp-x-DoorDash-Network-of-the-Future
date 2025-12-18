import type { UserRole } from "@/lib/auth/roles";
import type { createClient } from "@/lib/supabase/server";
import { getNetworkEnhancementsView } from "@/lib/network-enhancements/get-view";
import { getNetworkEnhancementsInsights } from "@/lib/network-enhancements/get-insights";
import { Badge } from "@/components/ui/badge";
import { SplitView } from "@/components/modules/network-enhancements/SplitView";
import { DiagramViewer } from "@/components/modules/network-enhancements/DiagramViewer";
import { PdfViewer } from "@/components/modules/network-enhancements/PdfViewer";
import { NetworkEnhancementsTabs } from "@/components/modules/network-enhancements/network-enhancements-tabs";
import { InsightsSection } from "@/components/modules/network-enhancements/insights/InsightsSection";
import { AutomationCoverageTable } from "@/components/modules/network-enhancements/insights/AutomationCoverageTable";
import { VolumeThresholdCards } from "@/components/modules/network-enhancements/insights/VolumeThresholdCards";
import { CoverageClaimCards } from "@/components/modules/network-enhancements/insights/CoverageClaimCards";
import { CostScenarioTables } from "@/components/modules/network-enhancements/insights/CostScenarioTables";

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

export async function NetworkEnhancementsModule({
  slug,
  role,
  subParam,
  variantParam,
  supabase,
}: {
  slug: string;
  role: UserRole;
  subParam?: string;
  variantParam?: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  const sub = normalizeSub(subParam);
  const variant = sub === "network" ? null : normalizeVariant(variantParam);

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

  const insightsResult =
    sub === "network" && view?.id
      ? await getNetworkEnhancementsInsights({ viewId: view.id, supabase })
      : null;
  const insights = insightsResult && insightsResult.ok ? insightsResult.insights : null;

  return (
    <article className="w-full space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-[22px] font-semibold leading-[1.3] tracking-[-0.02em] text-foreground">
            {title}
          </h1>
          <p className="max-w-[72ch] text-[14px] leading-[1.65] text-muted-foreground/90">
            {subtitle}
          </p>

          <div className="space-y-3 pt-1">
            <NetworkEnhancementsTabs sub={subParam} variant={variantParam} />
          </div>
        </div>

        <div className="flex items-center gap-2 lg:justify-end">
          {view?.updatedAt ? (
            <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
              Updated{" "}
              <span className="ml-1 font-mono">{formatTimestamp(view.updatedAt)}</span>
            </Badge>
          ) : null}
          {variantLabel ? (
            <Badge variant="accent" className="px-2 py-0.5 text-[11px]">
              {variantLabel}
            </Badge>
          ) : null}
        </div>
      </header>

      <SplitView
        slug={slug}
        sub={sub}
        variant={variant}
        left={
          <DiagramViewer
            assetId={view?.diagram.assetId ?? null}
            url={view?.diagram.url ?? null}
            expiresAt={view?.diagram.expiresAt ?? null}
            filename={diagramFilename}
            title={view?.diagramTitle}
            alt={view?.diagramAlt}
            caption={view?.diagramCaption}
            isAdmin={role === "admin"}
          />
        }
        right={
          <PdfViewer
            assetId={view?.pdf.assetId ?? null}
            url={view?.pdf.url ?? null}
            expiresAt={view?.pdf.expiresAt ?? null}
            filename={pdfFilename}
            title={view?.pdfTitle}
            caption={view?.pdfCaption}
            isAdmin={role === "admin"}
          />
        }
      />

      {sub === "network" ? (
        <div className="space-y-5">
          <div className="space-y-1">
            <div className="text-base font-semibold text-foreground">Network insights</div>
            <div className="text-sm text-muted-foreground">
              How the future hub/spoke network scales, what changes by volume, and unit economics assumptions.
            </div>
          </div>

          {insightsResult && !insightsResult.ok ? (
            <div className="rounded-2xl border border-border bg-muted/10 p-4 text-sm text-muted-foreground">
              {insightsResult.error}
            </div>
          ) : null}

          <div className="space-y-4">
            <InsightsSection
              id="automation-coverage"
              title="Automation coverage"
              description="Which hubs/spokes have automation."
              updatedAt={insights?.updatedAt.automationCoverage ?? null}
              isEmpty={!insights?.automationNodes.length}
              emptyText="No automation coverage entries yet."
              isAdmin={role === "admin"}
            >
              <AutomationCoverageTable nodes={insights?.automationNodes ?? []} />
            </InsightsSection>

            <InsightsSection
              id="volume-thresholds"
              title="Volume thresholds"
              description="What changes at each volume threshold."
              updatedAt={insights?.updatedAt.volumeThresholds ?? null}
              isEmpty={!insights?.volumeThresholds.length}
              emptyText="No volume thresholds configured yet."
              isAdmin={role === "admin"}
            >
              <VolumeThresholdCards items={insights?.volumeThresholds ?? []} />
            </InsightsSection>

            <InsightsSection
              id="population-coverage"
              title="Population coverage"
              description="Sales enablement claims and service-level coverage statements."
              updatedAt={insights?.updatedAt.populationCoverage ?? null}
              isEmpty={!insights?.coverageClaims.length}
              emptyText="No population coverage claims configured yet."
              isAdmin={role === "admin"}
            >
              <CoverageClaimCards items={insights?.coverageClaims ?? []} />
            </InsightsSection>

            <InsightsSection
              id="cost-modeling"
              title="Cost modeling (per box)"
              description="Middle-mile utilization scenarios and all-in cost breakdown."
              updatedAt={insights?.updatedAt.costModeling ?? null}
              isEmpty={!insights?.costScenarios.length}
              emptyText="No cost scenarios configured yet."
              isAdmin={role === "admin"}
            >
              <CostScenarioTables items={insights?.costScenarios ?? []} />
            </InsightsSection>
          </div>
        </div>
      ) : null}
    </article>
  );
}
