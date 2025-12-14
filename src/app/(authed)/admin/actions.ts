"use server";

import { revalidatePath } from "next/cache";

import type { ContentBlock, ModuleSectionKey } from "@/config/modules";
import { MODULES, isModuleSectionKey } from "@/config/modules";
import { requireAdmin } from "@/lib/auth/require-user";
import { parseBlocksJson } from "@/lib/content/blocks";

type AuditStatus = "draft" | "published";
type AuditAction = "save_draft" | "publish" | "restore";

export type AuditEvent = {
  id: string;
  moduleSlug: string;
  sectionKey: ModuleSectionKey;
  status: AuditStatus;
  action: AuditAction;
  createdAt: string;
  actorEmail: string | null;
};

type ActionResult =
  | {
      ok: true;
      updatedAt?: string;
      publishedAt?: string | null;
      draftBlocks?: ContentBlock[];
      audit?: AuditEvent;
    }
  | { ok: false; error: string };

export type DiagnosticsResult =
  | { ok: true; message: string; updatedAt?: string; publishedAt?: string | null }
  | { ok: false; error: string };

function isValidModuleSlug(slug: string) {
  return MODULES.some((m) => m.slug === slug);
}

function validateBlocksForWrite(input: unknown): ContentBlock[] | null {
  if (!Array.isArray(input)) return null;
  const parsed = parseBlocksJson(input);
  if (!parsed) return null;
  if (parsed.length !== input.length) return null;
  return parsed;
}

function auditErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : null;
  return (
    message ??
    "Audit log is not available. Run supabase/sql/02_module_content_audit.sql in Supabase SQL editor."
  );
}

async function insertAudit(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  input: {
    moduleSlug: string;
    sectionKey: ModuleSectionKey;
    status: AuditStatus;
    action: AuditAction;
    blocks: ContentBlock[];
    actorId: string;
    actorEmail: string | null;
  },
): Promise<{ ok: true; event: AuditEvent } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("module_section_audit")
    .insert({
      module_slug: input.moduleSlug,
      section_key: input.sectionKey,
      status: input.status,
      action: input.action,
      blocks: input.blocks,
      actor_id: input.actorId,
      actor_email: input.actorEmail,
    })
    .select("id, module_slug, section_key, status, action, created_at, actor_email")
    .single();

  if (error || !data) {
    return { ok: false, error: auditErrorMessage(error ?? "Failed to write audit.") };
  }

  return {
    ok: true,
    event: {
      id: data.id as string,
      moduleSlug: data.module_slug as string,
      sectionKey: data.section_key as ModuleSectionKey,
      status: data.status as AuditStatus,
      action: data.action as AuditAction,
      createdAt: data.created_at as string,
      actorEmail: (data.actor_email as string | null) ?? null,
    },
  };
}

