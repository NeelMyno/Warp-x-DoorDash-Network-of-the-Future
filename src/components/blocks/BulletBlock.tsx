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
  // Premium bullet list: intentional spacing, readable contrast
  const bulletList = (
    <ul className="space-y-2.5">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-3">
          {/* Small dot marker aligned with first line of text */}
          <span
            className="mt-[8px] h-[5px] w-[5px] shrink-0 rounded-full bg-primary/50"
            aria-hidden="true"
          />
          <span className="min-w-0 text-[14px] leading-[1.7] text-foreground/80">
            {item}
          </span>
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

