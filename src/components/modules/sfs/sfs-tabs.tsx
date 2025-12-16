"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type SfsTabKey = "overview" | "calculator";

function normalizeTab(value: unknown): SfsTabKey {
  if (value === "calculator") return "calculator";
  return "overview";
}

export function SfsTabs({ value }: { value: SfsTabKey }) {
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
        if (tab === "overview") params.delete("tab");
        else params.set("tab", tab);
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }}
    >
      <TabsList className="h-9">
        <TabsTrigger value="overview" className="text-xs">
          Overview
        </TabsTrigger>
        <TabsTrigger value="calculator" className="text-xs">
          Calculator
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

