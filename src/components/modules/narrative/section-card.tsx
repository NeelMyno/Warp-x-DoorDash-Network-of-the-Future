import * as React from "react";

import { cn } from "@/lib/utils";

export interface SectionCardProps {
  /** Unique anchor ID for this section (e.g., "end-vision") */
  id?: string;
  title: string;
  children: React.ReactNode;
  isEmpty?: boolean;
  className?: string;
}

/**
 * Quiet section card for module content.
 * Subtle surface, thin border, left accent line only.
 * Has anchor support with scroll-margin-top for direct linking.
 */
export function SectionCard({
  id,
  title,
  children,
  isEmpty,
  className,
}: SectionCardProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/80 bg-card/50",
        // scroll-margin for sticky header offset when navigating via anchor
        "scroll-mt-[var(--warp-anchor-offset)]",
        className
      )}
    >
      {/* Thin left accent line */}
      <div
        className="absolute left-0 top-0 h-full w-[2px]"
        style={{ background: "var(--warp-accent-bar-muted)" }}
        aria-hidden="true"
      />

      <div className="px-5 py-5">
        {/* Section title */}
        <h2 className="mb-4 text-[15px] font-semibold tracking-tight text-foreground/95">
          {title}
        </h2>

        {/* Content area */}
        <div className="module-content">
          {isEmpty ? (
            <p className="text-[13px] italic text-muted-foreground/70">
              No updates yet.
            </p>
          ) : (
            children
          )}
        </div>
      </div>
    </section>
  );
}

