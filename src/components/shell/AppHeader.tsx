import * as React from "react";

import type { UserRole } from "@/lib/auth/roles";
import { signOut } from "@/app/actions/auth";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { UserMenu } from "@/components/app-shell/user-menu";

export function AppHeader({
  userEmail,
  role,
}: {
  userEmail: string;
  role: UserRole;
}) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-background/20 px-6 py-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-4">
        <div className="sm:hidden">
          <BrandLogo size="sm" href="/" priority className="-ml-2" />
        </div>
        <div className="hidden sm:block">
          <BrandLogo size="md" href="/" priority className="-ml-2" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">
              Warp x DoorDash: Network of the Future
            </h1>
            <Badge
              variant="accent"
              className="hidden px-2 py-0.5 text-[11px] sm:inline-flex"
            >
              V1
            </Badge>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            Private, authenticated portal
          </p>
        </div>
      </div>

      <UserMenu email={userEmail} role={role} signOutAction={signOut} />
    </header>
  );
}
