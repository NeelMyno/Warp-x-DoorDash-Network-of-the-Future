"use client";

import * as React from "react";

import type { ContentBlock, ModuleConfig, ModuleSectionKey, MetricsFlowIconKey, MetricsFlowItem } from "@/config/modules";
import { getModuleBySlug } from "@/lib/modules/registry";
import type { AuditEvent } from "@/app/(authed)/admin/actions";
import {
  listAuditEvents,
  restoreFromAudit,
  saveModuleSection,
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
import { ImageBlock } from "@/components/blocks/ImageBlock";
import { PdfBlock } from "@/components/blocks/PdfBlock";
import { BulletBlock } from "@/components/blocks/BulletBlock";
import { ProseBlock } from "@/components/blocks/ProseBlock";
import { AssetPickerDialog } from "@/components/admin/asset-picker";
import { MetricsFlowCard } from "@/components/modules/year-in-review/MetricsFlowCard";

type StudioMode = "edit" | "history";

type SectionDoc = {
  blocks: ContentBlock[] | null;
  updatedAt?: string;
};

export type ContentStudioInitialData = {
  dbAvailable: boolean;
  dbError?: string;
  auditAvailable: boolean;
  auditError?: string;
  modules: ModuleConfig[];
  sectionsByModule: Record<string, Partial<Record<ModuleSectionKey, SectionDoc>>>;
};

type StudioSectionState = {
  content: {
    blocks: ContentBlock[];
    source: "db" | "seed";
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
  if (type === "bullets") return "Bullets";
  if (type === "prose") return "Prose";
  if (type === "image") return "Image";
  if (type === "pdf") return "PDF";
  if (type === "metrics_flow") return "Metrics Flow";
  return "Empty";
}

/**
 * Module-specific block type restrictions.
 * - "automated-hubs": PDF only
 * - "spoke": text only (prose, bullets)
 * - "year-in-review": includes metrics_flow
 * - others: all types allowed
 */
function getAllowedBlockTypes(moduleSlug: string): ContentBlock["type"][] {
  if (moduleSlug === "automated-hubs") {
    return ["pdf"];
  }
  if (moduleSlug === "spoke") {
    return ["prose", "bullets"];
  }
  if (moduleSlug === "year-in-review") {
    return ["prose", "bullets", "image", "pdf", "metrics_flow"];
  }
  return ["prose", "bullets", "image", "pdf"];
}

function isBlockTypeAllowed(moduleSlug: string, blockType: ContentBlock["type"]): boolean {
  return getAllowedBlockTypes(moduleSlug).includes(blockType);
}

/**
 * Check if a module uses full_bleed_single_section layout.
 * These modules only render the primary section on the user-facing page.
 */
function isSingleSectionModule(moduleSlug: string): boolean {
  const entry = getModuleBySlug(moduleSlug);
  return entry?.layout === "full_bleed_single_section";
}

/**
 * Get the required section key for single-section modules.
 * Falls back to "end-vision" if not specified.
 */
function getSingleSectionKey(moduleSlug: string): ModuleSectionKey {
  const entry = getModuleBySlug(moduleSlug);
  const key = entry?.primarySectionKey ?? "end-vision";
  return isModuleSectionKey(key) ? key : "end-vision";
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
  if (action === "module_content_updated") return "update";
  return "update";
}

function auditActionVariant(action: AuditEvent["action"]): "accent" | "muted" | "outline" {
  if (action === "module_content_updated") return "outline";
  return "outline";
}

function newBulletsBlock(): ContentBlock {
  return {
    type: "bullets",
    title: "Bullets",
    description: "Replace with real content.",
    items: ["Add the first bullet…"],
  };
}

function newProseBlock(): ContentBlock {
  return {
    type: "prose",
    title: "Prose",
    description: "Replace with real content.",
    content: "Add your content here...",
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

function newPdfBlock(): ContentBlock {
  return {
    type: "pdf",
    title: "PDF Document",
    path: null,
    filename: null,
    caption: null,
    url: null,
  };
}

/** Generate a stable unique key from label + suffix */
function generateMetricKey(label: string): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "metric";
  return `${base}_${Math.random().toString(36).slice(2, 8)}`;
}

function newMetricsFlowBlock(): Extract<ContentBlock, { type: "metrics_flow" }> {
  return {
    type: "metrics_flow",
    title: "Completed loads",
    subtitle: "By vehicle type",
    totalLabel: "Total completed loads",
    metrics: [
      { key: generateMetricKey("Box Trucks"), label: "Box Trucks", value: 1989, icon: "box-truck" },
      { key: generateMetricKey("Cargo Vans"), label: "Cargo Vans", value: 712, icon: "cargo-van" },
      { key: generateMetricKey("53ft Trailers"), label: "53ft Trailers", value: 1392, icon: "trailer" },
    ],
  };
}

function BlockPreview({ block }: { block: ContentBlock }) {
  if (block.type === "bullets") {
    return (
      <BulletBlock
        title={block.title}
        description={block.description}
        items={block.items}
      />
    );
  }
  if (block.type === "prose") {
    return (
      <ProseBlock
        title={block.title}
        description={block.description}
        content={block.content}
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

  if (block.type === "pdf") {
    return (
      <PdfBlock
        url={block.url}
        title={block.title}
        filename={block.filename}
        caption={block.caption}
        showAdminHint
      />
    );
  }

  if (block.type === "metrics_flow") {
    // Use the same MetricsFlowCard component in compact mode for consistent styling
    return (
      <ContentPanel className="bg-gradient-to-br from-warp-accent/5 to-transparent">
        <MetricsFlowCard
          title={block.title}
          subtitle={block.subtitle}
          totalLabel={block.totalLabel}
          metrics={block.metrics}
          isAdmin={true}
          compact={true}
        />
      </ContentPanel>
    );
  }

  return (
    <ContentPanel title={block.title} description={block.description} className="border-dashed bg-muted/20">
      <div className="text-sm text-muted-foreground">Nothing to show yet.</div>
    </ContentPanel>
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

function ProseEditor({
  value,
  onChange,
}: {
  value: Extract<ContentBlock, { type: "prose" }>;
  onChange: (next: Extract<ContentBlock, { type: "prose" }>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <label className="text-xs font-medium text-muted-foreground">Title (optional)</label>
        <Input
          value={value.title ?? ""}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder="Section title"
        />
      </div>
      <div className="grid gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          Description (optional)
        </label>
        <Input
          value={value.description ?? ""}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          placeholder="Short context"
        />
      </div>
      <div className="grid gap-2">
        <label className="text-xs font-medium text-muted-foreground">Content</label>
        <Textarea
          className="min-h-[120px]"
          value={value.content}
          onChange={(e) => onChange({ ...value, content: e.target.value })}
          placeholder="Enter your content here..."
        />
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
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/20">
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
              layout: layout as "full" | "wide",
            })
          }
        >
          <TabsList className="h-9">
            <TabsTrigger value="full" className="text-xs">
              Full
            </TabsTrigger>
            <TabsTrigger value="wide" className="text-xs">
              Wide
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
          <TabsList className="h-9">
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

function PdfEditor({
  value,
  onChange,
  moduleSlug,
}: {
  value: Extract<ContentBlock, { type: "pdf" }>;
  onChange: (next: Extract<ContentBlock, { type: "pdf" }>) => void;
  moduleSlug: string;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/20 p-4">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">PDF Asset</div>
          <div className="mt-1 truncate text-sm text-foreground">
            {value.path ? value.path : "No PDF selected"}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPickerOpen(true)}
        >
          {value.path ? "Change" : "Select"} PDF
        </Button>
      </div>

      <div className="grid gap-2">
        <label className="text-xs font-medium text-muted-foreground">Title</label>
        <Input
          value={value.title ?? ""}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder="PDF Document"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          Caption (optional)
        </label>
        <Input
          value={value.caption ?? ""}
          onChange={(e) => onChange({ ...value, caption: e.target.value })}
          placeholder="Short caption shown below the PDF"
        />
      </div>

      <AssetPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        moduleSlug={moduleSlug}
        onSelect={(asset) => {
          onChange({
            ...value,
            path: asset.path,
            filename: asset.path.split("/").pop() ?? null,
          });
        }}
      />
    </div>
  );
}

/** All valid icon keys for metrics_flow */
const METRICS_FLOW_ICONS: MetricsFlowIconKey[] = ["box-truck", "cargo-van", "trailer", "package", "warehouse"];
const MAX_METRICS_COUNT = 8;

type MetricsFlowValidation = {
  valid: boolean;
  errors: string[];
};

function validateMetricsFlow(block: Extract<ContentBlock, { type: "metrics_flow" }>): MetricsFlowValidation {
  const errors: string[] = [];
  if (!block.title.trim()) errors.push("Title is required.");
  if (!block.totalLabel.trim()) errors.push("Total label is required.");
  if (block.metrics.length < 2) errors.push("At least 2 metrics are required.");
  if (block.metrics.length > MAX_METRICS_COUNT) errors.push(`Maximum ${MAX_METRICS_COUNT} metrics supported.`);

  const keys = new Set<string>();
  for (const m of block.metrics) {
    if (!m.label.trim()) errors.push(`Metric label cannot be empty.`);
    if (!Number.isFinite(m.value) || m.value < 0) errors.push(`Value for "${m.label || "metric"}" must be >= 0.`);
    if (!Number.isInteger(m.value)) errors.push(`Value for "${m.label || "metric"}" must be an integer.`);
    if (!METRICS_FLOW_ICONS.includes(m.icon)) errors.push(`Invalid icon "${m.icon}".`);
    if (keys.has(m.key)) errors.push(`Duplicate key "${m.key}".`);
    keys.add(m.key);
  }
  return { valid: errors.length === 0, errors };
}

function MetricsFlowEditor({
  value,
  onChange,
}: {
  value: Extract<ContentBlock, { type: "metrics_flow" }>;
  onChange: (next: Extract<ContentBlock, { type: "metrics_flow" }>) => void;
}) {
  const total = value.metrics.reduce((sum, m) => sum + m.value, 0);

  const updateMetric = (index: number, updates: Partial<MetricsFlowItem>) => {
    const newMetrics = [...value.metrics];
    newMetrics[index] = { ...newMetrics[index], ...updates };
    onChange({ ...value, metrics: newMetrics });
  };

  const addMetric = () => {
    if (value.metrics.length >= MAX_METRICS_COUNT) return;
    const newMetric: MetricsFlowItem = {
      key: generateMetricKey("New metric"),
      label: "New metric",
      value: 0,
      icon: "package",
    };
    onChange({ ...value, metrics: [...value.metrics, newMetric] });
  };

  const removeMetric = (index: number) => {
    if (value.metrics.length <= 2) return;
    const newMetrics = value.metrics.filter((_, i) => i !== index);
    onChange({ ...value, metrics: newMetrics });
  };

  const moveMetric = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= value.metrics.length) return;
    const newMetrics = [...value.metrics];
    [newMetrics[index], newMetrics[newIndex]] = [newMetrics[newIndex], newMetrics[index]];
    onChange({ ...value, metrics: newMetrics });
  };

  return (
    <div className="space-y-5">
      {/* Block-level fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground">Title</label>
          <Input
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder="Completed loads"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground">Subtitle (optional)</label>
          <Input
            value={value.subtitle ?? ""}
            onChange={(e) => onChange({ ...value, subtitle: e.target.value || undefined })}
            placeholder="By vehicle type"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-xs font-medium text-muted-foreground">Total label</label>
        <Input
          value={value.totalLabel}
          onChange={(e) => onChange({ ...value, totalLabel: e.target.value })}
          placeholder="Total completed loads"
        />
      </div>

      {/* Computed total (read-only) */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">Total (computed)</span>
        <span className="ml-auto text-lg font-semibold tabular-nums">{total.toLocaleString("en-US")}</span>
      </div>

      {/* Metrics list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Metrics ({value.metrics.length}/{MAX_METRICS_COUNT})
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addMetric}
            disabled={value.metrics.length >= MAX_METRICS_COUNT}
          >
            Add metric
          </Button>
        </div>

        <div className="space-y-2">
          {value.metrics.map((metric, index) => (
            <div
              key={metric.key}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/40 p-3"
            >
              {/* Icon picker */}
              <select
                value={metric.icon}
                onChange={(e) => updateMetric(index, { icon: e.target.value as MetricsFlowIconKey })}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                aria-label="Icon"
              >
                {METRICS_FLOW_ICONS.map((icon) => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>

              {/* Label */}
              <Input
                value={metric.label}
                onChange={(e) => updateMetric(index, { label: e.target.value })}
                placeholder="Label"
                className="min-w-[120px] flex-1"
              />

              {/* Value */}
              <Input
                type="number"
                value={metric.value}
                onChange={(e) => updateMetric(index, { value: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                min={0}
                step={1}
                className="w-24 tabular-nums"
                aria-label="Value"
              />

              {/* Move up/down */}
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => moveMetric(index, "up")}
                  disabled={index === 0}
                  className="h-8 w-8 p-0"
                  aria-label="Move up"
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => moveMetric(index, "down")}
                  disabled={index === value.metrics.length - 1}
                  className="h-8 w-8 p-0"
                  aria-label="Move down"
                >
                  ↓
                </Button>
              </div>

              {/* Remove */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeMetric(index)}
                disabled={value.metrics.length <= 2}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                aria-label="Remove metric"
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Simplified PDF-only editor for Automated Hubs module.
 * Shows a single PDF selector per section instead of the full block list.
 */
function SimplePdfSectionEditor({
  blocks,
  onChange,
  moduleSlug,
  disabled,
}: {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  moduleSlug: string;
  disabled?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);

  // Find existing PDF block or create placeholder
  const pdfBlock = blocks.find((b): b is Extract<ContentBlock, { type: "pdf" }> => b.type === "pdf");
  const hasPdf = pdfBlock && pdfBlock.path;

  const handleSelect = (asset: { path: string }) => {
    const newPdfBlock: Extract<ContentBlock, { type: "pdf" }> = {
      type: "pdf",
      title: pdfBlock?.title ?? "PDF Document",
      path: asset.path,
      filename: asset.path.split("/").pop() ?? null,
      caption: pdfBlock?.caption ?? null,
      url: null,
    };
    // Replace all blocks with just the PDF block
    onChange([newPdfBlock]);
  };

  const handleRemove = () => {
    if (!confirm("Remove the PDF from this section?")) return;
    onChange([]);
  };

  const handleTitleChange = (title: string) => {
    if (!pdfBlock) return;
    onChange([{ ...pdfBlock, title: title || undefined }]);
  };

  const handleCaptionChange = (caption: string) => {
    if (!pdfBlock) return;
    onChange([{ ...pdfBlock, caption: caption || null }]);
  };

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        This module displays a single PDF document per section.
      </div>

      {hasPdf ? (
        <div className="space-y-4 rounded-2xl border border-border bg-background/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium text-muted-foreground">Current PDF</div>
              <div className="mt-1 truncate text-sm text-foreground">
                {pdfBlock.filename ?? pdfBlock.path}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => setPickerOpen(true)}
              >
                Change PDF
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={handleRemove}
              >
                Remove
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input
              value={pdfBlock.title ?? ""}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="PDF Document"
              disabled={disabled}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs font-medium text-muted-foreground">Caption (optional)</label>
            <Input
              value={pdfBlock.caption ?? ""}
              onChange={(e) => handleCaptionChange(e.target.value)}
              placeholder="Short caption shown below the PDF"
              disabled={disabled}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 p-8">
          <div className="text-sm text-muted-foreground">No PDF attached to this section</div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => setPickerOpen(true)}
          >
            Select PDF
          </Button>
        </div>
      )}

      <AssetPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        moduleSlug={moduleSlug}
        onSelect={handleSelect}
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
  const [editedBlock, setEditedBlock] = React.useState<ContentBlock | null>(block);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setEditedBlock(block ? (JSON.parse(JSON.stringify(block)) as ContentBlock) : null);
    setValidationError(null);
  }, [block, open]);

  if (!block || !editedBlock) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit block</DialogTitle>
          <DialogDescription>
            Update the content, then save to apply changes.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 space-y-5">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{blockTypeLabel(editedBlock.type)}</Badge>
            <span className="text-xs text-muted-foreground">
              {editedBlock.type === "bullets"
                ? `${editedBlock.items.length} bullets`
                : editedBlock.type === "prose"
                  ? `${editedBlock.content.length} chars`
                  : editedBlock.type === "image"
                    ? editedBlock.path
                      ? "asset selected"
                      : "no asset"
                    : editedBlock.type === "pdf"
                      ? editedBlock.path
                        ? "PDF selected"
                        : "no PDF"
                      : editedBlock.type === "metrics_flow"
                        ? `${editedBlock.metrics.length} metrics → total: ${editedBlock.metrics.reduce((s, m) => s + m.value, 0).toLocaleString("en-US")}`
                        : "empty"}
            </span>
          </div>

          {editedBlock.type === "bullets" ? (
            <BulletsEditor value={editedBlock} onChange={(next) => setEditedBlock(next)} />
          ) : null}
          {editedBlock.type === "prose" ? (
            <ProseEditor value={editedBlock} onChange={(next) => setEditedBlock(next)} />
          ) : null}
          {editedBlock.type === "image" ? (
            <ImageEditor
              value={editedBlock}
              onChange={(next) => setEditedBlock(next)}
              moduleSlug={moduleSlug}
              getPreviewUrl={getPreviewUrl}
              onSetPreviewUrl={onSetPreviewUrl}
            />
          ) : null}
          {editedBlock.type === "pdf" ? (
            <PdfEditor
              value={editedBlock}
              onChange={(next) => setEditedBlock(next)}
              moduleSlug={moduleSlug}
            />
          ) : null}
          {editedBlock.type === "metrics_flow" ? (
            <MetricsFlowEditor
              value={editedBlock}
              onChange={(next) => setEditedBlock(next)}
            />
          ) : null}
          {editedBlock.type === "empty" ? (
            <div className="space-y-4">
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Title
                </label>
                <Input
                  value={editedBlock.title}
                  onChange={(e) =>
                    setEditedBlock({ ...editedBlock, title: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Description (optional)
                </label>
                <Input
                  value={editedBlock.description ?? ""}
                  onChange={(e) =>
                    setEditedBlock({ ...editedBlock, description: e.target.value })
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
              if (editedBlock.type === "image") {
                if (!editedBlock.alt.trim()) {
                  setValidationError("Alt text is required for images.");
                  return;
                }
                if (!editedBlock.assetId && !editedBlock.path) {
                  setValidationError("Select an asset to attach to this block.");
                  return;
                }
              }
              if (editedBlock.type === "pdf") {
                if (!editedBlock.path) {
                  setValidationError("Select a PDF file to attach to this block.");
                  return;
                }
              }
              if (editedBlock.type === "metrics_flow") {
                const validation = validateMetricsFlow(editedBlock);
                if (!validation.valid) {
                  setValidationError(validation.errors.join(" "));
                  return;
                }
              }
              setValidationError(null);
              onSave(editedBlock);
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
        const doc = sectionsByModule[mod.slug]?.[key];
        const blocks = doc?.blocks ? deepCloneBlocks(doc.blocks) : fallback;
        perSection[key] = {
          content: {
            blocks,
            source: doc?.blocks ? "db" : "seed",
            updatedAt: doc?.updatedAt,
          },
        };
      }
      initial[mod.slug] = perSection as Record<ModuleSectionKey, StudioSectionState>;
    }
    return initial as StudioState;
  });

  const activeConfig = modules.find((m) => m.slug === activeModule) ?? null;
  const activeSectionState = state[activeModule]?.[activeSection] ?? null;

  const currentBlocks = activeSectionState?.content.blocks ?? EMPTY_BLOCKS;
  const actionsDisabled = !dbAvailable || !auditAvailable || isPending;
  const editingDisabled = !dbAvailable || isPending;

  const previewBlocks = currentBlocks.map((block) => {
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

  const editingBlock = editingIndex === null ? null : currentBlocks[editingIndex] ?? null;

  React.useEffect(() => {
    if (activeMode === "history") return;

    const paths = new Set<string>();

    for (const block of currentBlocks) {
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
    currentBlocks,
    editingBlock,
    previewUrlByPath,
    supabaseBrowser,
    setPreviewUrl,
  ]);

  const setContentBlocks = React.useCallback(
    (nextBlocks: ContentBlock[]) => {
      setState((prev) => {
        const next: StudioState = { ...prev };
        next[activeModule] = { ...next[activeModule] };
        next[activeModule][activeSection] = {
          ...next[activeModule][activeSection],
          content: {
            ...next[activeModule][activeSection].content,
            blocks: nextBlocks,
          },
        };
        return next;
      });
    },
    [activeModule, activeSection],
  );

  function addBlock(type: "bullets" | "prose" | "image" | "pdf" | "metrics_flow") {
    if (type === "bullets") {
      setContentBlocks([...currentBlocks, newBulletsBlock()]);
      setNotice(null);
      return;
    }

    if (type === "prose") {
      setContentBlocks([...currentBlocks, newProseBlock()]);
      setNotice(null);
      return;
    }

    if (type === "pdf") {
      const next = [...currentBlocks, newPdfBlock()];
      setContentBlocks(next);
      setEditingIndex(next.length - 1);
      setNotice("Select a PDF file before saving.");
      return;
    }

    if (type === "metrics_flow") {
      const next = [...currentBlocks, newMetricsFlowBlock()];
      setContentBlocks(next);
      setEditingIndex(next.length - 1);
      setNotice(null);
      return;
    }

    const next = [...currentBlocks, newImageBlock()];
    setContentBlocks(next);
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

  function saveChanges() {
    startTransition(async () => {
      setNotice(null);
      const result = await saveModuleSection(activeModule, activeSection, currentBlocks);
      if (!result.ok) {
        setNotice(result.error);
        return;
      }

      setState((prev) => {
        const next: StudioState = { ...prev };
        next[activeModule] = { ...next[activeModule] };
        next[activeModule][activeSection] = {
          ...next[activeModule][activeSection],
          content: {
            ...next[activeModule][activeSection].content,
            source: "db",
            updatedAt: result.updatedAt,
            blocks: result.blocks ? deepCloneBlocks(result.blocks) : currentBlocks,
          },
        };
        return next;
      });

      appendAuditEvent(result.audit);
      setNotice("Saved.");
    });
  }

  function restoreContentFromAudit(auditId: string) {
    startTransition(async () => {
      setNotice(null);
      const result = await restoreFromAudit(auditId);
      if (!result.ok) {
        setNotice(result.error);
        return;
      }

      if (!result.blocks) {
        setNotice("Restore succeeded but no blocks were returned.");
        return;
      }

      setState((prev) => {
        const next: StudioState = { ...prev };
        const moduleSlug = activeModule;
        next[moduleSlug] = { ...next[moduleSlug] };
        next[moduleSlug][activeSection] = {
          ...next[moduleSlug][activeSection],
          content: {
            ...next[moduleSlug][activeSection].content,
            source: "db",
            updatedAt: result.updatedAt,
            blocks: deepCloneBlocks(result.blocks ?? []),
          },
        };
        return next;
      });

      appendAuditEvent(result.audit);
      setActiveMode("edit");
      setNotice("Saved.");
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
            Edit module section blocks without redeploys. Changes are saved immediately.
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
          description="Run the SQL file to enable history and restore."
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
        <section className="rounded-[var(--warp-radius-xl)] border border-border bg-background/18 backdrop-blur">
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
                      // Reset to primary section for single-section modules
                      if (isSingleSectionModule(m.slug)) {
                        setActiveSection(getSingleSectionKey(m.slug));
                      }
                      setNotice(null);
                      setEditingIndex(null);
                      setRestoreTarget(null);
                      setActiveMode("edit");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      active
                        ? "bg-muted/55 text-foreground"
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
            <div className="rounded-[var(--warp-radius-xl)] border border-border bg-background/18 backdrop-blur">
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
                      {isSingleSectionModule(activeModule) ? (
                        <div className="flex items-center gap-3">
                          <TabsList>
                            <TabsTrigger value={getSingleSectionKey(activeModule)}>
                              {getSingleSectionKey(activeModule) === "end-vision" ? "End vision" :
                               getSingleSectionKey(activeModule) === "progress" ? "Progress" : "Roadmap"}
                            </TabsTrigger>
                          </TabsList>
                          <span className="text-xs text-muted-foreground">
                            Only this section is rendered on the module page.
                          </span>
                        </div>
                      ) : (
                        <TabsList>
                          <TabsTrigger value="end-vision">End vision</TabsTrigger>
                          <TabsTrigger value="progress">Progress</TabsTrigger>
                          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
                        </TabsList>
                      )}

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
                              {isBlockTypeAllowed(activeModule, "bullets") && (
                                <DropdownMenuItem onClick={() => addBlock("bullets")}>
                                  Add Bullets
                                </DropdownMenuItem>
                              )}
                              {isBlockTypeAllowed(activeModule, "prose") && (
                                <DropdownMenuItem onClick={() => addBlock("prose")}>
                                  Add Prose
                                </DropdownMenuItem>
                              )}
                              {isBlockTypeAllowed(activeModule, "image") && (
                                <DropdownMenuItem onClick={() => addBlock("image")}>
                                  Add Image / Diagram
                                </DropdownMenuItem>
                              )}
                              {isBlockTypeAllowed(activeModule, "pdf") && (
                                <DropdownMenuItem onClick={() => addBlock("pdf")}>
                                  Add PDF
                                </DropdownMenuItem>
                              )}
                              {isBlockTypeAllowed(activeModule, "metrics_flow") && (
                                <DropdownMenuItem onClick={() => addBlock("metrics_flow")}>
                                  <div className="flex flex-col items-start gap-0.5">
                                    <span>Add Metrics Flow</span>
                                    <span className="text-[10px] text-muted-foreground">Flow diagram merging KPIs into a total</span>
                                  </div>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}

                        {activeMode === "edit" ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={actionsDisabled}
                            onClick={saveChanges}
                          >
                            {isPending ? "Saving…" : "Save changes"}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                      <Tabs
                        value={activeMode}
                        onValueChange={(v) => {
                          setActiveMode(v === "history" ? "history" : "edit");
                          setNotice(null);
                          setEditingIndex(null);
                          setRestoreTarget(null);
                        }}
                      >
                        <TabsList className="h-9">
                          <TabsTrigger value="edit" className="text-xs">
                            Edit
                          </TabsTrigger>
                          <TabsTrigger value="history" className="text-xs">
                            History
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge
                          variant={
                            activeSectionState?.content.source === "db"
                              ? "outline"
                              : "muted"
                          }
                          className="px-2 py-0.5 text-[11px]"
                        >
                          {activeSectionState?.content.source === "db"
                            ? "Saved"
                            : "Not saved"}
                        </Badge>
                        {activeSectionState?.content.updatedAt ? (
                          <span className="font-mono">
                            {new Date(activeSectionState.content.updatedAt).toLocaleString()}
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
            activeModule === "automated-hubs" ? (
              // Simplified PDF-only editor for Automated Hubs
              <SimplePdfSectionEditor
                blocks={currentBlocks}
                onChange={(blocks) => {
                  setContentBlocks(blocks);
                  setNotice(null);
                }}
                moduleSlug={activeModule}
                disabled={editingDisabled}
              />
            ) : (
              // Standard block list editor for other modules
              <div className="space-y-4">
                <div className="text-xs text-muted-foreground">
                  Content renders using the same components as module pages.
                </div>

                <div className="space-y-4">
                  {currentBlocks.map((block, idx) => {
                    const isUnsupported = !isBlockTypeAllowed(activeModule, block.type);
                    return (
                    <div key={`${block.type}-${idx}`} className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="muted" className="px-2 py-0.5 text-[11px]">
                            {blockTypeLabel(block.type)}
                          </Badge>
                          {isUnsupported && (
                            <Badge variant="destructive" className="px-2 py-0.5 text-[11px]">
                              Unsupported
                            </Badge>
                          )}
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
                              const next = currentBlocks.filter((_, i) => i !== idx);
                              setContentBlocks(next);
                              setNotice(null);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>

                      <BlockPreview block={previewBlocks[idx] ?? block} />
                    </div>
                    );
                  })}
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
                    const blocks = [...currentBlocks];
                    blocks[editingIndex] = next;
                    setContentBlocks(blocks);
                    setNotice(null);
                  }}
                />
              </div>
            )
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
                          Restore
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
                <DialogTitle>Restore this snapshot?</DialogTitle>
                <DialogDescription>
                  This overwrites the current content for this section. The change takes effect immediately.
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
                    restoreContentFromAudit(id);
                  }}
                >
                  Restore
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>
      </div>
    </div>
  );
}
