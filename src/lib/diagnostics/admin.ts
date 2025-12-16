import { PORTAL_ASSETS_BUCKET } from "@/lib/assets/constants";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type DiagnosticStatus = "pass" | "warn" | "fail";

export type DiagnosticRemediation = {
  title: string;
  steps: string[];
  snippet?: string;
};

export type DiagnosticCheck = {
  id: string;
  label: string;
  status: DiagnosticStatus;
  summary: string;
  details?: string;
  remediation?: DiagnosticRemediation;
};

export type AdminDiagnostics = {
  generatedAt: string;
  checks: DiagnosticCheck[];
  stats: {
    pass: number;
    warn: number;
    fail: number;
  };
  counts?: {
    moduleSections?: number;
    auditEvents?: number;
    assets?: number;
  };
};

function errMessage(error: unknown) {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  const maybe = error as { message?: unknown };
  return typeof maybe?.message === "string" ? maybe.message : null;
}

function classifyStorageError(error: unknown): "bucket" | "policy" | "unknown" {
  const msg = (errMessage(error) ?? "").toLowerCase();
  if (msg.includes("bucket") && msg.includes("not found")) return "bucket";
  if (msg.includes("not authorized") || msg.includes("permission") || msg.includes("rls")) {
    return "policy";
  }
  return "unknown";
}

async function safeCount(
  supabase: SupabaseServerClient,
  table: string,
  filter?: { column: string; value: string },
): Promise<number | undefined> {
  try {
    let q = supabase.from(table).select("id", { count: "exact", head: true });
    if (filter) q = q.eq(filter.column, filter.value);
    const { count, error } = await q;
    if (error) return undefined;
    return typeof count === "number" ? count : undefined;
  } catch {
    return undefined;
  }
}

