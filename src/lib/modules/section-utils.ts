/**
 * Pure utility functions for module section handling.
 * Extracted for testability - no React dependencies.
 */

/** Minimal section shape for selection logic */
export interface SectionMeta {
  key: string;
  isEmpty?: boolean;
}

/**
 * Resilient section picker with fallback order:
 * 1. Section with key "end-vision" (if exists and non-empty)
 * 2. First non-empty section (if end-vision is missing or empty)
 * 3. First section (even if empty, for structure)
 * 4. undefined (no sections at all)
 *
 * This handles edge cases like:
 * - Legacy content with renamed section keys
 * - Only Progress has content by mistake
 * - Missing or empty sections array
 */
export function pickPrimarySection<T extends SectionMeta>(
  sections: T[]
): T | undefined {
  if (!sections || sections.length === 0) return undefined;

  // 1. Prefer end-vision section if non-empty
  const endVision = sections.find((s) => s.key === "end-vision");
  if (endVision && !endVision.isEmpty) return endVision;

  // 2. Fall back to first non-empty section
  const firstNonEmpty = sections.find((s) => !s.isEmpty);
  if (firstNonEmpty) return firstNonEmpty;

  // 3. Return first section (even if empty) for structure
  return sections[0];
}