export async function upsertDraft(
  moduleSlug: string,
  sectionKey: string,
  blocks: unknown,
): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();

  if (!isValidModuleSlug(moduleSlug)) {
    return { ok: false, error: "Unknown module slug." };
  }
  if (!isModuleSectionKey(sectionKey)) {
    return { ok: false, error: "Invalid section key." };
  }

  const parsed = validateBlocksForWrite(blocks);
  if (!parsed) {
    return {
      ok: false,
      error: "Blocks failed validation. Fix invalid blocks before saving.",
    };
  }

  const { data: previousDraft } = await supabase
    .from("module_sections")
    .select("blocks")
    .eq("module_slug", moduleSlug)
    .eq("section_key", sectionKey)
    .eq("status", "draft")
    .maybeSingle();

  const { data, error } = await supabase
    .from("module_sections")
    .upsert(
      {
        module_slug: moduleSlug,
        section_key: sectionKey,
        status: "draft",
        blocks: parsed,
        published_at: null,
      },
      { onConflict: "module_slug,section_key,status" },
    )
    .select("updated_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to save draft." };
  }

  const audit = await insertAudit(supabase, {
    moduleSlug,
    sectionKey,
    status: "draft",
    action: "save_draft",
    blocks: parsed,
    actorId: user.id,
    actorEmail: user.email ?? null,
  });

  if (!audit.ok) {
    if (previousDraft?.blocks) {
      await supabase
        .from("module_sections")
        .upsert(
          {
            module_slug: moduleSlug,
            section_key: sectionKey,
            status: "draft",
            blocks: previousDraft.blocks,
            published_at: null,
          },
          { onConflict: "module_slug,section_key,status" },
        );
    } else {
      await supabase
        .from("module_sections")
        .delete()
        .eq("module_slug", moduleSlug)
        .eq("section_key", sectionKey)
        .eq("status", "draft");
    }
    return { ok: false, error: audit.error };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/m/${moduleSlug}`);

  return {
    ok: true,
    updatedAt: data.updated_at as string,
    draftBlocks: parsed,
    audit: audit.event,
  };
}

export async function publishFromDraft(
  moduleSlug: string,
  sectionKey: string,
): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();

  if (!isValidModuleSlug(moduleSlug)) {
    return { ok: false, error: "Unknown module slug." };
  }
  if (!isModuleSectionKey(sectionKey)) {
    return { ok: false, error: "Invalid section key." };
  }

  const { data: draft, error: draftError } = await supabase
    .from("module_sections")
    .select("blocks")
    .eq("module_slug", moduleSlug)
    .eq("section_key", sectionKey)
    .eq("status", "draft")
    .maybeSingle();

  if (draftError) {
    return { ok: false, error: draftError.message };
  }
  if (!draft) {
    return { ok: false, error: "No draft found. Save a draft before publishing." };
  }

  const parsed = parseBlocksJson(draft.blocks);
  if (!parsed || (Array.isArray(draft.blocks) && parsed.length !== draft.blocks.length)) {
    return { ok: false, error: "Draft blocks failed validation." };
  }

  const { data: previousPublished } = await supabase
    .from("module_sections")
    .select("blocks, published_at")
    .eq("module_slug", moduleSlug)
    .eq("section_key", sectionKey)
    .eq("status", "published")
    .maybeSingle();

  const publishedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("module_sections")
    .upsert(
      {
        module_slug: moduleSlug,
        section_key: sectionKey,
        status: "published",
        blocks: parsed,
        published_at: publishedAt,
      },
      { onConflict: "module_slug,section_key,status" },
    )
    .select("updated_at, published_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to publish." };
  }

  const audit = await insertAudit(supabase, {
    moduleSlug,
    sectionKey,
    status: "published",
    action: "publish",
    blocks: parsed,
    actorId: user.id,
    actorEmail: user.email ?? null,
  });

  if (!audit.ok) {
    if (previousPublished?.blocks) {
      await supabase
        .from("module_sections")
        .upsert(
          {
            module_slug: moduleSlug,
            section_key: sectionKey,
            status: "published",
            blocks: previousPublished.blocks,
            published_at: previousPublished.published_at ?? null,
          },
          { onConflict: "module_slug,section_key,status" },
        );
    } else {
      await supabase
        .from("module_sections")
        .delete()
        .eq("module_slug", moduleSlug)
        .eq("section_key", sectionKey)
        .eq("status", "published");
    }
    return { ok: false, error: audit.error };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/m/${moduleSlug}`);

  return {
    ok: true,
    updatedAt: data.updated_at as string,
    publishedAt: (data.published_at as string | null) ?? publishedAt,
    audit: audit.event,
  };
}

