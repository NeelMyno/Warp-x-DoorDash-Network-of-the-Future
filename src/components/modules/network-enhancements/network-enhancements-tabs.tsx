"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type NetworkEnhancementsSubKey = "hub" | "spoke" | "network";
export type NetworkEnhancementsVariantKey = "example" | "future";
export type NetworkEnhancementsPanelKey = "pdf" | "highlights" | "cost";

function normalizeSub(value: unknown): NetworkEnhancementsSubKey {
  if (value === "spoke") return "spoke";
  if (value === "network") return "network";
  return "hub";
}

function normalizeVariant(value: unknown): NetworkEnhancementsVariantKey {
  if (value === "future") return "future";
  return "example";
}

function normalizePanel(value: unknown): NetworkEnhancementsPanelKey {
  if (value === "highlights") return "highlights";
  if (value === "cost") return "cost";
  return "pdf";
}

function nextUrl(pathname: string, params: URLSearchParams) {
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function NetworkEnhancementsTabs({
  sub,
  variant,
  panel,
}: {
  sub?: string;
  variant?: string;
  panel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeSub = normalizeSub(sub);
  const activeVariant = normalizeVariant(variant);
  const activePanel = normalizePanel(panel);

  const setParams = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      router.replace(nextUrl(pathname, params), { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        value={activeSub}
        onValueChange={(next) => {
          const nextSub = normalizeSub(next);
          setParams((params) => {
            params.set("sub", nextSub);

            if (nextSub === "network") {
              params.delete("variant");
              if (!params.get("panel")) params.set("panel", "pdf");
            } else {
              if (!params.get("variant")) params.set("variant", "example");
              params.delete("panel");
            }
          });
        }}
      >
        <TabsList className="h-9">
          <TabsTrigger value="hub" className="text-xs">
            Hub
          </TabsTrigger>
          <TabsTrigger value="spoke" className="text-xs">
            Spoke
          </TabsTrigger>
          <TabsTrigger value="network" className="text-xs">
            Network
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeSub === "hub" || activeSub === "spoke" ? (
        <Tabs
          value={activeVariant}
          onValueChange={(next) => {
            const nextVariant = normalizeVariant(next);
            setParams((params) => {
              params.set("sub", activeSub);
              params.set("variant", nextVariant);
              params.delete("panel");
            });
          }}
        >
          <TabsList className="h-9">
            <TabsTrigger value="example" className="text-xs">
              Example
            </TabsTrigger>
            <TabsTrigger value="future" className="text-xs">
              Future (Automation)
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : (
        <Tabs
          value={activePanel}
          onValueChange={(next) => {
            const nextPanel = normalizePanel(next);
            setParams((params) => {
              params.set("sub", "network");
              params.delete("variant");
              params.set("panel", nextPanel);
            });
          }}
        >
          <TabsList className="h-9">
            <TabsTrigger value="pdf" className="text-xs">
              PDF
            </TabsTrigger>
            <TabsTrigger value="highlights" className="text-xs">
              Highlights
            </TabsTrigger>
            <TabsTrigger value="cost" className="text-xs">
              Cost model
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}
    </div>
  );
}

