import * as React from "react";

import { ContentPanel } from "@/components/panels/ContentPanel";

export function BulletBlock({
  title,
  description,
  items,
}: {
  title: string;
  description?: string;
  items: string[];
}) {
  return (
    <ContentPanel title={title} description={description}>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </ContentPanel>
  );
}

