"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { formatCurrency, formatPercent } from "@/lib/sfs-calculator/format";

export type SortOption = "cpp" | "savings_dollars" | "savings_pct";

export type AnchorListItem = {
  anchor_id: string;
  regularCpp: number;
  withDensityCpp: number;
  savingsCpp: number;
  savingsPct: number;
  totalPackages: number;
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "cpp", label: "With density CPP" },
  { value: "savings_dollars", label: "Savings $" },
  { value: "savings_pct", label: "Savings %" },
];

export function AnchorListPanel(props: {
  anchors: AnchorListItem[];
  selectedAnchorId: string | null;
  onSelect: (anchorId: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}) {
  const { anchors, selectedAnchorId, onSelect, sortBy, onSortChange } = props;

  const sortedAnchors = React.useMemo(() => {
    const arr = [...anchors];
    switch (sortBy) {
      case "cpp":
        return arr.sort((a, b) => a.withDensityCpp - b.withDensityCpp);
      case "savings_dollars":
        return arr.sort((a, b) => b.savingsCpp - a.savingsCpp);
      case "savings_pct":
        return arr.sort((a, b) => b.savingsPct - a.savingsPct);
      default:
        return arr;
    }
  }, [anchors, sortBy]);

  return (
    <div className="flex h-full flex-col">
      {/* Sort dropdown */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {anchors.length} anchor{anchors.length !== 1 ? "s" : ""}
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="appearance-none rounded-lg border border-border bg-background/10 py-1 pl-2 pr-7 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort: {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        </div>
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
                "w-full rounded-xl border px-3 py-3 text-left transition",
                isActive
                  ? "border-primary/40 bg-primary/10"
                  : "border-border bg-background/10 hover:bg-background/15",
              ].join(" ")}
            >
              {/* Header row */}
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-xs text-foreground">{anchor.anchor_id}</div>
                {hasSavings ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warp-success-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--warp-success-strong)]">
                    Save {formatCurrency(anchor.savingsCpp)}/pkg
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">No savings</span>
                )}
              </div>

              {/* CPP comparison */}
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-muted-foreground">Regular CPP</div>
                  <div className="mt-0.5 font-mono text-sm text-foreground/70">
                    {anchor.totalPackages > 0 ? formatCurrency(anchor.regularCpp) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">With density CPP</div>
                  <div className="mt-0.5 font-mono text-sm font-semibold text-foreground">
                    {anchor.totalPackages > 0 ? formatCurrency(anchor.withDensityCpp) : "—"}
                  </div>
                </div>
              </div>

              {/* Savings row */}
              {hasSavings && (
                <div className="mt-2 text-[10px] text-[var(--warp-success-strong)]">
                  ↓ {formatPercent(anchor.savingsPct)} savings
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

