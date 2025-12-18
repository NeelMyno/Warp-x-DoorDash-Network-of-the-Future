"use client";

import * as React from "react";

import type { AutomationNode, AutomationStatus } from "@/lib/network-enhancements/insights-schema";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type FilterKey =
  | "all"
  | "hubs"
  | "spokes"
  | "automated"
  | "partial"
  | "manual";

function statusLabel(status: AutomationStatus) {
  if (status === "automated") return "Automated";
  if (status === "partial") return "Partial";
  return "Manual";
}

function statusBadgeClass(status: AutomationStatus) {
  if (status === "automated") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "partial") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return "border-border/60 bg-muted/20 text-muted-foreground";
}

function filterLabel(key: FilterKey) {
  switch (key) {
    case "hubs":
      return "Hubs";
    case "spokes":
      return "Spokes";
    case "automated":
      return "Automated";
    case "partial":
      return "Partial";
    case "manual":
      return "Manual";
    default:
      return "All";
  }
}

function nodeTypeLabel(value: AutomationNode["node_type"]) {
  return value === "hub" ? "Hub" : "Spoke";
}

function nodeTypeBadge(value: AutomationNode["node_type"]) {
  return value === "hub"
    ? "border-sky-500/25 bg-sky-500/10 text-sky-200"
    : "border-violet-500/25 bg-violet-500/10 text-violet-200";
}

export function AutomationCoverageTable({
  nodes,
}: {
  nodes: AutomationNode[];
}) {
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [selected, setSelected] = React.useState<AutomationNode | null>(null);

  const counts = React.useMemo(() => {
    const out = { automated: 0, partial: 0, manual: 0 } as Record<AutomationStatus, number>;
    for (const n of nodes) out[n.automation_status] += 1;
    return out;
  }, [nodes]);

  const filtered = React.useMemo(() => {
    return nodes.filter((n) => {
      if (filter === "hubs") return n.node_type === "hub";
      if (filter === "spokes") return n.node_type === "spoke";
      if (filter === "automated") return n.automation_status === "automated";
      if (filter === "partial") return n.automation_status === "partial";
      if (filter === "manual") return n.automation_status === "manual";
      return true;
    });
  }, [filter, nodes]);

  const chips: Array<{ key: FilterKey; count?: number }> = [
    { key: "all" },
    { key: "hubs" },
    { key: "spokes" },
    { key: "automated", count: counts.automated },
    { key: "partial", count: counts.partial },
    { key: "manual", count: counts.manual },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn("px-2 py-0.5 text-[11px]", statusBadgeClass("automated"))}>
          Automated <span className="ml-1 font-mono">{counts.automated}</span>
        </Badge>
        <Badge variant="outline" className={cn("px-2 py-0.5 text-[11px]", statusBadgeClass("partial"))}>
          Partial <span className="ml-1 font-mono">{counts.partial}</span>
        </Badge>
        <Badge variant="outline" className={cn("px-2 py-0.5 text-[11px]", statusBadgeClass("manual"))}>
          Manual <span className="ml-1 font-mono">{counts.manual}</span>
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === c.key
                ? "border-border bg-background/40 text-foreground"
                : "border-border/60 bg-background/15 text-muted-foreground hover:bg-background/25 hover:text-foreground",
            )}
          >
            {filterLabel(c.key)}
            {typeof c.count === "number" ? (
              <span className="ml-1 font-mono text-[11px] opacity-80">{c.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-background/10">
        <div className="hidden grid-cols-[1.4fr_120px_1fr_140px_1fr] gap-0 border-b border-border/60 px-4 py-3 text-xs font-medium text-muted-foreground sm:grid">
          <div>Node</div>
          <div>Type</div>
          <div>Market / region</div>
          <div>Status</div>
          <div>Notes</div>
        </div>

        <div className="divide-y divide-border/60">
          {filtered.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setSelected(n)}
              className={cn(
                "grid w-full cursor-pointer gap-2 px-4 py-3 text-left transition-colors hover:bg-background/20",
                "sm:grid-cols-[1.4fr_120px_1fr_140px_1fr] sm:items-center sm:gap-0",
              )}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{n.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:hidden">
                  <span className="rounded-full border border-border/60 bg-background/10 px-2 py-0.5">
                    {nodeTypeLabel(n.node_type)}
                  </span>
                  <span className="rounded-full border border-border/60 bg-background/10 px-2 py-0.5">
                    {statusLabel(n.automation_status)}
                  </span>
                </div>
              </div>

              <div className="hidden sm:block">
                <Badge variant="outline" className={cn("px-2 py-0.5 text-[11px]", nodeTypeBadge(n.node_type))}>
                  {nodeTypeLabel(n.node_type)}
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground sm:text-sm">
                <div className="truncate">
                  {n.market?.trim() ? n.market.trim() : "—"}
                  {n.region?.trim() ? (
                    <span className="text-muted-foreground/70"> · {n.region.trim()}</span>
                  ) : null}
                </div>
              </div>

              <div className="hidden sm:block">
                <Badge variant="outline" className={cn("px-2 py-0.5 text-[11px]", statusBadgeClass(n.automation_status))}>
                  {statusLabel(n.automation_status)}
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground sm:text-sm">
                <div className="max-h-10 overflow-hidden text-ellipsis">
                  {n.notes?.trim() ? n.notes.trim() : "—"}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => (!open ? setSelected(null) : null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Node details</DialogTitle>
          </DialogHeader>

          {selected ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-foreground">{selected.name}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn("px-2 py-0.5 text-[11px]", nodeTypeBadge(selected.node_type))}
                  >
                    {nodeTypeLabel(selected.node_type)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "px-2 py-0.5 text-[11px]",
                      statusBadgeClass(selected.automation_status),
                    )}
                  >
                    {statusLabel(selected.automation_status)}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-2 rounded-xl border border-border bg-background/10 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-medium text-muted-foreground">Market</div>
                  <div className="font-mono text-xs text-foreground">
                    {selected.market?.trim() ? selected.market.trim() : "—"}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-medium text-muted-foreground">Region</div>
                  <div className="font-mono text-xs text-foreground">
                    {selected.region?.trim() ? selected.region.trim() : "—"}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Notes</div>
                <div className="whitespace-pre-wrap rounded-xl border border-border bg-muted/10 p-3 text-sm text-foreground">
                  {selected.notes?.trim() ? selected.notes.trim() : "No notes."}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
