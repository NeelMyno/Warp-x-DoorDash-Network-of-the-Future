import * as React from "react";

import { ContentPanel } from "@/components/panels/ContentPanel";

export function BulletBlock({
  title,
  description,
  items,
}: {
  title?: string;
  description?: string;
  items: string[];
}) {
  // If no title/description, render bullets directly without panel wrapper
  const bulletList = (
    <ul className="space-y-2 text-sm text-muted-foreground">
      {items.map((item, idx) => (
        <li key={idx} className="flex gap-3">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );

  if (!title && !description) {
    return bulletList;
  }

  return (
    <ContentPanel title={title} description={description}>
      {bulletList}
    </ContentPanel>
  );
}

