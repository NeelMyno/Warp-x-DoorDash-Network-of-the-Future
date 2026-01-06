"use server";

import { revalidatePath } from "next/cache";

import type { ContentBlock, ModuleSectionKey } from "@/config/modules";
import { MODULES, isModuleSectionKey } from "@/config/modules";
import { requireAdmin } from "@/lib/auth/require-user";
import { parseBlocksJson } from "@/lib/content/blocks";

type AuditAction = "module_content_updated";

export type AuditEvent = {
  id: string;
  moduleSlug: string;
  sectionKey: ModuleSectionKey;
  action: AuditAction;
  createdAt: string;
  actorEmail: string | null;
};

type ActionResult =
  | {
      ok: true;
      updatedAt?: string;
      blocks?: ContentBlock[];
      audit?: AuditEvent;
    }
  | { ok: false; error: string };

export type DiagnosticsResult =
  | { ok: true; message: string; updatedAt?: string }
  | { ok: false; error: string };

function isValidModuleSlug(slug: string) {
  return MODULES.some((m) => m.slug === slug);
}

/**
 * Sanitize blocks for database storage.
 * Strips signed URLs to prevent leaking temporary credentials.
 */
function sanitizeBlocksForStorage(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.map((block) => {
    if (block.type === "image") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { url, ...rest } = block;
      return rest;
    }
    if (block.type === "pdf") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { url, ...rest } = block;
      return rest;
    }
    return block;
  });
}

function validateBlocksForWrite(input: unknown): ContentBlock[] | null {
  if (!Array.isArray(input)) return null;
  const parsed = parseBlocksJson(input);
  if (!parsed) return null;
  if (parsed.length !== input.length) return null;
  // Strip signed URLs before persisting
  return sanitizeBlocksForStorage(parsed);
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
      action: "module_content_updated",
      blocks: input.blocks,
      actor_id: input.actorId,
      actor_email: input.actorEmail,
    })
    .select("id, module_slug, section_key, action, created_at, actor_email")
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
      action: data.action as AuditAction,
      createdAt: data.created_at as string,
      actorEmail: (data.actor_email as string | null) ?? null,
    },
  };
}

async function rollbackModuleSection(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  input: {
    moduleSlug: string;
    sectionKey: ModuleSectionKey;
    previousBlocks: unknown | null;
  },
) {
  if (input.previousBlocks) {
    await supabase.from("module_sections").upsert(
      {
        module_slug: input.moduleSlug,
        section_key: input.sectionKey,
        blocks: input.previousBlocks,
      },
      { onConflict: "module_slug,section_key" },
    );
    return;
  }

  await supabase
    .from("module_sections")
    .delete()
    .eq("module_slug", input.moduleSlug)
    .eq("section_key", input.sectionKey);
}

export async function saveModuleSection(
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

  const { data: previousRow } = await supabase
    .from("module_sections")
    .select("blocks")
    .eq("module_slug", moduleSlug)
    .eq("section_key", sectionKey)
    .maybeSingle();

  const { data, error } = await supabase
    .from("module_sections")
    .upsert(
      {
        module_slug: moduleSlug,
        section_key: sectionKey,
        blocks: parsed,
      },
      { onConflict: "module_slug,section_key" },
    )
    .select("updated_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to save changes." };
  }

  const audit = await insertAudit(supabase, {
    moduleSlug,
    sectionKey,
    blocks: parsed,
    actorId: user.id,
    actorEmail: user.email ?? null,
  });

  if (!audit.ok) {
    await rollbackModuleSection(supabase, {
      moduleSlug,
      sectionKey,
      previousBlocks: previousRow?.blocks ?? null,
    });
    return { ok: false, error: audit.error };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/m/${moduleSlug}`);

  return {
    ok: true,
    updatedAt: data.updated_at as string,
    blocks: parsed,
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

  if (error) return { ok: false, error: auditErrorMessage(error) };
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

  const { data: previousRow } = await supabase
    .from("module_sections")
    .select("blocks")
    .eq("module_slug", moduleSlug)
    .eq("section_key", sectionKey)
    .maybeSingle();

  const { data: upserted, error: upsertError } = await supabase
    .from("module_sections")
    .upsert(
      {
        module_slug: moduleSlug,
        section_key: sectionKey,
        blocks: parsed,
      },
      { onConflict: "module_slug,section_key" },
    )
    .select("updated_at")
    .single();

  if (upsertError || !upserted) {
    return { ok: false, error: upsertError?.message ?? "Failed to restore content." };
  }

  const audit = await insertAudit(supabase, {
    moduleSlug,
    sectionKey,
    blocks: parsed,
    actorId: user.id,
    actorEmail: user.email ?? null,
  });

  if (!audit.ok) {
    await rollbackModuleSection(supabase, {
      moduleSlug,
      sectionKey,
      previousBlocks: previousRow?.blocks ?? null,
    });
    return { ok: false, error: audit.error };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/m/${moduleSlug}`);

  return {
    ok: true,
    updatedAt: upserted.updated_at as string,
    blocks: parsed,
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
    .select("id, module_slug, section_key, action, created_at, actor_email")
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
      action: row.action as AuditAction,
      createdAt: row.created_at as string,
      actorEmail: (row.actor_email as string | null) ?? null,
    })),
  };
}

function sampleBlocks(): ContentBlock[] {
  return [
    {
      type: "bullets",
      title: "What this is",
      description: "Created by Setup & Diagnostics (non-destructive).",
      items: [
        "This content is safe to delete or overwrite from Content Studio.",
        "Use it to validate save/history/restore workflows end-to-end.",
      ],
    },
  ];
}

export async function diagnosticsSeedContent(
  moduleSlug: string,
  sectionKey: ModuleSectionKey,
): Promise<DiagnosticsResult> {
  const { supabase } = await requireAdmin();

  if (!isValidModuleSlug(moduleSlug)) {
    return { ok: false, error: "Unknown module slug." };
  }

  const { data: existing, error } = await supabase
    .from("module_sections")
    .select("id")
    .eq("module_slug", moduleSlug)
    .eq("section_key", sectionKey)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (existing) {
    return { ok: true, message: "Content already exists — skipped (not overwritten)." };
  }

  const saved = await saveModuleSection(moduleSlug, sectionKey, sampleBlocks());
  if (!saved.ok) return { ok: false, error: saved.error };

  return {
    ok: true,
    message: "Sample content created.",
    updatedAt: saved.updatedAt,
  };
}
