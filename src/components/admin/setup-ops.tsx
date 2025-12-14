"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { MODULES, MODULE_SECTIONS, type ModuleSectionKey } from "@/config/modules";
import {
  diagnosticsPublishDraft,
  diagnosticsSeedDraft,
} from "@/app/(authed)/admin/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContentPanel } from "@/components/panels/ContentPanel";
import { cn } from "@/lib/utils";

export function SetupOps({ className }: { className?: string }) {
  const router = useRouter();
  const [moduleSlug, setModuleSlug] = React.useState(MODULES[0]?.slug ?? "big-and-bulky");
  const [sectionKey, setSectionKey] = React.useState<ModuleSectionKey>("end-vision");
  const [notice, setNotice] = React.useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  return (
    <ContentPanel
      title="Dev / Ops helpers (optional)"
      description="Non-destructive helpers to validate draft → publish → audit flows. These will not overwrite existing draft/published content."
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
                const result = await diagnosticsSeedDraft(moduleSlug, sectionKey);
                if (!result.ok) {
                  setNotice(result.error);
                  return;
                }
                setNotice(result.message);
                router.refresh();
              });
            }}
          >
            {isPending ? "Working…" : "Create sample draft (if missing)"}
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={() => setConfirmPublish(true)}
          >
            Publish sample (if unpublished)
          </Button>
        </div>

        {notice ? (
          <div className="rounded-xl border border-border bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
            {notice}
          </div>
        ) : null}

        <Dialog open={confirmPublish} onOpenChange={setConfirmPublish}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Publish sample content?</DialogTitle>
              <DialogDescription>
                This will publish content for{" "}
                <span className="font-mono text-foreground">
                  {moduleSlug} / {sectionKey}
                </span>{" "}
                only if there is no published row yet.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmPublish(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setConfirmPublish(false);
                  setNotice(null);
                  startTransition(async () => {
                    const result = await diagnosticsPublishDraft(moduleSlug, sectionKey);
                    if (!result.ok) {
                      setNotice(result.error);
                      return;
                    }
                    setNotice(result.message);
                    router.refresh();
                  });
                }}
              >
                Publish
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ContentPanel>
  );
}

