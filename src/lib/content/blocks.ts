import type { ContentBlock, KpiItem, TimelineItem } from "@/config/modules";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function asString(value: unknown): string | null {
  return isString(value) ? value : null;
}

function asOptionalString(value: unknown): string | undefined {
  return isString(value) ? value : undefined;
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

function parseKpiItems(value: unknown): KpiItem[] | null {
  if (!Array.isArray(value)) return null;
  const items: KpiItem[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) return null;
    const label = asString(raw.label);
    const valueStr = asString(raw.value);
    if (!label || !valueStr) return null;
    items.push({
      label,
      value: valueStr,
      delta: asOptionalString(raw.delta),
      helper: asOptionalString(raw.helper),
    });
  }
  return items;
}

function parseTimelineItems(value: unknown): TimelineItem[] | null {
  if (!Array.isArray(value)) return null;
  const items: TimelineItem[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) return null;
    const title = asString(raw.title);
    const date = asString(raw.date);
    if (!title || !date) return null;
    items.push({
      title,
      date,
      body: asOptionalString(raw.body ?? raw.description),
    });
  }
  return items;
}

function parseBlock(raw: unknown): ContentBlock | null {
  if (!isRecord(raw)) return null;

  const type = asString(raw.type);
  if (!type) return null;

  if (type === "kpis" || type === "kpi-strip") {
    const items = parseKpiItems(raw.items);
    if (!items) return null;
    return {
      type: "kpis",
      title: asOptionalString(raw.title),
      items,
    };
  }

  if (type === "bullets") {
    const items = asStringArray(raw.items);
    if (!items) return null;
    return {
      type: "bullets",
      title: asString(raw.title) ?? "Bullets",
      description: asOptionalString(raw.description),
      items,
    };
  }

  if (type === "timeline") {
    const items = parseTimelineItems(raw.items);
    if (!items) return null;
    return {
      type: "timeline",
      title: asString(raw.title) ?? "Timeline",
      description: asOptionalString(raw.description),
      items,
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

    const validLayout =
      layout === undefined ||
      layout === "full" ||
      layout === "wide" ||
      layout === "half-left" ||
      layout === "half-right";
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
      layout: layout as
        | "full"
        | "wide"
        | "half-left"
        | "half-right"
        | undefined,
      treatment: treatment as "plain" | "panel" | undefined,
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
  return blocks.length ? blocks : null;
}
