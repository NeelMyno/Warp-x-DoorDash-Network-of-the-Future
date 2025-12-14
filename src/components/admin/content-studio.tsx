"use client";

import * as React from "react";

import type { ContentBlock, ModuleConfig, ModuleSectionKey } from "@/config/modules";
import type { AuditEvent } from "@/app/(authed)/admin/actions";
import {
  copyPublishedToDraft,
  listAuditEvents,
  publishFromDraft,
  restoreFromAudit,
  upsertDraft,
} from "@/app/(authed)/admin/actions";
import { createClient as createBrowserClient } from "@/lib/supabase/browser";
import { PORTAL_ASSETS_BUCKET } from "@/lib/assets/constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContentPanel } from "@/components/panels/ContentPanel";
import { Blocks } from "@/components/content/blocks";
import { ImageBlock } from "@/components/blocks/ImageBlock";
import { BulletBlock } from "@/components/blocks/BulletBlock";
import { KpiStrip } from "@/components/blocks/KpiStrip";
import { TimelineBlock } from "@/components/blocks/TimelineBlock";
import { AssetPickerDialog } from "@/components/admin/asset-picker";

type ModuleSectionStatus = "draft" | "published";
type StudioMode = "edit" | "compare" | "history";

type SectionDoc = {
  blocks: ContentBlock[] | null;
  updatedAt?: string;
  publishedAt?: string | null;
};

export type ContentStudioInitialData = {
  dbAvailable: boolean;
  dbError?: string;
  auditAvailable: boolean;
  auditError?: string;
  modules: ModuleConfig[];
  sectionsByModule: Record<
    string,
    Partial<Record<ModuleSectionKey, Partial<Record<ModuleSectionStatus, SectionDoc>>>>
  >;
};

type StudioSectionState = {
  draft: {
    blocks: ContentBlock[];
    source: "db" | "seed";
    updatedAt?: string;
  };
  published: {
    blocks: ContentBlock[] | null;
    publishedAt?: string | null;
    updatedAt?: string;
  };
};

type StudioState = Record<string, Record<ModuleSectionKey, StudioSectionState>>;

const EMPTY_BLOCKS: ContentBlock[] = [];

function isModuleSectionKey(value: string): value is ModuleSectionKey {
  return value === "end-vision" || value === "progress" || value === "roadmap";
}

function deepCloneBlocks(blocks: ContentBlock[]) {
  return JSON.parse(JSON.stringify(blocks)) as ContentBlock[];
}

function blockTypeLabel(type: ContentBlock["type"]) {
  if (type === "kpis") return "KPI strip";
  if (type === "bullets") return "Bullets";
  if (type === "timeline") return "Timeline";
  if (type === "image") return "Image";
  return "Empty";
}

