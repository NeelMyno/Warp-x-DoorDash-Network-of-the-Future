export default function LoadingModule() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-64 animate-pulse rounded-lg bg-muted/60" />
        <div className="h-4 w-[520px] max-w-full animate-pulse rounded-lg bg-muted/45" />
      </div>
      <div className="h-10 w-80 animate-pulse rounded-xl bg-muted/45" />
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="space-y-3">
          <div className="h-4 w-40 animate-pulse rounded-lg bg-muted/50" />
          <div className="h-4 w-[560px] max-w-full animate-pulse rounded-lg bg-muted/40" />
          <div className="h-4 w-[520px] max-w-full animate-pulse rounded-lg bg-muted/40" />
          <div className="h-4 w-[460px] max-w-full animate-pulse rounded-lg bg-muted/40" />
        </div>
      </div>
    </div>
  );
}

