import type { ContentBlock } from "@/config/modules";
import { BulletBlock } from "@/components/blocks/BulletBlock";
import { ImageBlock } from "@/components/blocks/ImageBlock";
import { KpiStrip } from "@/components/blocks/KpiStrip";
import { TimelineBlock } from "@/components/blocks/TimelineBlock";
import { ContentPanel } from "@/components/panels/ContentPanel";

export function Blocks({
  blocks,
  showImageHints,
}: {
  blocks: ContentBlock[];
  showImageHints?: boolean;
}) {
  const kpiBlocks = blocks.filter(
    (b): b is Extract<ContentBlock, { type: "kpis" }> => b.type === "kpis",
  );
  const otherBlocks = blocks.filter(
    (b): b is Exclude<ContentBlock, { type: "kpis" }> => b.type !== "kpis",
  );

  function layoutClass(block: Exclude<ContentBlock, { type: "kpis" }>) {
    if (block.type !== "image") return "";
    const layout = block.layout ?? "wide";
    if (layout === "full" || layout === "wide") return "lg:col-span-2";
    if (layout === "half-right") return "lg:col-start-2";
    if (layout === "half-left") return "lg:col-start-1";
    return "";
  }

  return (
    <div className="space-y-4">
      {kpiBlocks.map((b, idx) => (
        <KpiStrip key={`${b.type}-${idx}`} title={b.title} items={b.items} />
      ))}

      {otherBlocks.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {otherBlocks.map((block, idx) => {
            const key = `${block.type}-${idx}`;
            const wrapperClass = layoutClass(block);

            if (block.type === "bullets") {
              return (
                <div key={key} className={wrapperClass}>
                  <BulletBlock
                    title={block.title}
                    description={block.description}
                    items={block.items}
                  />
                </div>
              );
            }

            if (block.type === "timeline") {
              return (
                <div key={key} className={wrapperClass}>
                  <TimelineBlock
                    title={block.title}
                    description={block.description}
                    items={block.items}
                  />
                </div>
              );
            }

            if (block.type === "image") {
              return (
                <div key={key} className={wrapperClass}>
                  <ImageBlock
                    url={block.url}
                    path={block.path}
                    alt={block.alt}
                    caption={block.caption}
                    treatment={block.treatment ?? "panel"}
                    showAdminHint={showImageHints}
                  />
                </div>
              );
            }

            if (block.type === "empty") {
              return (
                <div key={key} className={wrapperClass}>
                  <ContentPanel
                    title={block.title}
                    description={block.description}
                    className="border-dashed bg-muted/20"
                  >
                    <div className="text-sm text-muted-foreground">
                      Nothing to show yet.
                    </div>
                  </ContentPanel>
                </div>
              );
            }

            return null;
          })}
        </div>
      ) : null}
    </div>
  );
}
