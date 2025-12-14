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

function getInitials(email: string) {
  const base = email.split("@")[0] ?? "user";
  return base.slice(0, 2).toUpperCase();
}

export function UserMenu({
  email,
  role,
  signOutAction,
}: {
  email: string;
  role: UserRole;
  signOutAction: () => Promise<void>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "group inline-flex items-center gap-3 rounded-xl border border-border bg-background/35 px-3 py-2 text-left shadow-[var(--shadow-elev-1)] backdrop-blur transition-colors",
            "hover:bg-background/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <span className="grid h-9 w-9 place-items-center rounded-full border border-border bg-muted/60 text-xs font-semibold text-foreground">
            {getInitials(email)}
          </span>
          <span className="hidden min-w-0 flex-col sm:flex">
            <span className="truncate text-sm font-medium leading-tight text-foreground">
              {email}
            </span>
            <span className="text-xs text-muted-foreground">Account</span>
          </span>
          <span className="ml-1 grid h-6 w-6 place-items-center rounded-lg border border-border bg-background/40 text-muted-foreground">
            <IconChevronDown className="h-4 w-4" />
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="flex items-center justify-between gap-3">
          <span className="truncate">{email}</span>
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
