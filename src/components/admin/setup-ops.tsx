"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { MODULES, MODULE_SECTIONS, type ModuleSectionKey } from "@/config/modules";
import { diagnosticsSeedContent } from "@/app/(authed)/admin/actions";
import { Button } from "@/components/ui/button";
import { ContentPanel } from "@/components/panels/ContentPanel";
import { cn } from "@/lib/utils";

export function SetupOps({ className }: { className?: string }) {
  const router = useRouter();
  const [moduleSlug, setModuleSlug] = React.useState(MODULES[0]?.slug ?? "big-and-bulky");
  const [sectionKey, setSectionKey] = React.useState<ModuleSectionKey>("end-vision");
  const [notice, setNotice] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  return (
    <ContentPanel
      title="Dev / Ops helpers (optional)"
      description="Non-destructive helpers to validate content save + audit history. These will not overwrite existing content."
      className={cn(className)}
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              Module
            </label>
            <select
              value={moduleSlug}
              onChange={(e) => setModuleSlug(e.target.value)}
              className={cn(
                "h-10 rounded-xl border border-border bg-background/25 px-3 text-sm text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              {MODULES.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              Section
            </label>
            <select
              value={sectionKey}
              onChange={(e) => setSectionKey(e.target.value as ModuleSectionKey)}
              className={cn(
                "h-10 rounded-xl border border-border bg-background/25 px-3 text-sm text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              {MODULE_SECTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={() => {
              setNotice(null);
              startTransition(async () => {
                const result = await diagnosticsSeedContent(moduleSlug, sectionKey);
                if (!result.ok) {
                  setNotice(result.error);
                  return;
                }
                setNotice(result.message);
                router.refresh();
              });
            }}
          >
            {isPending ? "Working…" : "Create sample content (if missing)"}
          </Button>
        </div>

        {notice ? (
          <div className="rounded-xl border border-border bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
            {notice}
          </div>
        ) : null}

      </div>
    </ContentPanel>
  );
}
