import * as React from "react";

import { MODULES } from "@/config/modules";
import { requireUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/auth/get-profile";
import { AppShell } from "@/components/shell/AppShell";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user, role } = await requireUser();
  const profile = await getProfile(supabase, user.id);
  const email = user.email ?? profile?.email ?? "user";
  const fullName = profile?.fullName ?? null;

  return (
    <AppShell userEmail={email} userFullName={fullName} role={role} modules={MODULES}>
      {children}
    </AppShell>
  );
}
