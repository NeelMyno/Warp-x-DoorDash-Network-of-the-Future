"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

const INVITE_OPS_PER_ACTOR_PER_DAY = 50;
const INVITE_OPS_PER_TARGET_PER_DAY = 5;
const INVITE_OPS_PER_TARGET_COOLDOWN_MIN = 10;

const PASSWORD_RESET_EMAILS_PER_ACTOR_WINDOW = 10;
const PASSWORD_RESET_EMAILS_ACTOR_WINDOW_MIN = 10;
const PASSWORD_RESET_EMAILS_PER_TARGET_WINDOW = 3;
const PASSWORD_RESET_EMAILS_TARGET_WINDOW_MIN = 30;

type InviteRole = "user" | "admin";

type InviteErrorCode = "already_invited" | "already_active" | "disabled";

type InviteResult =
  | { ok: true; userId: string; email: string }
  | {
      ok: false;
      error: string;
      code?: InviteErrorCode;
      targetUserId?: string;
      targetEmail?: string;
    };

type ActionResult = { ok: true; message: string } | { ok: false; error: string };

type GenerateLinkResult =
  | { ok: true; link: string }
  | { ok: false; error: string };

type InviteOpAction = "invite_sent" | "invite_resent" | "invite_link_generated";

const INVITE_OP_ACTIONS: InviteOpAction[] = [
  "invite_sent",
  "invite_resent",
  "invite_link_generated",
];

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  // Basic sanity check; Supabase will validate further.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    "http://localhost:1130"
  );
}

function isInviteRole(value: string): value is InviteRole {
  return value === "user" || value === "admin";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function auditUnavailableMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : null;
  if (message?.toLowerCase().includes("relation") || message?.toLowerCase().includes("does not exist")) {
    return "Audit log table is missing. Run supabase/sql/06_user_admin_audit.sql in Supabase SQL editor.";
  }
  return (
    message ??
    "Audit log is not available. Run supabase/sql/06_user_admin_audit.sql in Supabase SQL editor."
  );
}

async function enforceInviteRateLimits(input: {
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"];
  actorId: string;
  targetEmail: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const { count: actorCount, error: actorError } = await input.supabase
      .from("user_admin_audit")
      .select("id", { count: "exact", head: true })
      .eq("actor_id", input.actorId)
      .in("action", INVITE_OP_ACTIONS)
      .gte("created_at", since);

    if (actorError) return { ok: false, error: auditUnavailableMessage(actorError) };
    if ((actorCount ?? 0) >= INVITE_OPS_PER_ACTOR_PER_DAY) {
      return { ok: false, error: "Invite limit reached for today. Try again tomorrow." };
    }

    const { count: targetCount, error: targetError } = await input.supabase
      .from("user_admin_audit")
      .select("id", { count: "exact", head: true })
      .eq("target_email", input.targetEmail)
      .in("action", INVITE_OP_ACTIONS)
      .gte("created_at", since);

    if (targetError) return { ok: false, error: auditUnavailableMessage(targetError) };
    if ((targetCount ?? 0) >= INVITE_OPS_PER_TARGET_PER_DAY) {
      return {
        ok: false,
        error: "Too many invites to this email today. Try again tomorrow.",
      };
    }

    const { data: last, error: lastError } = await input.supabase
      .from("user_admin_audit")
      .select("created_at")
      .eq("target_email", input.targetEmail)
      .in("action", INVITE_OP_ACTIONS)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastError) return { ok: false, error: auditUnavailableMessage(lastError) };

    const lastAt = typeof last?.created_at === "string" ? Date.parse(last.created_at) : NaN;
    if (Number.isFinite(lastAt)) {
      const remainingMs =
        INVITE_OPS_PER_TARGET_COOLDOWN_MIN * 60_000 - (Date.now() - lastAt);
      if (remainingMs > 0) {
        const remainingMin = Math.max(1, Math.ceil(remainingMs / 60_000));
        return {
          ok: false,
          error: `Too many invite actions for this email recently. Try again in ${remainingMin} minute(s).`,
        };
      }
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: auditUnavailableMessage(err) };
  }
}