export async function copyPublishedToDraft(
  moduleSlug: string,
  sectionKey: string,
): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();

  if (!isValidModuleSlug(moduleSlug)) {
    return { ok: false, error: "Unknown module slug." };
  }
  if (!isModuleSectionKey(sectionKey)) {
    return { ok: false, error: "Invalid section key." };
  }

  const { data: published, error: publishedError } = await supabase
    .from("module_sections")
    .select("blocks")
    .eq("module_slug", moduleSlug)
    .eq("section_key", sectionKey)
    .eq("status", "published")
    .maybeSingle();

  if (publishedError) return { ok: false, error: publishedError.message };
  if (!published) {
    return { ok: false, error: "No published content found for this section." };
  }

  const parsed = parseBlocksJson(published.blocks);
  if (!parsed || (Array.isArray(published.blocks) && parsed.length !== published.blocks.length)) {
    return { ok: false, error: "Published blocks failed validation." };
  }

  const { data: previousDraft } = await supabase
    .from("module_sections")
    .select("blocks")
    .eq("module_slug", moduleSlug)
    .eq("section_key", sectionKey)
    .eq("status", "draft")
    .maybeSingle();

  const { data, error } = await supabase
    .from("module_sections")
    .upsert(
      {
        module_slug: moduleSlug,
        section_key: sectionKey,
        status: "draft",
        blocks: parsed,
        published_at: null,
      },
      { onConflict: "module_slug,section_key,status" },
    )
    .select("updated_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to copy published to draft." };
  }

  const audit = await insertAudit(supabase, {
    moduleSlug,
    sectionKey,
    status: "draft",
    action: "restore",
    blocks: parsed,
    actorId: user.id,
    actorEmail: user.email ?? null,
  });

  if (!audit.ok) {
    if (previousDraft?.blocks) {
      await supabase
        .from("module_sections")
        .upsert(
          {
            module_slug: moduleSlug,
            section_key: sectionKey,
            status: "draft",
            blocks: previousDraft.blocks,
            published_at: null,
          },
          { onConflict: "module_slug,section_key,status" },
        );
    } else {
      await supabase
        .from("module_sections")
        .delete()
        .eq("module_slug", moduleSlug)
        .eq("section_key", sectionKey)
        .eq("status", "draft");
    }
    return { ok: false, error: audit.error };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/m/${moduleSlug}`);

  return {
    ok: true,
    updatedAt: data.updated_at as string,
    draftBlocks: parsed,
    audit: audit.event,
  };
}

export async function restoreFromAudit(auditId: string): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();

  const { data: row, error } = await supabase
    .from("module_section_audit")
    .select("module_slug, section_key, blocks")
    .eq("id", auditId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: "Audit event not found." };

  const moduleSlug = row.module_slug as string;
  const sectionKey = row.section_key as string;

  if (!isValidModuleSlug(moduleSlug)) {
    return { ok: false, error: "Audit refers to an unknown module." };
  }
  if (!isModuleSectionKey(sectionKey)) {
    return { ok: false, error: "Audit refers to an invalid section key." };
  }

  const parsed = parseBlocksJson(row.blocks);
  if (!parsed || (Array.isArray(row.blocks) && parsed.length !== row.blocks.length)) {
    return { ok: false, error: "Audit snapshot failed validation." };
  }

  const { data: previousDraft } = await supabase
    .from("module_sections")
    .select("blocks")
    .eq("module_slug", moduleSlug)
    .eq("section_key", sectionKey)
    .eq("status", "draft")
    .maybeSingle();

  const { data: draftUpsert, error: draftError } = await supabase
    .from("module_sections")
    .upsert(
      {
        module_slug: moduleSlug,
        section_key: sectionKey,
        status: "draft",
        blocks: parsed,
        published_at: null,
      },
      { onConflict: "module_slug,section_key,status" },
    )
    .select("updated_at")
    .single();

  if (draftError || !draftUpsert) {
    return { ok: false, error: draftError?.message ?? "Failed to restore draft." };
  }

  const audit = await insertAudit(supabase, {
    moduleSlug,
    sectionKey,
    status: "draft",
    action: "restore",
    blocks: parsed,
    actorId: user.id,
    actorEmail: user.email ?? null,
  });

  if (!audit.ok) {
    if (previousDraft?.blocks) {
      await supabase
        .from("module_sections")
        .upsert(
          {
            module_slug: moduleSlug,
            section_key: sectionKey,
            status: "draft",
            blocks: previousDraft.blocks,
            published_at: null,
          },
          { onConflict: "module_slug,section_key,status" },
        );
    } else {
      await supabase
        .from("module_sections")
        .delete()
        .eq("module_slug", moduleSlug)
        .eq("section_key", sectionKey)
        .eq("status", "draft");
    }
    return { ok: false, error: audit.error };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/m/${moduleSlug}`);

  return {
    ok: true,
    updatedAt: draftUpsert.updated_at as string,
    draftBlocks: parsed,
    audit: audit.event,
  };
}

