import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import type { UserRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function getUserRole(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<UserRole> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (error) return "user";
    return data?.role === "admin" ? "admin" : "user";
  } catch {
    return "user";
  }
}

export async function requireUser(): Promise<{
  supabase: SupabaseServerClient;
  user: User;
  role: UserRole;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = await getUserRole(supabase, user.id);

  return { supabase, user, role };
}

export async function requireAdmin() {
  const result = await requireUser();
  if (result.role !== "admin") notFound();
  return result;
}
