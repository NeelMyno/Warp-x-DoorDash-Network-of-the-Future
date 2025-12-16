import * as React from "react";

import { ContentPanel } from "@/components/panels/ContentPanel";

export function ProseBlock({
  title,
  description,
  content,
}: {
  title?: string;
  description?: string;
  content: string;
}) {
  // Prose without wrapper panel if no title/description
  const proseContent = (
    <p className="max-w-none text-[14px] leading-[1.7] text-foreground/80">
      {content}
    </p>
  );

  if (!title && !description) {
    return proseContent;
  }

  return (
    <ContentPanel title={title} description={description}>
      {proseContent}
    </ContentPanel>
  );
}

