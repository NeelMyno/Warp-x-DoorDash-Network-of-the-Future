"use client";

import * as React from "react";
import { ChevronDown, Search } from "lucide-react";

import { formatCurrency, formatPercent } from "@/lib/sfs-calculator/format";
import { Input } from "@/components/ui/input";

export type SortOption = "savings_dollars" | "cpp";

export type AnchorListItem = {
  anchor_id: string;
  regularCpp: number;
  withDensityCpp: number;
  savingsCpp: number;
  savingsPct: number;
  totalPackages: number;
  storeName?: string;
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "savings_dollars", label: "Savings" },
  { value: "cpp", label: "With density CPP" },
];

export function AnchorListPanel(props: {
  anchors: AnchorListItem[];
  selectedAnchorId: string | null;
  onSelect: (anchorId: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}) {
  const { anchors, selectedAnchorId, onSelect, sortBy, onSortChange } = props;
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredAnchors = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return anchors;
    return anchors.filter(
      (a) =>
        a.anchor_id.toLowerCase().includes(q) ||
        (a.storeName?.toLowerCase().includes(q) ?? false)
    );
  }, [anchors, searchQuery]);

  const sortedAnchors = React.useMemo(() => {
    const arr = [...filteredAnchors];
    switch (sortBy) {
      case "cpp":
        return arr.sort((a, b) => a.withDensityCpp - b.withDensityCpp);
      case "savings_dollars":
        return arr.sort((a, b) => b.savingsCpp - a.savingsCpp);
      default:
        return arr;
    }
  }, [filteredAnchors, sortBy]);

  return (
    <div data-tour="anchors" className="flex h-full flex-col">
      {/* Search + Sort row */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search anchor store..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="appearance-none rounded-lg border border-border bg-background/10 py-1 pl-2 pr-7 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      <div className="mb-2 text-[11px] text-muted-foreground">
        {sortedAnchors.length} anchor store{sortedAnchors.length !== 1 ? "s" : ""}
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {/* Anchor list */}
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {sortedAnchors.map((anchor) => {
          const isActive = anchor.anchor_id === selectedAnchorId;
          const hasSavings = anchor.savingsCpp > 0;

          return (
            <button
              key={anchor.anchor_id}
              type="button"
              onClick={() => onSelect(anchor.anchor_id)}
              className={[
                "w-full rounded-xl border px-3 py-2.5 text-left transition",
                isActive
                  ? "border-primary/40 bg-primary/10"
                  : "border-border bg-background/10 hover:bg-background/15",
              ].join(" ")}
            >
              {/* Header row */}
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-xs font-medium text-foreground">
                  {anchor.anchor_id}
                  {anchor.storeName && (
                    <span className="ml-1 text-muted-foreground">
                      · {anchor.storeName}
                    </span>
                  )}
                </div>
              </div>

              {/* CPP comparison */}
              <div className="mt-1.5 flex items-baseline gap-3">
                <div>
                  <span className="tabular-nums text-sm font-semibold text-foreground">
                    {anchor.totalPackages > 0 ? formatCurrency(anchor.withDensityCpp) : "—"}
                  </span>
                  <span className="ml-1 text-[11px] text-muted-foreground">CPP</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  was{" "}
                  <span className="tabular-nums line-through">
                    {formatCurrency(anchor.regularCpp)}
                  </span>
                </div>
              </div>

              {/* Savings chip */}
              {hasSavings && (
                <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--warp-success-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--warp-success-strong)]">
                  Save {formatCurrency(anchor.savingsCpp)} ({formatPercent(anchor.savingsPct)})
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

