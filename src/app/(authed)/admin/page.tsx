import type { ContentBlock, ModuleSectionKey } from "@/config/modules";
import { MODULES } from "@/config/modules";
import { ContentStudio } from "@/components/admin/content-studio";
import { AdminTabs, type AdminTabKey } from "@/components/admin/admin-tabs";
import { SetupChecklist } from "@/components/admin/setup-checklist";
import { requireUser } from "@/lib/auth/require-user";
import { parseBlocksJson } from "@/lib/content/blocks";
import { getAdminDiagnostics } from "@/lib/diagnostics/admin";
import { redirect } from "next/navigation";

function normalizeTab(value: unknown): AdminTabKey {
  return value === "setup" ? "setup" : "content";
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = normalizeTab(tab);

  const { supabase, user, role } = await requireUser();
  if (role !== "admin") redirect("/account?reason=not-admin");

  const moduleSlugs = MODULES.map((m) => m.slug);

  if (activeTab === "setup") {
    const diagnostics = await getAdminDiagnostics({
      supabase,
      userId: user.id,
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-[length:var(--warp-fs-page-title)] font-semibold leading-[var(--warp-lh-page-title)] tracking-tight text-foreground">
              Admin
            </h2>
            <p className="text-sm text-muted-foreground">
              Setup drift checks using your current Supabase session (RLS-tested).
            </p>
          </div>
          <AdminTabs value={activeTab} />
        </div>

        <SetupChecklist diagnostics={diagnostics} />
      </div>
    );
  }

  let dbAvailable = true;
  let dbError: string | undefined;
  let auditAvailable = true;
  let auditError: string | undefined;
  type Row = {
    module_slug: string;
    section_key: ModuleSectionKey;
    status: "draft" | "published";
    blocks: unknown;
    updated_at: string;
    published_at: string | null;
  };
  let rows: Row[] = [];

  try {
    const { data, error } = await supabase
      .from("module_sections")
      .select("module_slug, section_key, status, blocks, updated_at, published_at")
      .in("module_slug", moduleSlugs);

    if (error) {
      dbAvailable = false;
      dbError = error.message;
    } else if (data) {
      rows = data as Row[];
    }
  } catch (err) {
    dbAvailable = false;
    dbError = err instanceof Error ? err.message : String(err);
  }

  if (dbAvailable) {
    try {
      const { error } = await supabase
        .from("module_section_audit")
        .select("id")
        .limit(1);

      if (error) {
        auditAvailable = false;
        auditError = error.message;
      }
    } catch (err) {
      auditAvailable = false;
      auditError = err instanceof Error ? err.message : String(err);
    }
  } else {
    auditAvailable = false;
  }

  type SectionDoc = {
    blocks: ContentBlock[] | null;
    updatedAt?: string;
    publishedAt?: string | null;
  };

  const sectionsByModule: Record<
    string,
    Partial<Record<ModuleSectionKey, Partial<Record<"draft" | "published", SectionDoc>>>>
  > = {};

  for (const row of rows) {
    const parsed = parseBlocksJson(row.blocks);
    if (!sectionsByModule[row.module_slug]) sectionsByModule[row.module_slug] = {};
    if (!sectionsByModule[row.module_slug][row.section_key]) {
      sectionsByModule[row.module_slug][row.section_key] = {};
    }
    sectionsByModule[row.module_slug][row.section_key]![row.status] = {
      blocks: parsed,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-[length:var(--warp-fs-page-title)] font-semibold leading-[var(--warp-lh-page-title)] tracking-tight text-foreground">
            Admin
          </h2>
          <p className="text-sm text-muted-foreground">
            Content Studio for editing module sections and publishing updates.
          </p>
        </div>
        <AdminTabs value={activeTab} />
      </div>

      <ContentStudio
        dbAvailable={dbAvailable}
        dbError={dbError}
        auditAvailable={auditAvailable}
        auditError={auditError}
        modules={MODULES}
        sectionsByModule={sectionsByModule}
      />
    </div>
  );
}