function formatRelativeTime(iso: string) {
  const timestamp = new Date(iso).getTime();
  const deltaMs = Date.now() - timestamp;
  if (!Number.isFinite(deltaMs)) return "—";
  if (deltaMs < 45_000) return "just now";
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function auditActionLabel(action: AuditEvent["action"]) {
  if (action === "publish") return "publish";
  if (action === "restore") return "restore";
  return "save draft";
}

function auditActionVariant(action: AuditEvent["action"]) {
  if (action === "publish") return "accent";
  if (action === "restore") return "outline";
  return "muted";
}

function newKpisBlock(): ContentBlock {
  return {
    type: "kpis",
    title: "Overview",
    items: [
      { label: "Metric A", value: "—", delta: "—" },
      { label: "Metric B", value: "—", delta: "—" },
      { label: "Metric C", value: "—", delta: "—" },
      { label: "Metric D", value: "—", delta: "—" },
    ],
  };
}

function newBulletsBlock(): ContentBlock {
  return {
    type: "bullets",
    title: "Bullets",
    description: "Replace with real content.",
    items: ["Add the first bullet…"],
  };
}

function newTimelineBlock(): ContentBlock {
  return {
    type: "timeline",
    title: "Timeline",
    description: "Replace with real milestones.",
    items: [
      { date: "Month 1", title: "Define", body: "Clarify scope + success metrics." },
      { date: "Month 2", title: "Build", body: "Implement workflows + visibility." },
      { date: "Month 3", title: "Pilot", body: "Run and iterate weekly." },
    ],
  };
}

function newImageBlock(): ContentBlock {
  return {
    type: "image",
    alt: "Diagram",
    caption: "",
    layout: "wide",
    treatment: "panel",
  };
}

function BlockPreview({ block }: { block: ContentBlock }) {
  if (block.type === "kpis") {
    return <KpiStrip title={block.title} items={block.items} />;
  }
  if (block.type === "bullets") {
    return (
      <BulletBlock
        title={block.title}
        description={block.description}
        items={block.items}
      />
    );
  }
  if (block.type === "timeline") {
    return (
      <TimelineBlock
        title={block.title}
        description={block.description}
        items={block.items}
      />
    );
  }

  if (block.type === "image") {
    return (
      <ImageBlock
        url={block.url}
        path={block.path}
        alt={block.alt}
        caption={block.caption}
        treatment={block.treatment ?? "panel"}
        showAdminHint
      />
    );
  }

  return (
    <ContentPanel title={block.title} description={block.description} className="border-dashed bg-muted/20">
      <div className="text-sm text-muted-foreground">Nothing to show yet.</div>
    </ContentPanel>
  );
}

function KpisEditor({
  value,
  onChange,
}: {
  value: Extract<ContentBlock, { type: "kpis" }>;
  onChange: (next: Extract<ContentBlock, { type: "kpis" }>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <label className="text-xs font-medium text-muted-foreground">Title</label>
        <Input
          value={value.title ?? ""}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder="Overview"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-medium text-muted-foreground">Items</div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...value,
                items: [...value.items, { label: "", value: "", delta: "" }],
              })
            }
          >
            Add row
          </Button>
        </div>

        <div className="space-y-3">
          {value.items.map((item, idx) => (
            <div
              key={`${idx}-${item.label}`}
              className="grid gap-2 rounded-xl border border-border bg-background/20 p-3"
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-1">
                  <label className="text-[11px] text-muted-foreground">
                    Label
                  </label>
                  <Input
                    value={item.label}
                    onChange={(e) => {
                      const next = [...value.items];
                      next[idx] = { ...next[idx], label: e.target.value };
                      onChange({ ...value, items: next });
                    }}
                    placeholder="Coverage"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-[11px] text-muted-foreground">
                    Value
                  </label>
                  <Input
                    value={item.value}
                    onChange={(e) => {
                      const next = [...value.items];
                      next[idx] = { ...next[idx], value: e.target.value };
                      onChange({ ...value, items: next });
                    }}
                    placeholder="—"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-[11px] text-muted-foreground">
                    Delta
                  </label>
                  <Input
                    value={item.delta ?? ""}
                    onChange={(e) => {
                      const next = [...value.items];
                      next[idx] = { ...next[idx], delta: e.target.value };
                      onChange({ ...value, items: next });
                    }}
                    placeholder="+2%"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="grid flex-1 gap-1">
                  <label className="text-[11px] text-muted-foreground">
                    Helper (optional)
                  </label>
                  <Input
                    value={item.helper ?? ""}
                    onChange={(e) => {
                      const next = [...value.items];
                      next[idx] = { ...next[idx], helper: e.target.value };
                      onChange({ ...value, items: next });
                    }}
                    placeholder="placeholder"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = value.items.filter((_, i) => i !== idx);
                    onChange({ ...value, items: next });
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BulletsEditor({
  value,
  onChange,
}: {
  value: Extract<ContentBlock, { type: "bullets" }>;
  onChange: (next: Extract<ContentBlock, { type: "bullets" }>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <label className="text-xs font-medium text-muted-foreground">Title</label>
        <Input
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder="What success looks like"
        />
      </div>
      <div className="grid gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          Description (optional)
        </label>
        <Input
          value={value.description ?? ""}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          placeholder="Short context for this list"
        />
      </div>
      <div className="grid gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          Bullets (one per line)
        </label>
        <Textarea
          value={value.items.join("\n")}
          onChange={(e) =>
            onChange({
              ...value,
              items: e.target.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
            })
          }
          placeholder={"First bullet\nSecond bullet\nThird bullet"}
        />
      </div>
    </div>
  );
}

function TimelineEditor({
  value,
  onChange,
}: {
  value: Extract<ContentBlock, { type: "timeline" }>;
  onChange: (next: Extract<ContentBlock, { type: "timeline" }>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <label className="text-xs font-medium text-muted-foreground">Title</label>
        <Input
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder="Timeline"
        />
      </div>
      <div className="grid gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          Description (optional)
        </label>
        <Input
          value={value.description ?? ""}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          placeholder="Short context for this timeline"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-medium text-muted-foreground">Items</div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...value,
                items: [...value.items, { date: "", title: "", body: "" }],
              })
            }
          >
            Add row
          </Button>
        </div>

        <div className="space-y-3">
          {value.items.map((item, idx) => (
            <div
              key={`${idx}-${item.title}`}
              className="grid gap-2 rounded-xl border border-border bg-background/20 p-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <label className="text-[11px] text-muted-foreground">
                    Date
                  </label>
                  <Input
                    value={item.date}
                    onChange={(e) => {
                      const next = [...value.items];
                      next[idx] = { ...next[idx], date: e.target.value };
                      onChange({ ...value, items: next });
                    }}
                    placeholder="Month 1"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-[11px] text-muted-foreground">
                    Title
                  </label>
                  <Input
                    value={item.title}
                    onChange={(e) => {
                      const next = [...value.items];
                      next[idx] = { ...next[idx], title: e.target.value };
                      onChange({ ...value, items: next });
                    }}
                    placeholder="Define"
                  />
                </div>
              </div>
              <div className="grid gap-1">
                <label className="text-[11px] text-muted-foreground">
                  Body (optional)
                </label>
                <Textarea
                  className="min-h-[84px]"
                  value={item.body ?? ""}
                  onChange={(e) => {
                    const next = [...value.items];
                    next[idx] = { ...next[idx], body: e.target.value };
                    onChange({ ...value, items: next });
                  }}
                  placeholder="Describe the milestone"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = value.items.filter((_, i) => i !== idx);
                    onChange({ ...value, items: next });
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImageEditor({
  value,
  onChange,
  moduleSlug,
  getPreviewUrl,
  onSetPreviewUrl,
}: {
  value: Extract<ContentBlock, { type: "image" }>;
  onChange: (next: Extract<ContentBlock, { type: "image" }>) => void;
  moduleSlug: string;
  getPreviewUrl: (path: string | undefined) => string | null;
  onSetPreviewUrl: (path: string, url: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const previewUrl = getPreviewUrl(value.path);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/20 p-4">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">Asset</div>
          <div className="mt-1 truncate text-sm text-foreground">
            {value.path ? value.path : "No asset selected"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {value.assetId ? (
            <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
              assetId
            </Badge>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPickerOpen(true)}
          >
            {value.path ? "Change" : "Select"} asset
          </Button>
        </div>
      </div>

      {previewUrl ? (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/20 shadow-[var(--warp-shadow-elev-1)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={value.alt || "Selected asset"}
            className="block h-auto w-full max-h-[360px] object-contain"
          />
        </div>
      ) : null}

      <div className="grid gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          Alt text
        </label>
        <Input
          value={value.alt}
          onChange={(e) => onChange({ ...value, alt: e.target.value })}
          placeholder="Describe the diagram for accessibility"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          Caption (optional)
        </label>
        <Input
          value={value.caption ?? ""}
          onChange={(e) => onChange({ ...value, caption: e.target.value })}
          placeholder="Short caption shown below the image"
        />
      </div>

      <div className="grid gap-2">
        <div className="text-xs font-medium text-muted-foreground">Layout</div>
        <Tabs
          value={value.layout ?? "wide"}
          onValueChange={(layout) =>
            onChange({
              ...value,
              layout: layout as "full" | "wide" | "half-left" | "half-right",
            })
          }
        >
          <TabsList className="h-9 shadow-[var(--warp-shadow-elev-1)]">
            <TabsTrigger value="full" className="text-xs">
              Full
            </TabsTrigger>
            <TabsTrigger value="wide" className="text-xs">
              Wide
            </TabsTrigger>
            <TabsTrigger value="half-left" className="text-xs">
              Half L
            </TabsTrigger>
            <TabsTrigger value="half-right" className="text-xs">
              Half R
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-2">
        <div className="text-xs font-medium text-muted-foreground">Treatment</div>
        <Tabs
          value={value.treatment ?? "panel"}
          onValueChange={(treatment) =>
            onChange({
              ...value,
              treatment: treatment as "plain" | "panel",
            })
          }
        >
          <TabsList className="h-9 shadow-[var(--warp-shadow-elev-1)]">
            <TabsTrigger value="panel" className="text-xs">
              Panel
            </TabsTrigger>
            <TabsTrigger value="plain" className="text-xs">
              Plain
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <AssetPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        moduleSlug={moduleSlug}
        imagesOnly
        onSelect={(asset) => {
          onChange({
            ...value,
            assetId: asset.id,
            path: asset.path,
          });
          if (asset.previewUrl) onSetPreviewUrl(asset.path, asset.previewUrl);
        }}
      />
    </div>
  );
}

function BlockEditorDialog({
  open,
  block,
  onOpenChange,
  onSave,
  moduleSlug,
  getPreviewUrl,
  onSetPreviewUrl,
}: {
  open: boolean;
  block: ContentBlock | null;
  onOpenChange: (next: boolean) => void;
  onSave: (next: ContentBlock) => void;
  moduleSlug: string;
  getPreviewUrl: (path: string | undefined) => string | null;
  onSetPreviewUrl: (path: string, url: string) => void;
}) {
  const [draft, setDraft] = React.useState<ContentBlock | null>(block);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDraft(block ? (JSON.parse(JSON.stringify(block)) as ContentBlock) : null);
    setValidationError(null);
  }, [block, open]);

  if (!block || !draft) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit block</DialogTitle>
          <DialogDescription>
            Update the content, then save to apply it to the section draft.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 space-y-5">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{blockTypeLabel(draft.type)}</Badge>
            <span className="text-xs text-muted-foreground">
              {draft.type === "kpis"
                ? `${draft.items.length} KPI rows`
                : draft.type === "bullets"
                  ? `${draft.items.length} bullets`
                  : draft.type === "timeline"
                    ? `${draft.items.length} timeline items`
                    : draft.type === "image"
                      ? draft.path
                        ? "asset selected"
                        : "no asset"
                      : "empty"}
            </span>
          </div>

          {draft.type === "kpis" ? (
            <KpisEditor value={draft} onChange={(next) => setDraft(next)} />
          ) : null}
          {draft.type === "bullets" ? (
            <BulletsEditor value={draft} onChange={(next) => setDraft(next)} />
          ) : null}
          {draft.type === "timeline" ? (
            <TimelineEditor value={draft} onChange={(next) => setDraft(next)} />
          ) : null}
          {draft.type === "image" ? (
            <ImageEditor
              value={draft}
              onChange={(next) => setDraft(next)}
              moduleSlug={moduleSlug}
              getPreviewUrl={getPreviewUrl}
              onSetPreviewUrl={onSetPreviewUrl}
            />
          ) : null}
          {draft.type === "empty" ? (
            <div className="space-y-4">
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Title
                </label>
                <Input
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Description (optional)
                </label>
                <Input
                  value={draft.description ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                />
              </div>
            </div>
          ) : null}
        </div>

        {validationError ? (
          <div className="mt-4 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {validationError}
          </div>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={() => {
              if (draft.type === "image") {
                if (!draft.alt.trim()) {
                  setValidationError("Alt text is required for images.");
                  return;
                }
                if (!draft.assetId && !draft.path) {
                  setValidationError("Select an asset to attach to this block.");
                  return;
                }
              }
              setValidationError(null);
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Save block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ContentStudio({
  dbAvailable,
  dbError,
  auditAvailable,
  auditError,
  modules,
  sectionsByModule,
}: ContentStudioInitialData) {
  const moduleSlugs = modules.map((m) => m.slug);
  const firstSlug = moduleSlugs[0] ?? "";
  const [activeModule, setActiveModule] = React.useState(firstSlug);
  const [activeSection, setActiveSection] = React.useState<ModuleSectionKey>("end-vision");
  const [activeMode, setActiveMode] = React.useState<StudioMode>("edit");
  const [notice, setNotice] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const supabaseBrowser = React.useMemo(() => createBrowserClient(), []);
  const [previewUrlByPath, setPreviewUrlByPath] = React.useState<
    Record<string, string>
  >({});

  const getPreviewUrl = React.useCallback(
    (path: string | undefined) => {
      if (!path) return null;
      return previewUrlByPath[path] ?? null;
    },
    [previewUrlByPath],
  );

  const setPreviewUrl = React.useCallback((path: string, url: string) => {
    setPreviewUrlByPath((prev) => (prev[path] === url ? prev : { ...prev, [path]: url }));
  }, []);

  const [state, setState] = React.useState<StudioState>(() => {
    const initial: Partial<StudioState> = {};
    for (const mod of modules) {
      const perSection: Partial<Record<ModuleSectionKey, StudioSectionState>> = {};
      for (const key of Object.keys(mod.sections)) {
        if (!isModuleSectionKey(key)) continue;
        const fallback = deepCloneBlocks(mod.sections[key].blocks);
        const docs = sectionsByModule[mod.slug]?.[key] ?? {};
        const draftDoc = docs.draft;
        const publishedDoc = docs.published;
        const draftBlocks = draftDoc?.blocks ? deepCloneBlocks(draftDoc.blocks) : fallback;
        perSection[key] = {
          draft: {
            blocks: draftBlocks,
            source: draftDoc?.blocks ? "db" : "seed",
            updatedAt: draftDoc?.updatedAt,
          },
          published: {
            blocks: publishedDoc?.blocks ? deepCloneBlocks(publishedDoc.blocks) : null,
            publishedAt: publishedDoc?.publishedAt ?? null,
            updatedAt: publishedDoc?.updatedAt,
          },
        };
      }
      initial[mod.slug] = perSection as Record<ModuleSectionKey, StudioSectionState>;
    }
    return initial as StudioState;
  });

  const activeConfig = modules.find((m) => m.slug === activeModule) ?? null;
  const activeSectionState = state[activeModule]?.[activeSection] ?? null;

  const currentDraftBlocks = activeSectionState?.draft.blocks ?? EMPTY_BLOCKS;
  const publishedBlocks = activeSectionState?.published.blocks;
  const actionsDisabled = !dbAvailable || !auditAvailable || isPending;
  const editingDisabled = !dbAvailable || isPending;

  const previewDraftBlocks = currentDraftBlocks.map((block) => {
    if (block.type !== "image" || !block.path) return block;
    const url = getPreviewUrl(block.path);
    return url ? { ...block, url } : block;
  });

  const previewPublishedBlocks = (publishedBlocks ?? []).map((block) => {
    if (block.type !== "image" || !block.path) return block;
    const url = getPreviewUrl(block.path);
    return url ? { ...block, url } : block;
  });

  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [restoreTarget, setRestoreTarget] = React.useState<AuditEvent | null>(
    null,
  );
  const [history, setHistory] = React.useState<{
    loading: boolean;
    error: string | null;
    events: AuditEvent[];
    forKey: string | null;
  }>({ loading: false, error: null, events: [], forKey: null });

  const editingBlock =
    editingIndex === null ? null : currentDraftBlocks[editingIndex] ?? null;

  React.useEffect(() => {
    if (activeMode === "history") return;

    const paths = new Set<string>();

    for (const block of currentDraftBlocks) {
      if (block.type === "image" && block.path) paths.add(block.path);
    }
    for (const block of publishedBlocks ?? []) {
      if (block.type === "image" && block.path) paths.add(block.path);
    }
    if (editingBlock?.type === "image" && editingBlock.path) {
      paths.add(editingBlock.path);
    }

    const missing = Array.from(paths).filter((p) => !previewUrlByPath[p]);
    if (!missing.length) return;

    let cancelled = false;

    void (async () => {
      for (const path of missing.slice(0, 12)) {
        const { data, error } = await supabaseBrowser.storage
          .from(PORTAL_ASSETS_BUCKET)
          .createSignedUrl(path, 3600);
        if (cancelled) return;
        if (error || !data?.signedUrl) continue;
        setPreviewUrl(path, data.signedUrl);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeMode,
    currentDraftBlocks,
    publishedBlocks,
    editingBlock,
    previewUrlByPath,
    supabaseBrowser,
    setPreviewUrl,
  ]);

  const setDraftBlocks = React.useCallback(
    (nextBlocks: ContentBlock[]) => {
      setState((prev) => {
        const next: StudioState = { ...prev };
        next[activeModule] = { ...next[activeModule] };
        next[activeModule][activeSection] = {
          ...next[activeModule][activeSection],
          draft: {
            ...next[activeModule][activeSection].draft,
            blocks: nextBlocks,
          },
        };
        return next;
      });
    },
    [activeModule, activeSection],
  );

  function addBlock(type: "kpis" | "bullets" | "timeline" | "image") {
    if (type === "kpis") {
      setDraftBlocks([...currentDraftBlocks, newKpisBlock()]);
      setNotice(null);
      return;
    }

    if (type === "bullets") {
      setDraftBlocks([...currentDraftBlocks, newBulletsBlock()]);
      setNotice(null);
      return;
    }

    if (type === "timeline") {
      setDraftBlocks([...currentDraftBlocks, newTimelineBlock()]);
      setNotice(null);
      return;
    }

    const next = [...currentDraftBlocks, newImageBlock()];
    setDraftBlocks(next);
    setEditingIndex(next.length - 1);
    setNotice("Select an asset and confirm alt text before saving.");
  }

  const selectedHistoryKey = `${activeModule}:${activeSection}`;

  const appendAuditEvent = React.useCallback(
    (event: AuditEvent | undefined) => {
      if (!event) return;
      setHistory((prev) => {
        if (prev.forKey !== selectedHistoryKey) return prev;
        const next = [event, ...prev.events];
        return { ...prev, events: next.slice(0, 20) };
      });
    },
    [selectedHistoryKey],
  );

  function saveDraft() {
    startTransition(async () => {
      setNotice(null);
      const result = await upsertDraft(activeModule, activeSection, currentDraftBlocks);
      if (!result.ok) {
        setNotice(result.error);
        return;
      }

      setState((prev) => {
        const next: StudioState = { ...prev };
        next[activeModule] = { ...next[activeModule] };
        next[activeModule][activeSection] = {
          ...next[activeModule][activeSection],
          draft: {
            ...next[activeModule][activeSection].draft,
            source: "db",
            updatedAt: result.updatedAt,
            blocks: result.draftBlocks ? deepCloneBlocks(result.draftBlocks) : currentDraftBlocks,
          },
        };
        return next;
      });

      appendAuditEvent(result.audit);
      setNotice("Draft saved.");
    });
  }

  function publishDraft() {
    startTransition(async () => {
      setNotice(null);

      const saved = await upsertDraft(activeModule, activeSection, currentDraftBlocks);
      if (!saved.ok) {
        setNotice(saved.error);
        return;
      }

      const published = await publishFromDraft(activeModule, activeSection);
      if (!published.ok) {
        setNotice(published.error);
        return;
      }

      setState((prev) => {
        const next: StudioState = { ...prev };
        next[activeModule] = { ...next[activeModule] };
        next[activeModule][activeSection] = {
          ...next[activeModule][activeSection],
          draft: {
            ...next[activeModule][activeSection].draft,
            source: "db",
            updatedAt: saved.updatedAt,
            blocks: saved.draftBlocks ? deepCloneBlocks(saved.draftBlocks) : currentDraftBlocks,
          },
          published: {
            blocks: deepCloneBlocks(currentDraftBlocks),
            publishedAt: published.publishedAt ?? null,
            updatedAt: published.updatedAt,
          },
        };
        return next;
      });

      appendAuditEvent(saved.audit);
      appendAuditEvent(published.audit);
      setNotice("Published.");
    });
  }

  function copyPublishedIntoDraft() {
    startTransition(async () => {
      setNotice(null);
      const result = await copyPublishedToDraft(activeModule, activeSection);
      if (!result.ok) {
        setNotice(result.error);
        return;
      }

      if (!result.draftBlocks) {
        setNotice("Nothing to copy.");
        return;
      }

      setState((prev) => {
        const next: StudioState = { ...prev };
        next[activeModule] = { ...next[activeModule] };
        next[activeModule][activeSection] = {
          ...next[activeModule][activeSection],
          draft: {
            ...next[activeModule][activeSection].draft,
            source: "db",
            updatedAt: result.updatedAt,
            blocks: deepCloneBlocks(result.draftBlocks ?? []),
          },
        };
        return next;
      });

      appendAuditEvent(result.audit);
      setActiveMode("edit");
      setNotice("Copied published content into draft.");
    });
  }

  function restoreDraftFromAudit(auditId: string) {
    startTransition(async () => {
      setNotice(null);
      const result = await restoreFromAudit(auditId);
      if (!result.ok) {
        setNotice(result.error);
        return;
      }

      if (!result.draftBlocks) {
        setNotice("Restore succeeded but no draft blocks were returned.");
        return;
      }

      setState((prev) => {
        const next: StudioState = { ...prev };
        const moduleSlug = activeModule;
        next[moduleSlug] = { ...next[moduleSlug] };
        next[moduleSlug][activeSection] = {
          ...next[moduleSlug][activeSection],
          draft: {
            ...next[moduleSlug][activeSection].draft,
            source: "db",
            updatedAt: result.updatedAt,
            blocks: deepCloneBlocks(result.draftBlocks ?? []),
          },
        };
        return next;
      });

      appendAuditEvent(result.audit);
      setActiveMode("edit");
      setNotice("Draft restored.");
    });
  }

  React.useEffect(() => {
    if (activeMode !== "history") return;

    if (!auditAvailable) {
      setHistory({
        loading: false,
        error:
          auditError ??
          "Audit log is not available. Run supabase/sql/02_module_content_audit.sql.",
        events: [],
        forKey: selectedHistoryKey,
      });
      return;
    }

    if (history.forKey === selectedHistoryKey) return;

    const key = selectedHistoryKey;
    setHistory({ loading: true, error: null, events: [], forKey: key });

    startTransition(async () => {
      const result = await listAuditEvents(activeModule, activeSection, 20);
      setHistory((prev) => {
        if (prev.forKey !== key) return prev;
        if (!result.ok) {
          return { ...prev, loading: false, error: result.error, events: [] };
        }
        return { ...prev, loading: false, error: null, events: result.events };
      });
    });
  }, [
    activeMode,
    activeModule,
    activeSection,
    auditAvailable,
    auditError,
    history.forKey,
    selectedHistoryKey,
    startTransition,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-[length:var(--warp-fs-page-title)] font-semibold leading-[var(--warp-lh-page-title)] tracking-tight text-foreground">
            Content Studio
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Edit module section blocks (draft/published) without redeploys.
          </p>
        </div>

        <Badge variant="accent" className="px-2 py-1 text-[11px]">
          Admin
        </Badge>
      </div>

      {!dbAvailable ? (
        <ContentPanel
          title="Database not ready"
          description="Run the SQL file to create module content tables + RLS."
          className="border-primary/20 bg-primary/5"
        >
          <div className="space-y-2 text-sm text-muted-foreground">
            <div>
              Create the schema in Supabase SQL editor:{" "}
              <span className="font-mono text-foreground">supabase/sql/01_module_content.sql</span>
            </div>
            {dbError ? (
              <div className="text-xs text-muted-foreground">
                Error: <span className="font-mono">{dbError}</span>
              </div>
            ) : null}
          </div>
        </ContentPanel>
      ) : null}

      {dbAvailable && !auditAvailable ? (
        <ContentPanel
          title="Audit log not ready"
          description="Run the SQL file to enable history, compare confidence, and restore."
          className="border-primary/20 bg-primary/5"
        >
          <div className="space-y-2 text-sm text-muted-foreground">
            <div>
              Create the audit log table in Supabase SQL editor:{" "}
              <span className="font-mono text-foreground">
                supabase/sql/02_module_content_audit.sql
              </span>
            </div>
            {auditError ? (
              <div className="text-xs text-muted-foreground">
                Error: <span className="font-mono">{auditError}</span>
              </div>
            ) : null}
          </div>
        </ContentPanel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="rounded-[var(--warp-radius-xl)] border border-border bg-background/18 shadow-[var(--warp-shadow-elev-2)] backdrop-blur">
          <header className="flex items-center justify-between border-b border-border/60 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-foreground">Modules</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Choose what to edit
              </div>
            </div>
            <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
              {modules.length}
            </Badge>
          </header>

          <div className="p-3">
            <div className="space-y-1">
              {modules.map((m) => {
                const active = m.slug === activeModule;
                return (
                  <button
                    key={m.slug}
                    type="button"
                    onClick={() => {
                      setActiveModule(m.slug);
                      setNotice(null);
                      setEditingIndex(null);
                      setRestoreTarget(null);
                      setActiveMode("edit");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      active
                        ? "bg-muted/55 text-foreground shadow-[var(--warp-shadow-elev-1)]"
                        : "text-muted-foreground hover:bg-muted/35 hover:text-foreground",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            active ? "bg-primary" : "bg-border",
                          )}
                        />
                        <div className="truncate text-sm font-medium">
                          {m.title}
                        </div>
                      </div>
                      <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {m.slug}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">→</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {activeConfig ? (
            <div className="rounded-[var(--warp-radius-xl)] border border-border bg-background/18 shadow-[var(--warp-shadow-elev-2)] backdrop-blur">
              <header className="border-b border-border/60 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      {activeConfig.title}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {activeConfig.description}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
                      {activeConfig.slug}
                    </Badge>
                  </div>
                </div>
              </header>

              <div className="px-5 py-4">
                <Tabs
                  value={activeSection}
                  onValueChange={(v) => {
                    if (isModuleSectionKey(v)) {
                      setActiveSection(v);
                      setNotice(null);
                      setEditingIndex(null);
                      setRestoreTarget(null);
                    }
                  }}
                >
                  <div className="space-y-3">
                    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                      <TabsList className="shadow-[var(--warp-shadow-elev-1)]">
                        <TabsTrigger value="end-vision">End vision</TabsTrigger>
                        <TabsTrigger value="progress">Progress</TabsTrigger>
                        <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
                      </TabsList>

                      <div className="flex flex-wrap items-center gap-2">
                        {activeMode === "edit" ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={editingDisabled}
                              >
                                Add block
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => addBlock("kpis")}>
                                Add KPI strip
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => addBlock("bullets")}>
                                Add Bullets
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => addBlock("timeline")}>
                                Add Timeline
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => addBlock("image")}>
                                Add Image / Diagram
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}

                        {activeMode === "compare" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={actionsDisabled || !publishedBlocks}
                            onClick={copyPublishedIntoDraft}
                          >
                            Copy Published → Draft
                          </Button>
                        ) : null}

                        {activeMode !== "history" ? (
                          <>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={actionsDisabled}
                              onClick={saveDraft}
                            >
                              {isPending ? "Saving…" : "Save draft"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={actionsDisabled}
                              onClick={publishDraft}
                            >
                              {isPending ? "Publishing…" : "Publish"}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                      <Tabs
                        value={activeMode}
                        onValueChange={(v) => {
                          setActiveMode(
                            v === "compare" ? "compare" : v === "history" ? "history" : "edit",
                          );
                          setNotice(null);
                          setEditingIndex(null);
                          setRestoreTarget(null);
                        }}
                      >
                        <TabsList className="h-9 shadow-[var(--warp-shadow-elev-1)]">
                          <TabsTrigger value="edit" className="text-xs">
                            Edit
                          </TabsTrigger>
                          <TabsTrigger value="compare" className="text-xs">
                            Compare
                          </TabsTrigger>
                          <TabsTrigger value="history" className="text-xs">
                            History
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge
                          variant={
                            activeSectionState?.draft.source === "db"
                              ? "outline"
                              : "muted"
                          }
                          className="px-2 py-0.5 text-[11px]"
                        >
                          {activeSectionState?.draft.source === "db"
                            ? "Draft saved"
                            : "Draft seeded"}
                        </Badge>
                        {activeSectionState?.draft.updatedAt ? (
                          <span className="font-mono">
                            {new Date(activeSectionState.draft.updatedAt).toLocaleString()}
                          </span>
                        ) : null}

                        <span className="opacity-50">•</span>

                        <Badge
                          variant={publishedBlocks ? "outline" : "muted"}
                          className="px-2 py-0.5 text-[11px]"
                        >
                          {publishedBlocks ? "Published" : "Not published"}
                        </Badge>
                        {activeSectionState?.published.publishedAt ? (
                          <span className="font-mono">
                            {new Date(activeSectionState.published.publishedAt).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {notice ? (
                      <div className="text-xs text-muted-foreground">
                        {notice}
                      </div>
                    ) : null}
                  </div>
                </Tabs>
              </div>
            </div>
          ) : null}

          {activeMode === "edit" ? (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground">
                Draft blocks render using the same components as module pages.
              </div>

              <div className="space-y-4">
                {currentDraftBlocks.map((block, idx) => (
                  <div key={`${block.type}-${idx}`} className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="muted" className="px-2 py-0.5 text-[11px]">
                          {blockTypeLabel(block.type)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Block {idx + 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={editingDisabled}
                          onClick={() => setEditingIndex(idx)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={editingDisabled}
                          onClick={() => {
                            if (!confirm("Delete this block?")) return;
                            const next = currentDraftBlocks.filter((_, i) => i !== idx);
                            setDraftBlocks(next);
                            setNotice(null);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>

                    <BlockPreview block={previewDraftBlocks[idx] ?? block} />
                  </div>
                ))}
              </div>

              <BlockEditorDialog
                open={editingIndex !== null}
                block={editingBlock}
                onOpenChange={(next) => {
                  if (!next) setEditingIndex(null);
                }}
                moduleSlug={activeModule}
                getPreviewUrl={getPreviewUrl}
                onSetPreviewUrl={setPreviewUrl}
                onSave={(next) => {
                  if (editingIndex === null) return;
                  const blocks = [...currentDraftBlocks];
                  blocks[editingIndex] = next;
                  setDraftBlocks(blocks);
                  setNotice(null);
                }}
              />
            </div>
          ) : null}

          {activeMode === "compare" ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <ContentPanel
                  title="Draft preview"
                  description={
                    activeSectionState?.draft.updatedAt
                      ? `Updated ${new Date(activeSectionState.draft.updatedAt).toLocaleString()}`
                      : "Not saved yet"
                  }
                  right={
                    <Badge
                      variant={
                        activeSectionState?.draft.source === "db"
                          ? "outline"
                          : "muted"
                      }
                      className="px-2 py-0.5 text-[11px]"
                    >
                      Draft
                    </Badge>
                  }
                >
                  <div className="min-h-[320px] max-h-[calc(100vh-560px)] overflow-auto pr-2">
                    <Blocks blocks={previewDraftBlocks} showImageHints />
                  </div>
                </ContentPanel>

                <ContentPanel
                  title="Published preview"
                  description={
                    publishedBlocks
                      ? activeSectionState?.published.publishedAt
                        ? `Published ${new Date(activeSectionState.published.publishedAt).toLocaleString()}`
                        : "Published (timestamp missing)"
                      : "No published content yet"
                  }
                  right={
                    <Badge
                      variant={publishedBlocks ? "outline" : "muted"}
                      className="px-2 py-0.5 text-[11px]"
                    >
                      Published
                    </Badge>
                  }
                >
                  <div className="min-h-[320px] max-h-[calc(100vh-560px)] overflow-auto pr-2">
                    {publishedBlocks ? (
                      <Blocks blocks={previewPublishedBlocks} showImageHints />
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Users will see config placeholders until you publish.
                      </div>
                    )}
                  </div>
                </ContentPanel>
              </div>
            </div>
          ) : null}

          {activeMode === "history" ? (
            <ContentPanel
              title="History"
              description="Last 20 events for this module section."
              right={
                <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
                  {history.events.length}
                </Badge>
              }
            >
              {!auditAvailable ? (
                <div className="text-sm text-muted-foreground">
                  Audit log is not available. Run{" "}
                  <span className="font-mono text-foreground">
                    supabase/sql/02_module_content_audit.sql
                  </span>{" "}
                  in Supabase SQL editor.
                </div>
              ) : history.loading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : history.error ? (
                <div className="text-sm text-muted-foreground">
                  {history.error}
                </div>
              ) : history.events.length ? (
                <ul className="divide-y divide-border/60">
                  {history.events.map((event) => (
                    <li
                      key={event.id}
                      className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={auditActionVariant(event.action)}
                            className="px-2 py-0.5 text-[11px]"
                          >
                            {auditActionLabel(event.action)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="px-2 py-0.5 text-[11px]"
                          >
                            {event.status}
                          </Badge>
                          <span
                            className="text-xs text-muted-foreground"
                            title={new Date(event.createdAt).toLocaleString()}
                          >
                            {formatRelativeTime(event.createdAt)}
                          </span>
                          {event.actorEmail ? (
                            <span className="text-xs text-muted-foreground">
                              • {event.actorEmail}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={actionsDisabled}
                          onClick={() => setRestoreTarget(event)}
                        >
                          Restore to Draft
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No history yet.
                </div>
              )}
            </ContentPanel>
          ) : null}

          <Dialog
            open={Boolean(restoreTarget)}
            onOpenChange={(open) => {
              if (!open) setRestoreTarget(null);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Restore this snapshot to Draft?</DialogTitle>
                <DialogDescription>
                  This overwrites the current draft for this section. You can publish after reviewing.
                </DialogDescription>
              </DialogHeader>

              {restoreTarget ? (
                <div className="mt-5 grid gap-3 rounded-2xl border border-border bg-background/20 p-4 text-sm text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={auditActionVariant(restoreTarget.action)}
                      className="px-2 py-0.5 text-[11px]"
                    >
                      {auditActionLabel(restoreTarget.action)}
                    </Badge>
                    <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
                      {restoreTarget.status}
                    </Badge>
                    <span className="font-mono">
                      {new Date(restoreTarget.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs">
                    {restoreTarget.actorEmail ? `Actor: ${restoreTarget.actorEmail}` : "Actor: —"}
                  </div>
                </div>
              ) : null}

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  disabled={actionsDisabled || !restoreTarget}
                  onClick={() => {
                    if (!restoreTarget) return;
                    const id = restoreTarget.id;
                    setRestoreTarget(null);
                    restoreDraftFromAudit(id);
                  }}
                >
                  Restore to draft
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>
      </div>
    </div>
  );
}
