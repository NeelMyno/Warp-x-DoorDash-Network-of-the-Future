"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { ModuleConfig } from "@/config/modules";
import type { UserRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IconGrid, IconShield, IconStack } from "@/components/icons";

function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-border bg-muted/70 text-foreground"
          : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-background/30 ring-1 ring-border">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}

export function Sidebar({
  role,
  modules,
}: {
  role: UserRole;
  modules: ModuleConfig[];
}) {
  const pathname = usePathname();
  const isPortalActive = pathname === "/";

  return (
    <aside className="flex flex-col gap-4 border-r border-border bg-background/35 p-4 backdrop-blur">
      <div className="flex items-center gap-3 px-2 pt-1">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-primary/20 bg-primary/10">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-none text-foreground">
            Warp x DoorDash
          </div>
          <div className="truncate text-xs text-muted-foreground">
            Network of the Future
          </div>
        </div>
      </div>

      <Separator className="opacity-60" />

      <nav className="space-y-1">
        <NavLink
          href="/"
          label="Portal"
          icon={<IconGrid className="h-4 w-4" />}
          active={isPortalActive}
        />

        <div className="pt-4">
          <div className="px-2 pb-2 text-xs font-medium text-muted-foreground">
            Modules
          </div>
          <div className="space-y-1">
            {modules.map((m) => (
              <NavLink
                key={m.slug}
                href={`/m/${m.slug}`}
                label={m.title}
                icon={<IconStack className="h-4 w-4" />}
                active={pathname.startsWith(`/m/${m.slug}`)}
              />
            ))}
          </div>
        </div>

        {role === "admin" ? (
          <div className="pt-4">
            <div className="px-2 pb-2 text-xs font-medium text-muted-foreground">
              Admin
            </div>
            <NavLink
              href="/admin"
              label="Admin"
              icon={<IconShield className="h-4 w-4" />}
              active={pathname === "/admin"}
            />
          </div>
        ) : null}
      </nav>

      <div className="mt-auto rounded-xl border border-border bg-muted/35 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Signed in as</span>
          <Badge
            variant={role === "admin" ? "accent" : "outline"}
            className="px-2 py-0.5 text-[11px]"
          >
            {role}
          </Badge>
        </div>
      </div>
    </aside>
  );
}

