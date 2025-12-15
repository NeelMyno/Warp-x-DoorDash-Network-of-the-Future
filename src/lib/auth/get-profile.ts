import type { UserRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type ProfileRow = {
  id: string;
  role: UserRole;
  status?: "active" | "invited" | "disabled";
  email?: string;
  fullName?: string;
  invitedAt?: string;
  invitedBy?: string;
  disabledAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function getProfile(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<ProfileRow | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, role, status, email, full_name, invited_at, invited_by, disabled_at, created_at, updated_at",
      )
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id as string,
      role: (data.role === "admin" ? "admin" : "user") as UserRole,
      status:
        data.status === "invited"
          ? "invited"
          : data.status === "disabled"
            ? "disabled"
            : "active",
      email: (data.email as string | null) ?? undefined,
      fullName: (data.full_name as string | null) ?? undefined,
      invitedAt: (data.invited_at as string | null) ?? undefined,
      invitedBy: (data.invited_by as string | null) ?? undefined,
      disabledAt: (data.disabled_at as string | null) ?? undefined,
      createdAt: (data.created_at as string | null) ?? undefined,
      updatedAt: (data.updated_at as string | null) ?? undefined,
    };
  } catch {
    return null;
  }
}