async function enforcePasswordResetRateLimits(input: {
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"];
  actorId: string;
  targetUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string; reason: "actor_rate_limited" | "target_rate_limited" }> {
  try {
    const actorSince = new Date(
      Date.now() - PASSWORD_RESET_EMAILS_ACTOR_WINDOW_MIN * 60_000,
    ).toISOString();

    const { count: actorCount, error: actorError } = await input.supabase
      .from("user_admin_audit")
      .select("id", { count: "exact", head: true })
      .eq("actor_id", input.actorId)
      .eq("action", "password_reset_sent")
      .gte("created_at", actorSince);

    if (actorError) {
      return { ok: false, error: auditUnavailableMessage(actorError), reason: "actor_rate_limited" };
    }

    if ((actorCount ?? 0) >= PASSWORD_RESET_EMAILS_PER_ACTOR_WINDOW) {
      return {
        ok: false,
        error: "Too many reset emails sent recently. Try again in a few minutes.",
        reason: "actor_rate_limited",
      };
    }

    const targetSince = new Date(
      Date.now() - PASSWORD_RESET_EMAILS_TARGET_WINDOW_MIN * 60_000,
    ).toISOString();

    const { count: targetCount, error: targetError } = await input.supabase
      .from("user_admin_audit")
      .select("id", { count: "exact", head: true })
      .eq("target_user_id", input.targetUserId)
      .eq("action", "password_reset_sent")
      .gte("created_at", targetSince);

    if (targetError) {
      return { ok: false, error: auditUnavailableMessage(targetError), reason: "target_rate_limited" };
    }

    if ((targetCount ?? 0) >= PASSWORD_RESET_EMAILS_PER_TARGET_WINDOW) {
      return {
        ok: false,
        error: "Please wait before sending another reset email.",
        reason: "target_rate_limited",
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: auditUnavailableMessage(err),
      reason: "actor_rate_limited",
    };
  }
}

async function insertUserAudit(input: {
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"];
  actorId: string;
  actorEmail: string | null;
  action:
    | "invite_sent"
    | "invite_resent"
    | "invite_link_generated"
    | "invite_cancelled"
    | "name_changed"
    | "password_reset_sent"
    | "password_reset_blocked"
    | "password_set"
    | "role_changed"
    | "status_changed"
    | "user_deleted";
  targetUserId: string | null;
  targetEmail: string | null;
  metadata: Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await input.supabase.from("user_admin_audit").insert({
    actor_id: input.actorId,
    actor_email: input.actorEmail,
    action: input.action,
    target_user_id: input.targetUserId,
    target_email: input.targetEmail,
    metadata: input.metadata,
  });

  if (error) return { ok: false, error: auditUnavailableMessage(error) };
  return { ok: true };
}

export async function sendPasswordResetLinkAction(input: {
  targetProfileId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await requireAdmin();

  const targetProfileId = String(input.targetProfileId ?? "").trim();
  if (!isUuid(targetProfileId)) return { ok: false, error: "Invalid user id." };

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, email, status")
    .eq("id", targetProfileId)
    .maybeSingle();

  if (targetError || !target) {
    return { ok: false, error: "User profile no longer exists." };
  }

  const rawEmail = typeof target.email === "string" ? target.email : "";
  const email = rawEmail.trim();
  const status =
    target.status === "disabled"
      ? "disabled"
      : target.status === "invited"
        ? "invited"
        : "active";

  async function logBlocked(reason: string) {
    try {
      const audit = await insertUserAudit({
        supabase,
        actorId: user.id,
        actorEmail: user.email ?? null,
        action: "password_reset_blocked",
        targetUserId: targetProfileId,
        targetEmail: email || rawEmail ? (email || rawEmail) : null,
        metadata: { reason, email: email || rawEmail || null, status },
      });
      if (!audit.ok) {
        console.error("Failed to write password_reset_blocked audit row:", audit.error);
      }
    } catch (err) {
      console.error("Failed to write password_reset_blocked audit row:", err);
    }
  }

  if (!email || !isValidEmail(email)) {
    await logBlocked("no_email");
    return { ok: false, error: "This user has no valid email on file." };
  }

  const limits = await enforcePasswordResetRateLimits({
    supabase,
    actorId: user.id,
    targetUserId: targetProfileId,
  });

  if (!limits.ok) {
    await logBlocked(limits.reason);
    return { ok: false, error: limits.error };
  }

  const redirectTo = `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(
    "/auth/update-password",
  )}`;

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      await logBlocked("send_failed");
      return { ok: false, error: error.message ?? "Failed to send reset email." };
    }
  } catch (err) {
    await logBlocked("send_failed");
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : null;
    return { ok: false, error: message ?? "Failed to send reset email." };
  }

  try {
    const audit = await insertUserAudit({
      supabase,
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: "password_reset_sent",
      targetUserId: targetProfileId,
      targetEmail: email,
      metadata: { email, status },
    });
    if (!audit.ok) {
      console.error("Failed to write password_reset_sent audit row:", audit.error);
    }
  } catch (err) {
    console.error("Failed to write password_reset_sent audit row:", err);
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function updateUserFullNameAction(input: {
  targetProfileId: string;
  fullName: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await requireAdmin();

  const targetProfileId = String(input.targetProfileId ?? "").trim();
  const rawFullName = String(input.fullName ?? "");

  if (!isUuid(targetProfileId)) return { ok: false, error: "Invalid user id." };

  if (rawFullName.includes("\n") || rawFullName.includes("\r")) {
    return { ok: false, error: "Full name must be a single line." };
  }

  const fullName = rawFullName.trim();
  if (!fullName || fullName.length > 80) {
    return { ok: false, error: "Full name must be 1–80 characters." };
  }

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", targetProfileId)
    .maybeSingle();

  if (targetError || !target) {
    return { ok: false, error: "User profile no longer exists." };
  }

  const before = typeof target.full_name === "string" ? target.full_name : null;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", targetProfileId);

  if (updateError) return { ok: false, error: updateError.message };

  try {
    const audit = await insertUserAudit({
      supabase,
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: "name_changed",
      targetUserId: targetProfileId,
      targetEmail: typeof target.email === "string" ? target.email : null,
      metadata: {
        before_full_name: before,
        after_full_name: fullName,
      },
    });
    if (!audit.ok) {
      console.error("Failed to write name_changed audit row:", audit.error);
    }
  } catch (err) {
    console.error("Failed to write name_changed audit row:", err);
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function invitePortalUser(input: {
  email: string;
  fullName: string;
  role: string;
}): Promise<InviteResult> {
  const { supabase, user } = await requireAdmin();

  const email = normalizeEmail(input.email ?? "");
  const fullName = String(input.fullName ?? "").trim();
  const role = String(input.role ?? "").trim();

  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email." };
  if (fullName.length < 2 || fullName.length > 120) {
    return { ok: false, error: "Full name must be 2–120 characters." };
  }
  if (!isInviteRole(role)) return { ok: false, error: "Invalid role." };

  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("id, status, role, email")
    .eq("email", email)
    .maybeSingle();

  if (!existingError && existing?.id) {
    const status =
      existing.status === "invited"
        ? "invited"
        : existing.status === "disabled"
          ? "disabled"
          : "active";

    if (status === "invited") {
      return {
        ok: false,
        code: "already_invited",
        targetUserId: String(existing.id),
        targetEmail: String(existing.email ?? email),
        error: "This email is already invited.",
      };
    }
    if (status === "disabled") {
      return {
        ok: false,
        code: "disabled",
        targetUserId: String(existing.id),
        targetEmail: String(existing.email ?? email),
        error: "This user is disabled.",
      };
    }
    return {
      ok: false,
      code: "already_active",
      targetUserId: String(existing.id),
      targetEmail: String(existing.email ?? email),
      error: "This user is already active.",
    };
  }

  const limits = await enforceInviteRateLimits({
    supabase,
    actorId: user.id,
    targetEmail: email,
  });
  if (!limits.ok) return { ok: false, error: limits.error };

  const redirectTo = `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(
    "/auth/set-password",
  )}`;

  let invitedUserId: string | null = null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name: fullName },
    });

    if (error) {
      const msg = error.message ?? "Failed to send invite.";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exists")) {
        return {
          ok: false,
          error:
            "User already exists in Supabase Auth. Ask an admin to manage their profile/role instead of re-inviting.",
        };
      }
      return { ok: false, error: msg };
    }

    invitedUserId = (data?.user?.id as string | undefined) ?? null;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : null;
    return { ok: false, error: message ?? "Failed to send invite." };
  }

  if (!invitedUserId) {
    return { ok: false, error: "Invite was sent, but no user id was returned." };
  }

  const now = new Date().toISOString();
  const { error: upsertError } = await supabase.from("profiles").upsert(
    {
      id: invitedUserId,
      email,
      full_name: fullName,
      role,
      status: "invited",
      invited_at: now,
      invited_by: user.id,
    },
    { onConflict: "id" },
  );

  if (upsertError) {
    return {
      ok: false,
      error:
        "Invite email was sent, but the profile could not be updated. Verify supabase/sql/04_user_invites.sql was applied and re-try.",
    };
  }

  const audit = await insertUserAudit({
    supabase,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "invite_sent",
    targetUserId: invitedUserId,
    targetEmail: email,
    metadata: { role, full_name: fullName },
  });
  if (!audit.ok) return { ok: false, error: audit.error };

  revalidatePath("/admin");
  return { ok: true, userId: invitedUserId, email };
}

export async function resendInvite(targetUserId: string): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();
  if (!isUuid(targetUserId)) return { ok: false, error: "Invalid user id." };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status")
    .eq("id", targetUserId)
    .maybeSingle();

  if (error || !profile) return { ok: false, error: "User not found." };
  if (profile.status !== "invited") {
    return { ok: false, error: "Invite can only be resent for invited users." };
  }
  const email = typeof profile.email === "string" ? profile.email : null;
  if (!email) return { ok: false, error: "This user has no email on file." };

  const limits = await enforceInviteRateLimits({
    supabase,
    actorId: user.id,
    targetEmail: email,
  });
  if (!limits.ok) return { ok: false, error: limits.error };

  const redirectTo = `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(
    "/auth/set-password",
  )}`;

  try {
    const admin = createAdminClient();
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data:
        typeof profile.full_name === "string" && profile.full_name.trim()
          ? { full_name: profile.full_name.trim() }
          : undefined,
    });

    if (inviteError) return { ok: false, error: inviteError.message ?? "Failed to resend invite." };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : null;
    return { ok: false, error: message ?? "Failed to resend invite." };
  }

  const audit = await insertUserAudit({
    supabase,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "invite_resent",
    targetUserId,
    targetEmail: email,
    metadata: {},
  });
  if (!audit.ok) return { ok: false, error: audit.error };

  revalidatePath("/admin");
  return { ok: true, message: `Invite resent to ${email}.` };
}

