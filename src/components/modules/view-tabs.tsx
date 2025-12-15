"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  type ModuleContentView,
} from "@/lib/content/module-content-view";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ModuleViewTabs({
  value,
  draftExists,
}: {
  value: ModuleContentView;
  draftExists: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("view", next);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }}
    >
      <TabsList className={cn("h-9 shadow-[var(--warp-shadow-elev-1)]")}>
        <TabsTrigger value="published" className="text-xs">
          Published
        </TabsTrigger>
        <TabsTrigger value="draft" className="text-xs">
          <span className="inline-flex items-center gap-2">
            Draft
            {draftExists ? (
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            ) : null}
          </span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
