export type ModuleContentView = "published" | "draft";

export function isModuleContentView(
  value: string | undefined,
): value is ModuleContentView {
  return value === "published" || value === "draft";
}

