import type { ContentBlock, MetricsFlowItem, MetricsFlowIconKey } from "@/config/modules";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

function asString(value: unknown): string | null {
  return isString(value) ? value : null;
}

function asOptionalString(value: unknown): string | undefined {
  return isString(value) ? value : undefined;
}

function asNumber(value: unknown): number | null {
  if (isNumber(value)) return value;
  // Coerce string to number if valid
  if (isString(value)) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items: string[] = [];
  for (const v of value) {
    if (!isString(v)) return null;
    items.push(v);
  }
  return items;
}

const VALID_METRICS_FLOW_ICONS: MetricsFlowIconKey[] = [
  "box-truck", "cargo-van", "trailer", "package", "warehouse"
];

function isValidMetricsFlowIcon(value: unknown): value is MetricsFlowIconKey {
  return isString(value) && VALID_METRICS_FLOW_ICONS.includes(value as MetricsFlowIconKey);
}

function parseMetricsFlowItem(raw: unknown): MetricsFlowItem | null {
  if (!isRecord(raw)) return null;
  const key = asString(raw.key);
  const label = asString(raw.label);
  const value = asNumber(raw.value);
  const icon = raw.icon;

  if (!key || !label || value === null || value < 0) return null;
  if (!isValidMetricsFlowIcon(icon)) return null;

  return { key, label, value: Math.round(value), icon };
}

function parseMetricsFlowItems(value: unknown): MetricsFlowItem[] | null {
  if (!Array.isArray(value)) return null;
  const items: MetricsFlowItem[] = [];
  for (const raw of value) {
    const parsed = parseMetricsFlowItem(raw);
    if (!parsed) return null; // Strict: all items must be valid
    items.push(parsed);
  }
  // Minimum 2 metrics required
  if (items.length < 2) return null;
  return items;
}

function parseBlock(raw: unknown): ContentBlock | null {
  if (!isRecord(raw)) return null;

  const type = asString(raw.type);
  if (!type) return null;

  // Legacy block types are no longer supported - skip them silently
  if (type === "kpis" || type === "kpi-strip" || type === "timeline") {
    return null;
  }

  if (type === "bullets") {
    const items = asStringArray(raw.items);
    if (!items) return null;
    return {
      type: "bullets",
      title: asOptionalString(raw.title),
      description: asOptionalString(raw.description),
      items,
    };
  }

  if (type === "prose") {
    const content = asString(raw.content);
    if (!content) return null;
    return {
      type: "prose",
      title: asOptionalString(raw.title),
      description: asOptionalString(raw.description),
      content,
    };
  }

  if (type === "image") {
    const alt = asString(raw.alt);
    const assetId = asOptionalString(raw.assetId);
    const path = asOptionalString(raw.path);
    if (!alt) return null;
    if (!assetId && !path) return null;

    const layout = asOptionalString(raw.layout);
    const treatment = asOptionalString(raw.treatment);

    // Simplified layout options for single-column
    const validLayout =
      layout === undefined || layout === "full" || layout === "wide";
    if (!validLayout) return null;

    const validTreatment =
      treatment === undefined || treatment === "plain" || treatment === "panel";
    if (!validTreatment) return null;

    return {
      type: "image",
      assetId,
      path,
      alt,
      caption: asOptionalString(raw.caption),
      layout: layout as "full" | "wide" | undefined,
      treatment: treatment as "plain" | "panel" | undefined,
    };
  }

  if (type === "pdf") {
    // PDF block: path can be null (not configured yet)
    const path = asOptionalString(raw.path) ?? null;
    return {
      type: "pdf",
      title: asOptionalString(raw.title),
      path,
      filename: asOptionalString(raw.filename) ?? null,
      caption: asOptionalString(raw.caption) ?? null,
      url: asOptionalString(raw.url) ?? null,
    };
  }

  if (type === "empty") {
    const title = asString(raw.title);
    if (!title) return null;
    return {
      type: "empty",
      title,
      description: asOptionalString(raw.description),
    };
  }

  if (type === "metrics_flow") {
    const title = asString(raw.title);
    const totalLabel = asString(raw.totalLabel);
    const metrics = parseMetricsFlowItems(raw.metrics);

    if (!title || !totalLabel || !metrics) return null;

    return {
      type: "metrics_flow",
      title,
      subtitle: asOptionalString(raw.subtitle),
      totalLabel,
      metrics,
    };
  }

  return null;
}

/**
 * Tolerant parser:
 * - Returns only the blocks we recognize + can validate
 * - Returns null if nothing valid remains
 */
export function parseBlocksJson(input: unknown): ContentBlock[] | null {
  if (!Array.isArray(input)) return null;
  const blocks: ContentBlock[] = [];
  for (const raw of input) {
    const parsed = parseBlock(raw);
    if (parsed) blocks.push(parsed);
  }
  // Allow empty arrays - this is valid when all blocks are deleted
  return blocks;
}
