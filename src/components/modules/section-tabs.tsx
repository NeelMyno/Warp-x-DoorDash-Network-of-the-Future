"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { MODULE_SECTIONS, type ModuleSectionKey } from "@/config/modules";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SectionTabs({ value }: { value: ModuleSectionKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("section", next);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }}
    >
      <TabsList className="shadow-[var(--warp-shadow-elev-1)]">
        {MODULE_SECTIONS.map((s) => (
          <TabsTrigger key={s.key} value={s.key}>
            {s.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