export async function generateInviteLink(
  targetUserId: string,
): Promise<GenerateLinkResult> {
  const { supabase, user } = await requireAdmin();
  if (!isUuid(targetUserId)) return { ok: false, error: "Invalid user id." };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, status")
    .eq("id", targetUserId)
    .maybeSingle();

  if (error || !profile) return { ok: false, error: "User not found." };
  if (profile.status !== "invited") {
    return { ok: false, error: "Invite links can only be generated for invited users." };
  }
  const email = typeof profile.email === "string" ? profile.email : null;
  if (!email) return { ok: false, error: "This user has no email on file." };

  const limits = await enforceInviteRateLimits({
    supabase,
    actorId: user.id,
    targetEmail: email,
  });
  if (!limits.ok) return { ok: false, error: limits.error };

  const redirectTo = `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(
    "/auth/set-password",
  )}`;

  try {
    const admin = createAdminClient();
    const { data, error: genError } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    });

    if (genError) {
      return {
        ok: false,
        error:
          genError.message ??
          "Invite link generation failed. Use resend invite email instead.",
      };
    }

    const link = data?.properties?.action_link;
    if (typeof link !== "string" || !link) {
      return {
        ok: false,
        error:
          "Invite link generation returned no link. Use resend invite email instead.",
      };
    }

    const audit = await insertUserAudit({
      supabase,
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: "invite_link_generated",
      targetUserId,
      targetEmail: email,
      metadata: {},
    });
    if (!audit.ok) return { ok: false, error: audit.error };

    revalidatePath("/admin");
    return { ok: true, link };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : null;
    return {
      ok: false,
      error:
        message ??
        "Invite link generation is not supported in this environment. Use resend invite email instead.",
    };
  }
}

