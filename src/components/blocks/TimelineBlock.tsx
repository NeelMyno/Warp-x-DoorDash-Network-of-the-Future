import * as React from "react";

import type { TimelineItem } from "@/config/modules";
import { ContentPanel } from "@/components/panels/ContentPanel";

export function TimelineBlock({
  title,
  description,
  items,
}: {
  title: string;
  description?: string;
  items: TimelineItem[];
}) {
  return (
    <ContentPanel title={title} description={description}>
      <ol className="relative space-y-4 pl-5">
        <div className="pointer-events-none absolute left-[7px] top-2 h-[calc(100%-8px)] w-px bg-border" />
        {items.map((item) => (
          <li key={`${item.date}-${item.title}`} className="relative">
            <span className="absolute -left-5 top-2 grid h-3.5 w-3.5 place-items-center rounded-full border border-border bg-background/40">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/80" />
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-[11px] text-muted-foreground">
                {item.date}
              </span>
              <span className="text-sm font-medium text-foreground">
                {item.title}
              </span>
            </div>
            {item.body ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {item.body}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </ContentPanel>
  );
}