export async function getAdminDiagnostics(input: {
  supabase: SupabaseServerClient;
  userId: string;
}): Promise<AdminDiagnostics> {
  const supabase = input.supabase;
  const checks: DiagnosticCheck[] = [];

  // 1) profiles + is_admin()
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", input.userId)
      .maybeSingle();

    if (error) {
      checks.push({
        id: "profiles",
        label: "Profiles + roles",
        status: "fail",
        summary: "Failed to read public.profiles for the current user.",
        details: error.message,
        remediation: {
          title: "Create profiles + is_admin()",
          steps: [
            "Run supabase/sql/00_profiles.sql in the Supabase SQL editor.",
            "Ensure your user has a row in public.profiles and role='admin'.",
          ],
        },
      });
    } else if (!profile) {
      checks.push({
        id: "profiles",
        label: "Profiles + roles",
        status: "fail",
        summary: "No public.profiles row exists for the current user.",
        remediation: {
          title: "Create profiles + triggers",
          steps: [
            "Run supabase/sql/00_profiles.sql in the Supabase SQL editor.",
            "If the user already exists, insert a profiles row manually for their UUID.",
          ],
        },
      });
    } else {
      const role = profile.role === "admin" ? "admin" : "user";
      const { data: isAdmin, error: rpcError } = await supabase.rpc("is_admin");
      if (rpcError) {
        checks.push({
          id: "profiles",
          label: "Profiles + roles",
          status: "warn",
          summary: "Profile row is readable, but public.is_admin() RPC failed.",
          details: rpcError.message,
          remediation: {
            title: "Fix is_admin() function",
            steps: ["Re-run supabase/sql/00_profiles.sql in Supabase SQL editor."],
          },
        });
      } else if (role !== "admin" || isAdmin !== true) {
        checks.push({
          id: "profiles",
          label: "Profiles + roles",
          status: "fail",
          summary: "This session is not recognized as admin by public.is_admin().",
          details: `profiles.role=${role}, is_admin()=${String(isAdmin)}`,
          remediation: {
            title: "Grant admin role (manual)",
            steps: [
              "In Supabase SQL editor, update your role to admin:",
              "Refresh the app after updating.",
            ],
            snippet: `update public.profiles set role = 'admin' where id = '${input.userId}';`,
          },
        });
      } else {
        checks.push({
          id: "profiles",
          label: "Profiles + roles",
          status: "pass",
          summary: "Admin role resolved via public.profiles and public.is_admin().",
        });
      }
    }
  } catch (err) {
    checks.push({
      id: "profiles",
      label: "Profiles + roles",
      status: "fail",
      summary: "Failed to validate admin role.",
      details: errMessage(err) ?? "Unknown error",
    });
  }

  // 2) module_sections
  try {
    const { error } = await supabase.from("module_sections").select("id").limit(1);
    checks.push(
      error
        ? {
            id: "module_sections",
            label: "Module content store",
            status: "fail",
            summary: "public.module_sections is not reachable under RLS.",
            details: error.message,
            remediation: {
              title: "Create module_sections",
              steps: ["Run supabase/sql/01_module_content.sql in Supabase SQL editor."],
            },
          }
        : {
            id: "module_sections",
            label: "Module content store",
            status: "pass",
            summary: "public.module_sections is reachable.",
          },
    );
  } catch (err) {
    checks.push({
      id: "module_sections",
      label: "Module content store",
      status: "fail",
      summary: "public.module_sections query failed.",
      details: errMessage(err) ?? "Unknown error",
      remediation: {
        title: "Create module_sections",
        steps: ["Run supabase/sql/01_module_content.sql in Supabase SQL editor."],
      },
    });
  }

  // 3) module_section_audit
  try {
    const { error } = await supabase
      .from("module_section_audit")
      .select("id")
      .limit(1);
    checks.push(
      error
        ? {
            id: "module_section_audit",
            label: "Audit log",
            status: "fail",
            summary: "public.module_section_audit is not reachable under RLS.",
            details: error.message,
            remediation: {
              title: "Create audit log table",
              steps: [
                "Run supabase/sql/02_module_content_audit.sql in Supabase SQL editor.",
              ],
            },
          }
        : {
            id: "module_section_audit",
            label: "Audit log",
            status: "pass",
            summary: "public.module_section_audit is reachable.",
          },
    );
  } catch (err) {
    checks.push({
      id: "module_section_audit",
      label: "Audit log",
      status: "fail",
      summary: "public.module_section_audit query failed.",
      details: errMessage(err) ?? "Unknown error",
      remediation: {
        title: "Create audit log table",
        steps: ["Run supabase/sql/02_module_content_audit.sql in Supabase SQL editor."],
      },
    });
  }

  // 4) assets table
  try {
    const { error } = await supabase.from("assets").select("id").limit(1);
    checks.push(
      error
        ? {
            id: "assets_table",
            label: "Assets index",
            status: "fail",
            summary: "public.assets is not reachable under RLS.",
            details: error.message,
            remediation: {
              title: "Create assets table + RLS",
              steps: ["Run supabase/sql/03_assets.sql in Supabase SQL editor."],
            },
          }
        : {
            id: "assets_table",
            label: "Assets index",
            status: "pass",
            summary: "public.assets is reachable.",
          },
    );
  } catch (err) {
    checks.push({
      id: "assets_table",
      label: "Assets index",
      status: "fail",
      summary: "public.assets query failed.",
      details: errMessage(err) ?? "Unknown error",
      remediation: {
        title: "Create assets table + RLS",
        steps: ["Run supabase/sql/03_assets.sql in Supabase SQL editor."],
      },
    });
  }

  // 5) Storage policies (runtime checks)
  try {
    const { data, error } = await supabase.storage
      .from(PORTAL_ASSETS_BUCKET)
      .list("", { limit: 1 });

    if (error) {
      const kind = classifyStorageError(error);
      checks.push({
        id: "storage_read",
        label: "Storage read policy (authenticated)",
        status: "fail",
        summary:
          kind === "bucket"
            ? `Bucket "${PORTAL_ASSETS_BUCKET}" not found.`
            : kind === "policy"
              ? "Bucket exists but read is blocked (policies missing/incorrect)."
              : "Storage read check failed.",
        details: errMessage(error) ?? undefined,
        remediation: {
          title: "Fix Storage bucket + policies",
          steps: [
            `Create a private bucket named "${PORTAL_ASSETS_BUCKET}" in Supabase Storage.`,
            `Add a SELECT policy for authenticated users: bucket_id = '${PORTAL_ASSETS_BUCKET}'.`,
          ],
          snippet: `-- Storage.objects SELECT policy (to authenticated)\nusing (bucket_id = '${PORTAL_ASSETS_BUCKET}')`,
        },
      });
    } else {
      checks.push({
        id: "storage_read",
        label: "Storage read policy (authenticated)",
        status: "pass",
        summary: "Able to list Storage objects using the current session.",
        details: `Objects visible: ${Array.isArray(data) ? data.length : 0}`,
      });
    }
  } catch (err) {
    checks.push({
      id: "storage_read",
      label: "Storage read policy (authenticated)",
      status: "fail",
      summary: "Storage list() request failed.",
      details: errMessage(err) ?? "Unknown error",
    });
  }

  try {
    const probePath = `diagnostics/policy-probe-${Date.now()}.txt`;
    const { error } = await supabase.storage
      .from(PORTAL_ASSETS_BUCKET)
      .createSignedUploadUrl(probePath);

    checks.push(
      error
        ? {
            id: "storage_write",
            label: "Storage write policy (admin)",
            status: "fail",
            summary: "Admin write check failed (createSignedUploadUrl).",
            details: error.message,
            remediation: {
              title: "Add admin INSERT/UPDATE/DELETE policies",
              steps: [
                "In Supabase dashboard (Storage → Policies), add INSERT/UPDATE/DELETE policies that require public.is_admin().",
                "Make sure the bucket_id condition is also present.",
              ],
              snippet: `-- Storage.objects INSERT/UPDATE/DELETE policies (to authenticated)\n(bucket_id = '${PORTAL_ASSETS_BUCKET}' and public.is_admin())`,
            },
          }
        : {
            id: "storage_write",
            label: "Storage write policy (admin)",
            status: "pass",
            summary: "Able to create a signed upload URL (admin write looks enabled).",
          },
    );
  } catch (err) {
    checks.push({
      id: "storage_write",
      label: "Storage write policy (admin)",
      status: "fail",
      summary: "Storage createSignedUploadUrl() request failed.",
      details: errMessage(err) ?? "Unknown error",
    });
  }

  const pass = checks.filter((c) => c.status === "pass").length;
  const warn = checks.filter((c) => c.status === "warn").length;
  const fail = checks.filter((c) => c.status === "fail").length;

  const counts: AdminDiagnostics["counts"] = {};
  counts.moduleSections = await safeCount(supabase, "module_sections");
  counts.auditEvents = await safeCount(supabase, "module_section_audit");
  counts.assets = await safeCount(supabase, "assets");

  return {
    generatedAt: new Date().toISOString(),
    checks,
    stats: { pass, warn, fail },
    counts,
  };
}
