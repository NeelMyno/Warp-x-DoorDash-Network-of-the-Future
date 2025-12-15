import * as React from "react";

import type { ModuleConfig } from "@/config/modules";
import type { UserRole } from "@/lib/auth/roles";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/app-shell/sidebar";
import { UserMenu } from "@/components/app-shell/user-menu";

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
    <div className="min-h-screen px-4 py-6">
      <div className="mx-auto max-w-[1400px]">
        <div
          className={cn(
            "grid min-h-[calc(100vh-3rem)] grid-cols-[260px_1fr] overflow-hidden",
            "rounded-[var(--warp-radius-lg)] border border-border bg-background/25 shadow-[var(--shadow-elev-2)] backdrop-blur",
          )}
        >
          <Sidebar role={role} modules={modules} />

          <div className="flex min-w-0 flex-col">
            <header className="flex items-center justify-between gap-4 border-b border-border bg-background/25 px-6 py-4 backdrop-blur">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">
                    Warp x DoorDash: Network of the Future Portal
                  </h1>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  Private, authenticated workspace
                </p>
              </div>

              <UserMenu
                email={userEmail}
                fullName={userFullName}
                role={role}
                signOutAction={signOut}
              />
            </header>

            <main className="flex-1 px-6 py-5">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