export async function cancelInvite(targetUserId: string): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();
  if (!isUuid(targetUserId)) return { ok: false, error: "Invalid user id." };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, status")
    .eq("id", targetUserId)
    .maybeSingle();

  if (error || !profile) return { ok: false, error: "User not found." };
  if (profile.status !== "invited") {
    return { ok: false, error: "Only invited users can be cancelled." };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ status: "disabled", disabled_at: now })
    .eq("id", targetUserId);

  if (updateError) return { ok: false, error: updateError.message };

  const audit = await insertUserAudit({
    supabase,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "invite_cancelled",
    targetUserId,
    targetEmail: typeof profile.email === "string" ? profile.email : null,
    metadata: { status_from: "invited", status_to: "disabled" },
  });
  if (!audit.ok) return { ok: false, error: audit.error };

  revalidatePath("/admin");
  return { ok: true, message: "Invite cancelled (user disabled)." };
}

async function countActiveAdmins(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"]) {
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("status", "active");

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, count: count ?? 0 };
}

async function ensureNotLastActiveAdmin(input: {
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"];
  targetRole: string | null;
  targetStatus: string | null;
}) {
  const isActiveAdmin = input.targetRole === "admin" && input.targetStatus === "active";
  if (!isActiveAdmin) return { ok: true as const };

  const countRes = await countActiveAdmins(input.supabase);
  if (!countRes.ok) return { ok: false as const, error: countRes.error };

  if (countRes.count <= 1) {
    return { ok: false as const, error: "You can’t remove the last active admin." };
  }

  return { ok: true as const };
}

