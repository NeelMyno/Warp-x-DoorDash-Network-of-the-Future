import * as React from "react";

import { ModuleHeader } from "@/components/modules/narrative/module-header";
import { pickPrimarySection } from "@/lib/modules/section-utils";

/** Section shape expected by the layout */
interface LayoutSection {
  key: string;
  label: string;
  content: React.ReactNode;
  isEmpty?: boolean;
}

export interface FullBleedSingleSectionLayoutProps {
  title: string;
  description?: string;
  sections: LayoutSection[];
  /** Whether current user is admin */
  isAdmin?: boolean;
  /**
   * When set, STRICTLY render only this section key.
   * No fallback to other sections — if this section is missing/empty, show empty state.
   * When not set, uses resilient fallback via pickPrimarySection().
   */
  primarySectionKey?: string;
}

/**
 * Full-bleed single section layout for hero/visualization modules.
 * Renders only one primary section without wrapper cards or section chrome.
 * Full width container (no 70ch constraint) for visualizations.
 *
 * When `primarySectionKey` is specified, rendering is STRICT:
 * - Only that section is rendered
 * - If empty/missing, show empty state (no fallback)
 *
 * Designed for modules like Year in Review where only End Vision content
 * should display on a clean, full-width canvas.
 */
export function FullBleedSingleSectionLayout({
  title,
  description,
  sections,
  isAdmin = false,
  primarySectionKey,
}: FullBleedSingleSectionLayoutProps) {
  const showHeader = Boolean(title);

  // Strict mode: only render the specified section, no fallback
  // Fallback mode: use resilient pickPrimarySection
  const primarySection = primarySectionKey
    ? sections.find((s) => s.key === primarySectionKey)
    : pickPrimarySection(sections);

  // Empty state: no sections or primary section is empty
  if (!primarySection || primarySection.isEmpty) {
    return (
      <article className="w-full max-w-none space-y-8">
        {showHeader && <ModuleHeader title={title} description={description} />}

        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <p className="text-base font-medium text-muted-foreground">
            No content published yet.
          </p>
          {isAdmin ? (
            <p className="mt-3 text-sm text-muted-foreground">
              <a
                href="/admin"
                className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
              >
                Add content in Admin
              </a>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Check back later.
            </p>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="w-full max-w-none space-y-8">
      {showHeader && <ModuleHeader title={title} description={description} />}

      {/* Render content directly — no SectionCard wrapper, no section title */}
      <div className="w-full">{primarySection.content}</div>
    </article>
  );
}

