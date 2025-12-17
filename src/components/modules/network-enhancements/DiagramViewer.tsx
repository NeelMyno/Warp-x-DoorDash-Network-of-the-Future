import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function EmptyPane({
  title,
  description,
  adminHint,
}: {
  title: string;
  description: string;
  adminHint?: string;
}) {
  return (
    <div className="grid h-full min-h-[240px] place-items-center rounded-2xl border border-dashed border-border bg-muted/10 p-6 text-center">
      <div className="max-w-[48ch] space-y-2">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
        {adminHint ? (
          <div className="pt-1 text-xs text-muted-foreground">{adminHint}</div>
        ) : null}
      </div>
    </div>
  );
}

export function DiagramViewer({
  url,
  filename,
  isAdmin,
  className,
}: {
  url: string | null;
  filename?: string | null;
  isAdmin?: boolean;
  className?: string;
}) {
  if (!url) {
    return (
      <EmptyPane
        title="Diagram not available"
        description="This view hasn’t been configured yet."
        adminHint={isAdmin ? "Configure in Admin → Setup & Diagnostics." : undefined}
      />
    );
  }

  const alt = filename?.trim() ? filename.trim() : "Facility diagram";

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">Diagram</div>
          {filename ? (
            <div className="mt-0.5 truncate text-sm font-medium text-foreground">
              {filename}
            </div>
          ) : null}
        </div>
        <Button asChild size="sm" variant="outline">
          <a href={url} target="_blank" rel="noreferrer">
            Open
          </a>
        </Button>
      </div>

      <div className="flex-1 p-4">
        <div className="grid h-full place-items-center overflow-hidden rounded-2xl border border-border/70 bg-background/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            className="block h-full w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}

