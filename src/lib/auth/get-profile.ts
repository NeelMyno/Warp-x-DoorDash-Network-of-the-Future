import type { UserRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type ProfileRow = {
  id: string;
  role: UserRole;
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
      .select("id, role, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id as string,
      role: (data.role === "admin" ? "admin" : "user") as UserRole,
      createdAt: (data.created_at as string | null) ?? undefined,
      updatedAt: (data.updated_at as string | null) ?? undefined,
    };
  } catch {
    return null;
  }
}

