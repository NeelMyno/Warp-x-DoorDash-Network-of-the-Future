import { cn } from "@/lib/utils";

type Block =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

function parseMarkdownLite(input: string): Block[] {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .map((l) => (l.trim() ? l : ""));

  const blocks: Block[] = [];
  let currentList: string[] | null = null;
  let currentParagraph: string[] | null = null;

  const flushParagraph = () => {
    if (!currentParagraph?.length) return;
    const text = currentParagraph.join(" ").trim();
    if (text) blocks.push({ type: "p", text });
    currentParagraph = null;
  };

  const flushList = () => {
    if (!currentList?.length) return;
    blocks.push({ type: "ul", items: currentList });
    currentList = null;
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const match = /^[-*•]\s+(.*)$/.exec(line);
    if (match?.[1]) {
      flushParagraph();
      if (!currentList) currentList = [];
      currentList.push(match[1].trim());
      continue;
    }

    flushList();
    if (!currentParagraph) currentParagraph = [];
    currentParagraph.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}

export function MarkdownLite({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const blocks = parseMarkdownLite(value);

  return (
    <div className={cn("space-y-3 text-sm text-foreground", className)}>
      {blocks.map((b, idx) => {
        if (b.type === "p") {
          return (
            <p key={idx} className="leading-relaxed text-muted-foreground">
              {b.text}
            </p>
          );
        }

        return (
          <ul key={idx} className="space-y-2">
            {b.items.map((item, i) => (
              <li key={i} className="flex gap-2 leading-relaxed text-muted-foreground">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary/80" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}

