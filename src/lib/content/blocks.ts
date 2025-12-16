import type { ContentBlock } from "@/config/modules";

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
  // Allow empty arrays - this is valid when all blocks are deleted
  return blocks;
}
