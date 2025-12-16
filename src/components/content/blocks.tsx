import type { ContentBlock } from "@/config/modules";
import { BulletBlock } from "@/components/blocks/BulletBlock";
import { ImageBlock } from "@/components/blocks/ImageBlock";
import { ProseBlock } from "@/components/blocks/ProseBlock";
import { ContentPanel } from "@/components/panels/ContentPanel";

/**
 * Renders a list of content blocks in a single-column layout.
 * No two-column grids, no timeline blocks.
 */
export function Blocks({
  blocks,
  showImageHints,
}: {
  blocks: ContentBlock[];
  showImageHints?: boolean;
}) {
  // Empty blocks array - return null; parent should handle empty state
  if (!blocks.length) return null;

  return (
    <div className="flex flex-col gap-5">
      {blocks.map((block, idx) => {
        const key = `${block.type}-${idx}`;

        if (block.type === "bullets") {
          return (
            <BulletBlock
              key={key}
              title={block.title}
              description={block.description}
              items={block.items}
            />
          );
        }

        if (block.type === "prose") {
          return (
            <ProseBlock
              key={key}
              title={block.title}
              description={block.description}
              content={block.content}
            />
          );
        }

        if (block.type === "image") {
          return (
            <ImageBlock
              key={key}
              url={block.url}
              path={block.path}
              alt={block.alt}
              caption={block.caption}
              treatment={block.treatment ?? "panel"}
              showAdminHint={showImageHints}
            />
          );
        }

        if (block.type === "empty") {
          return (
            <ContentPanel
              key={key}
              title={block.title}
              description={block.description}
              className="border-dashed bg-muted/20"
            >
              <div className="text-sm text-muted-foreground">
                Nothing to show yet.
              </div>
            </ContentPanel>
          );
        }

        // Unknown block types are ignored (defensive fallback for legacy data)
        return null;
      })}
    </div>
  );
}

/**
 * Check if blocks array is empty (for parent components to show empty state).
 */
export function isBlocksEmpty(blocks: ContentBlock[]): boolean {
  return blocks.length === 0;
}
