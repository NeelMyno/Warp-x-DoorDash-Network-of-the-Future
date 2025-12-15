"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionState = { error?: string };

export async function setPassword(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) return { error: updateError.message };

  const fullNameFromMetadata = (() => {
    const metadata = user.user_metadata as Record<string, unknown> | null;
    const value = metadata?.full_name;
    return typeof value === "string" && value.trim() ? value.trim() : null;
  })();

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("full_name, status")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile?.status === "disabled") {
    await supabase.auth.signOut();
    redirect("/login?reason=disabled");
  }

  const patch: Record<string, unknown> = {
    status: "active",
  };

  if (!existingProfile?.full_name && fullNameFromMetadata) {
    patch.full_name = fullNameFromMetadata;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id);

  if (profileError) {
    return {
      error:
        "Password was set, but your profile could not be activated. Ask an admin to verify profiles policies and re-try.",
    };
  }

  try {
    const admin = createAdminClient();
    await admin.from("user_admin_audit").insert({
      actor_id: user.id,
      actor_email: user.email ?? null,
      action: "password_set",
      target_user_id: user.id,
      target_email: user.email ?? null,
      metadata: { via: "invite" },
    });
  } catch {
    // Best-effort: never block onboarding if audit logging is misconfigured.
  }

  redirect("/");
}
