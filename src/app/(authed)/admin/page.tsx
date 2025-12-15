import type { ContentBlock, ModuleSectionKey } from "@/config/modules";
import { MODULES } from "@/config/modules";
import { ContentStudio } from "@/components/admin/content-studio";
import { AdminTabs, type AdminTabKey } from "@/components/admin/admin-tabs";
import {
  UsersPanel,
  type PortalUserRow,
  type UserAdminAuditEvent,
} from "@/components/admin/users/users-panel";
import { SetupChecklist } from "@/components/admin/setup-checklist";
import { requireUser } from "@/lib/auth/require-user";
import { parseBlocksJson } from "@/lib/content/blocks";
import { getAdminDiagnostics } from "@/lib/diagnostics/admin";
import { redirect } from "next/navigation";

function normalizeTab(value: unknown): AdminTabKey {
  if (value === "users") return "users";
  if (value === "setup") return "setup";
  return "content";
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

  if (activeTab === "users") {
    let usersAvailable = true;
    let usersError: string | undefined;
    let users: PortalUserRow[] = [];

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, email, full_name, role, status, invited_at, invited_by, disabled_at, created_at",
        )
        .order("created_at", { ascending: false });

      if (error) {
        usersAvailable = false;
        usersError = error.message;
      } else if (data) {
        users = (data as unknown[]).map((row) => {
          const r = row as Record<string, unknown>;
          return {
            id: String(r.id),
            email: typeof r.email === "string" ? r.email : null,
            fullName: typeof r.full_name === "string" ? r.full_name : null,
            role: r.role === "admin" ? "admin" : "user",
            status:
              r.status === "invited"
                ? "invited"
                : r.status === "disabled"
                  ? "disabled"
                  : "active",
            invitedAt: typeof r.invited_at === "string" ? r.invited_at : undefined,
            invitedBy: typeof r.invited_by === "string" ? r.invited_by : undefined,
            disabledAt: typeof r.disabled_at === "string" ? r.disabled_at : undefined,
            createdAt: typeof r.created_at === "string" ? r.created_at : undefined,
          } satisfies PortalUserRow;
        });
      }
    } catch (err) {
      usersAvailable = false;
      usersError = err instanceof Error ? err.message : String(err);
    }

    let auditAvailable = true;
    let auditError: string | undefined;
    let auditEvents: UserAdminAuditEvent[] = [];

    try {
      const { data, error } = await supabase
        .from("user_admin_audit")
        .select("id, created_at, actor_email, action, target_email, metadata")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        auditAvailable = false;
        auditError = error.message;
      } else if (data) {
        auditEvents = (data as unknown[]).map((row) => {
          const r = row as Record<string, unknown>;
          return {
            id: String(r.id),
            createdAt: String(r.created_at),
            actorEmail: typeof r.actor_email === "string" ? r.actor_email : null,
            action: String(r.action),
            targetEmail: typeof r.target_email === "string" ? r.target_email : null,
            metadata:
              r.metadata && typeof r.metadata === "object"
                ? (r.metadata as Record<string, unknown>)
                : {},
          } satisfies UserAdminAuditEvent;
        });
      }
    } catch (err) {
      auditAvailable = false;
      auditError = err instanceof Error ? err.message : String(err);
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-[length:var(--warp-fs-page-title)] font-semibold leading-[var(--warp-lh-page-title)] tracking-tight text-foreground">
              Admin
            </h2>
            <p className="text-sm text-muted-foreground">
              Invite users and manage portal access.
            </p>
          </div>
          <AdminTabs value={activeTab} />
        </div>

        <UsersPanel
          users={users}
          currentUserId={user.id}
          dbAvailable={usersAvailable}
          dbError={usersError}
          auditAvailable={auditAvailable}
          auditError={auditError}
          auditEvents={auditEvents}
        />
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
