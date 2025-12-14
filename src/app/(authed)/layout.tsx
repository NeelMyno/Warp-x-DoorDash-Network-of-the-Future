import * as React from "react";

import { MODULES } from "@/config/modules";
import { requireUser } from "@/lib/auth/require-user";
import { AppShell } from "@/components/shell/AppShell";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role } = await requireUser();
  const email = user.email ?? "user";

  return (
    <AppShell userEmail={email} role={role} modules={MODULES}>
      {children}
    </AppShell>
  );
}
