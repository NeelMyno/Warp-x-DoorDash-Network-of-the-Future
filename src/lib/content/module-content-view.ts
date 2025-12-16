/**
 * Module content view type.
 * After draft removal, only "published" view exists.
 * Keeping this type for backwards compatibility with URL params.
 */
export type ModuleContentView = "published";

export function isModuleContentView(value: unknown): value is ModuleContentView {
  return value === "published";
}

