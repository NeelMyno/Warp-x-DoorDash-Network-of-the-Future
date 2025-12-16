import * as React from "react";

import type { ModuleRegistryEntry } from "@/lib/modules/registry";
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
  modules: ModuleRegistryEntry[];
  children: React.ReactNode;
}) {
  return (
    <PageShell className="h-dvh min-h-0 overflow-hidden">
      <div
        className={cn(
          "grid h-[calc(100dvh_-_var(--warp-shell-pad)_*_2)] min-h-0 grid-cols-[268px_1fr] overflow-hidden",
          "rounded-[var(--warp-radius-xl)] border border-border bg-background/18 backdrop-blur",
        )}
      >
        <SidebarNav role={role} modules={modules} />

        <div className="flex min-h-0 min-w-0 flex-col">
          <AppHeader userEmail={userEmail} userFullName={userFullName} role={role} />
          <main className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {children}
          </main>
        </div>
      </div>
    </PageShell>
  );
}