export async function setUserRole(
  targetUserId: string,
  nextRole: InviteRole,
): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();
  if (!isUuid(targetUserId)) return { ok: false, error: "Invalid user id." };
  if (!isInviteRole(nextRole)) return { ok: false, error: "Invalid role." };

  if (user.id === targetUserId) {
    return { ok: false, error: "You can’t change your own role." };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, role, status")
    .eq("id", targetUserId)
    .maybeSingle();

  if (error || !profile) return { ok: false, error: "User not found." };

  const currentRole = profile.role === "admin" ? "admin" : "user";
  const currentStatus =
    profile.status === "invited"
      ? "invited"
      : profile.status === "disabled"
        ? "disabled"
        : "active";

  if (currentRole === nextRole) {
    return { ok: true, message: "Role is already up to date." };
  }

  const lastAdminCheck =
    currentRole === "admin" && currentStatus === "active" && nextRole !== "admin"
      ? await ensureNotLastActiveAdmin({
          supabase,
          targetRole: currentRole,
          targetStatus: currentStatus,
        })
      : { ok: true as const };

  if (!lastAdminCheck.ok) return { ok: false, error: lastAdminCheck.error };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ role: nextRole })
    .eq("id", targetUserId);

  if (updateError) return { ok: false, error: updateError.message };

  const audit = await insertUserAudit({
    supabase,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "role_changed",
    targetUserId,
    targetEmail: typeof profile.email === "string" ? profile.email : null,
    metadata: { from_role: currentRole, to_role: nextRole },
  });
  if (!audit.ok) return { ok: false, error: audit.error };

  revalidatePath("/admin");
  return { ok: true, message: `Role updated to ${nextRole}.` };
}

