"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type AdminTabKey = "content" | "users" | "setup";

function normalizeTab(value: unknown): AdminTabKey {
  if (value === "users") return "users";
  if (value === "setup") return "setup";
  return "content";
}

export function AdminTabs({ value }: { value: AdminTabKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = normalizeTab(value);

  return (
    <Tabs
      value={active}
      onValueChange={(next) => {
        const tab = normalizeTab(next);
        const params = new URLSearchParams(searchParams.toString());
        if (tab === "content") params.delete("tab");
        else params.set("tab", tab);
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }}
    >
      <TabsList className="h-9 shadow-[var(--warp-shadow-elev-1)]">
        <TabsTrigger value="content" className="text-xs">
          Content Studio
        </TabsTrigger>
        <TabsTrigger value="users" className="text-xs">
          Users
        </TabsTrigger>
        <TabsTrigger value="setup" className="text-xs">
          Setup & Diagnostics
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
