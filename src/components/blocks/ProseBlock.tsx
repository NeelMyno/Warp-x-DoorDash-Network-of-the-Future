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
  return (
    <ContentPanel title={title} description={description}>
      <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none text-muted-foreground">
        {content}
      </div>
    </ContentPanel>
  );
}

