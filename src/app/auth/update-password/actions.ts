"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionState = { error?: string };

export async function updatePasswordAction(
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

  if (!user) redirect("/login?reason=invalid-link");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    redirect("/login?reason=invalid-link");
  }

  const status =
    profile.status === "disabled"
      ? "disabled"
      : profile.status === "invited"
        ? "invited"
        : "active";

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) return { error: updateError.message };

  try {
    const admin = createAdminClient();
    await admin.from("user_admin_audit").insert({
      actor_id: user.id,
      actor_email: user.email ?? null,
      action: "password_reset_completed",
      target_user_id: user.id,
      target_email: user.email ?? null,
      metadata: { via: "recovery", status },
    });
  } catch (err) {
    console.error("Failed to write password_reset_completed audit row:", err);
  }

  if (status === "disabled") {
    await supabase.auth.signOut();
    redirect("/login?reason=disabled");
  }

  redirect("/account?pw=updated");
}

