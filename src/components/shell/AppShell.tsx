import * as React from "react";

import type { ModuleConfig } from "@/config/modules";
import type { UserRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/shell/AppHeader";
import { PageShell } from "@/components/shell/PageShell";
import { SidebarNav } from "@/components/shell/SidebarNav";

export function AppShell({
  userEmail,
  userFullName,
  role,
  modules,
  children,
}: {
  userEmail: string;
  userFullName: string | null;
  role: UserRole;
  modules: ModuleConfig[];
  children: React.ReactNode;
}) {
  return (
    <PageShell>
      <div
        className={cn(
          "grid min-h-[calc(100vh_-_var(--warp-shell-pad)_*_2)] grid-cols-[268px_1fr] overflow-hidden",
          "rounded-[var(--warp-radius-xl)] border border-border bg-background/18 shadow-[var(--warp-shadow-elev-3)] backdrop-blur",
        )}
      >
        <SidebarNav role={role} modules={modules} />

        <div className="flex min-w-0 flex-col">
          <AppHeader userEmail={userEmail} userFullName={userFullName} role={role} />
          <main className="flex-1 px-6 py-5">{children}</main>
        </div>
      </div>
    </PageShell>
  );
}