export async function setUserStatus(
  targetUserId: string,
  nextStatus: "active" | "disabled",
): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();
  if (!isUuid(targetUserId)) return { ok: false, error: "Invalid user id." };

  if (user.id === targetUserId) {
    return { ok: false, error: "You can’t change your own status." };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, role, status")
    .eq("id", targetUserId)
    .maybeSingle();

  if (error || !profile) return { ok: false, error: "User not found." };

  const currentRole = profile.role === "admin" ? "admin" : "user";
  const currentStatus =
    profile.status === "invited"
      ? "invited"
      : profile.status === "disabled"
        ? "disabled"
        : "active";

  if (nextStatus === "disabled") {
    if (currentStatus === "disabled") {
      return { ok: true, message: "User is already disabled." };
    }

    const lastAdmin = await ensureNotLastActiveAdmin({
      supabase,
      targetRole: currentRole,
      targetStatus: currentStatus,
    });
    if (!lastAdmin.ok) return { ok: false, error: lastAdmin.error };

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ status: "disabled", disabled_at: now })
      .eq("id", targetUserId);

    if (updateError) return { ok: false, error: updateError.message };

    try {
      const admin = createAdminClient();
      await admin.auth.admin.updateUserById(targetUserId, { ban_duration: "876000h" });
    } catch {
      // Best-effort session revocation; middleware will enforce disabled status on next request.
    }

    const audit = await insertUserAudit({
      supabase,
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: "status_changed",
      targetUserId,
      targetEmail: typeof profile.email === "string" ? profile.email : null,
      metadata: {
        from_status: currentStatus,
        to_status: "disabled",
        reason: "admin_action",
      },
    });
    if (!audit.ok) return { ok: false, error: audit.error };

    revalidatePath("/admin");
    return { ok: true, message: "User disabled. They’ll be signed out on their next request." };
  }

  if (currentStatus === "active") {
    return { ok: true, message: "User is already active." };
  }

  if (currentStatus === "invited") {
    return {
      ok: false,
      error: "Invited users become active after they create a password. Use invite ops instead.",
    };
  }

  // Enabling a disabled user: only mark active if they've set a password before.
  let hasPasswordSet = false;
  try {
    const { data: pw, error: pwError } = await supabase
      .from("user_admin_audit")
      .select("id")
      .eq("action", "password_set")
      .eq("target_user_id", targetUserId)
      .limit(1)
      .maybeSingle();

    if (!pwError && pw?.id) hasPasswordSet = true;
  } catch {
    hasPasswordSet = false;
  }

  const resolvedStatus = hasPasswordSet ? "active" : "invited";
  const { error: enableError } = await supabase
    .from("profiles")
    .update({ status: resolvedStatus, disabled_at: null })
    .eq("id", targetUserId);

  if (enableError) return { ok: false, error: enableError.message };

  try {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(targetUserId, { ban_duration: "none" });
  } catch {
    // Best-effort unban.
  }

  const audit = await insertUserAudit({
    supabase,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "status_changed",
    targetUserId,
    targetEmail: typeof profile.email === "string" ? profile.email : null,
    metadata: {
      from_status: currentStatus,
      to_status: resolvedStatus,
      reason: "admin_action",
    },
  });
  if (!audit.ok) return { ok: false, error: audit.error };

  revalidatePath("/admin");
  if (resolvedStatus === "active") {
    return { ok: true, message: "User enabled and restored to active." };
  }
  return {
    ok: true,
    message:
      "User enabled, but they haven’t set a password yet. Resend an invite so they can finish setup.",
  };
}

export async function deleteUser(targetUserId: string): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();
  if (!isUuid(targetUserId)) return { ok: false, error: "Invalid user id." };

  if (user.id === targetUserId) {
    return { ok: false, error: "You can’t delete your own account." };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, role, status")
    .eq("id", targetUserId)
    .maybeSingle();

  if (error || !profile) return { ok: false, error: "User not found." };

  const currentRole = profile.role === "admin" ? "admin" : "user";
  const currentStatus =
    profile.status === "invited"
      ? "invited"
      : profile.status === "disabled"
        ? "disabled"
        : "active";

  const lastAdmin = await ensureNotLastActiveAdmin({
    supabase,
    targetRole: currentRole,
    targetStatus: currentStatus,
  });
  if (!lastAdmin.ok) return { ok: false, error: lastAdmin.error };

  // Insert audit row before deleting the auth user (FK will be set null after delete).
  const audit = await insertUserAudit({
    supabase,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "user_deleted",
    targetUserId,
    targetEmail: typeof profile.email === "string" ? profile.email : null,
    metadata: { from_role: currentRole, from_status: currentStatus },
  });
  if (!audit.ok) return { ok: false, error: audit.error };

  try {
    const admin = createAdminClient();
    const { error: deleteError } = await admin.auth.admin.deleteUser(targetUserId);
    if (deleteError) return { ok: false, error: deleteError.message ?? "Failed to delete user." };

    // Best-effort profile cleanup (FK cascade should remove it).
    await admin.from("profiles").delete().eq("id", targetUserId);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : null;
    return { ok: false, error: message ?? "Failed to delete user." };
  }

  revalidatePath("/admin");
  return { ok: true, message: "User deleted." };
}