export async function listAuditEvents(
  moduleSlug: string,
  sectionKey: string,
  limit = 20,
): Promise<{ ok: true; events: AuditEvent[] } | { ok: false; error: string }> {
  const { supabase } = await requireAdmin();

  if (!isValidModuleSlug(moduleSlug)) {
    return { ok: false, error: "Unknown module slug." };
  }
  if (!isModuleSectionKey(sectionKey)) {
    return { ok: false, error: "Invalid section key." };
  }

  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const { data, error } = await supabase
    .from("module_section_audit")
    .select("id, module_slug, section_key, status, action, created_at, actor_email")
    .eq("module_slug", moduleSlug)
    .eq("section_key", sectionKey)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) return { ok: false, error: auditErrorMessage(error) };
  if (!data) return { ok: true, events: [] };

  return {
    ok: true,
    events: data.map((row) => ({
      id: row.id as string,
      moduleSlug: row.module_slug as string,
      sectionKey: row.section_key as ModuleSectionKey,
      status: row.status as AuditStatus,
      action: row.action as AuditAction,
      createdAt: row.created_at as string,
      actorEmail: (row.actor_email as string | null) ?? null,
    })),
  };
}

function sampleBlocks(): ContentBlock[] {
  return [
    {
      type: "kpis",
      title: "Diagnostics sample",
      items: [
        { label: "Status", value: "OK" },
        { label: "Draft", value: "Created" },
        { label: "Publish", value: "Ready" },
        { label: "Audit", value: "Enabled" },
      ],
    },
    {
      type: "bullets",
      title: "What this is",
      description: "Created by Setup & Diagnostics (non-destructive).",
      items: [
        "This draft is safe to delete or overwrite from Content Studio.",
        "Use it to validate publish/history/restore workflows end-to-end.",
      ],
    },
  ];
}

export async function diagnosticsSeedDraft(
  moduleSlug: string,
  sectionKey: ModuleSectionKey,
): Promise<DiagnosticsResult> {
  const { supabase } = await requireAdmin();

  if (!isValidModuleSlug(moduleSlug)) {
    return { ok: false, error: "Unknown module slug." };
  }

  const { data: existingDraft, error } = await supabase
    .from("module_sections")
    .select("id")
    .eq("module_slug", moduleSlug)
    .eq("section_key", sectionKey)
    .eq("status", "draft")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (existingDraft) {
    return { ok: true, message: "Draft already exists — skipped (not overwritten)." };
  }

  const saved = await upsertDraft(moduleSlug, sectionKey, sampleBlocks());
  if (!saved.ok) return { ok: false, error: saved.error };

  return {
    ok: true,
    message: "Sample draft created.",
    updatedAt: saved.updatedAt,
  };
}

export async function diagnosticsPublishDraft(
  moduleSlug: string,
  sectionKey: ModuleSectionKey,
): Promise<DiagnosticsResult> {
  const { supabase } = await requireAdmin();

  if (!isValidModuleSlug(moduleSlug)) {
    return { ok: false, error: "Unknown module slug." };
  }

  const { data: existingPublished, error: publishedError } = await supabase
    .from("module_sections")
    .select("id")
    .eq("module_slug", moduleSlug)
    .eq("section_key", sectionKey)
    .eq("status", "published")
    .maybeSingle();

  if (publishedError) return { ok: false, error: publishedError.message };
  if (existingPublished) {
    return { ok: true, message: "Published content already exists — skipped." };
  }

  const published = await publishFromDraft(moduleSlug, sectionKey);
  if (!published.ok) return { ok: false, error: published.error };

  return {
    ok: true,
    message: "Draft published.",
    updatedAt: published.updatedAt,
    publishedAt: published.publishedAt ?? null,
  };
}
