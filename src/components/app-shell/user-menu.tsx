"use client";

import * as React from "react";
import Link from "next/link";

import type { UserRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconChevronDown, IconLogOut, IconUser } from "@/components/icons";

function getInitials(input: { fullName: string | null; email: string }) {
  const fullName = input.fullName?.trim();
  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0]?.[0] ?? "U";
      const b = parts[parts.length - 1]?.[0] ?? "S";
      return `${a}${b}`.toUpperCase();
    }
    return parts[0]!.slice(0, 2).toUpperCase();
  }

  const base = input.email.split("@")[0] ?? "user";
  return base.slice(0, 2).toUpperCase();
}

export function UserMenu({
  email,
  fullName,
  role,
  signOutAction,
}: {
  email: string;
  fullName: string | null;
  role: UserRole;
  signOutAction: () => Promise<void>;
}) {
  const displayName = fullName?.trim() ? fullName.trim() : email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "group inline-flex items-center gap-3 rounded-xl border border-border bg-background/35 px-3 py-2 text-left backdrop-blur transition-colors",
            "hover:bg-background/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <span className="grid h-9 w-9 place-items-center rounded-full border border-border bg-muted/60 text-xs font-semibold text-foreground">
            {getInitials({ fullName, email })}
          </span>
          <span className="hidden min-w-0 flex-col sm:flex">
            <span className="truncate text-sm font-medium leading-tight text-foreground">
              {displayName}
            </span>
            <span className="text-xs text-muted-foreground">Account</span>
          </span>
          <span className="ml-1 grid h-6 w-6 place-items-center rounded-lg border border-border bg-background/40 text-muted-foreground">
            <IconChevronDown className="h-4 w-4" />
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <div className="truncate text-xs font-medium text-foreground">
              {displayName}
            </div>
            <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
              {email}
            </div>
          </span>
          <Badge
            variant={role === "admin" ? "accent" : "muted"}
            className="px-2 py-0.5 text-[11px]"
          >
            {role}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account" className="flex w-full items-center justify-between">
            <span>Account</span>
            <IconUser className="h-4 w-4 text-muted-foreground" />
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button
              type="submit"
              className="flex w-full items-center justify-between"
            >
              <span>Sign out</span>
              <IconLogOut className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
