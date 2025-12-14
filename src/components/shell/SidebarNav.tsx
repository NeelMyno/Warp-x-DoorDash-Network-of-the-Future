"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { ModuleConfig } from "@/config/modules";
import type { UserRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IconGrid, IconShield, IconStack, IconUser } from "@/components/icons";
import { BrandLogo } from "@/components/brand/BrandLogo";

function SidebarItem({
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
        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "bg-muted/55 text-foreground shadow-[var(--shadow-elev-1)]"
          : "text-muted-foreground hover:bg-muted/35 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "grid h-9 w-9 place-items-center rounded-xl border bg-background/25",
          active ? "border-primary/20 text-primary" : "border-border text-foreground/80",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {active ? (
        <span className="absolute right-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary" />
      ) : null}
    </Link>
  );
}

export function SidebarNav({
  role,
  modules,
}: {
  role: UserRole;
  modules: ModuleConfig[];
}) {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col gap-4 border-r border-border bg-background/28 p-4 backdrop-blur">
      <div className="px-1 pt-1">
        <BrandLogo size="sm" href="/" className="-ml-2" />
        <div className="px-2 pt-1 text-xs text-muted-foreground">
          DoorDash Portal
        </div>
      </div>

      <Separator className="opacity-60" />

      <nav className="space-y-1">
        <SidebarItem
          href="/"
          label="Portal"
          icon={<IconGrid className="h-4 w-4" />}
          active={pathname === "/"}
        />

        <div className="pt-4">
          <div className="px-2 pb-2 text-xs font-medium text-muted-foreground">
            Modules
          </div>
          <div className="space-y-1">
            {modules.map((m) => (
              <SidebarItem
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
            <SidebarItem
              href="/admin"
              label="Admin"
              icon={<IconShield className="h-4 w-4" />}
              active={pathname === "/admin"}
            />
          </div>
        ) : null}

        <div className="pt-4">
          <div className="px-2 pb-2 text-xs font-medium text-muted-foreground">
            Account
          </div>
          <SidebarItem
            href="/account"
            label="Account"
            icon={<IconUser className="h-4 w-4" />}
            active={pathname === "/account"}
          />
        </div>
      </nav>

      <div className="mt-auto rounded-2xl border border-border bg-muted/25 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Role</span>
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
