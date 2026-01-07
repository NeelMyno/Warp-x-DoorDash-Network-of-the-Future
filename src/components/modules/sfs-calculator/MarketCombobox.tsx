"use client";

import * as React from "react";
import { ChevronDown, Search, Check, AlertTriangle, X, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SFS_TOP_MARKETS,
  SFS_US_MARKETS,
  searchMarkets,
  normalizeMarket,
  isTopMarket,
  isKnownMarket,
  NON_TOP_MARKET_BASE_SURCHARGE,
} from "@/lib/sfs-calculator/markets";

interface MarketComboboxProps {
  /** Market name (stored value) */
  value: string;
  /** Called with market name when selection changes */
  onChange: (marketName: string) => void;
  invalid?: boolean;
  disabled?: boolean;
}

export function MarketCombobox({ value, onChange, invalid, disabled }: MarketComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const [highlightIndex, setHighlightIndex] = React.useState(-1);

  const normalizedQuery = normalizeMarket(query);

  // Check if selected value is a known market
  const isUnknownMarket = value && !isKnownMarket(value);
  const isNonTop = value && !isTopMarket(value);

  // Non-top markets for "All Markets" section
  const nonTopMarkets = React.useMemo(
    () => SFS_US_MARKETS.filter((m) => !isTopMarket(m)),
    []
  );

  // Filter markets by query
  const filteredTopMarkets = React.useMemo(() => {
    if (!normalizedQuery) return [...SFS_TOP_MARKETS];
    return searchMarkets(query).filter((m) => isTopMarket(m));
  }, [normalizedQuery, query]);

  const filteredOtherMarkets = React.useMemo(() => {
    if (!normalizedQuery) return nonTopMarkets;
    return searchMarkets(query).filter((m) => !isTopMarket(m));
  }, [normalizedQuery, nonTopMarkets, query]);

  // Combined list for keyboard navigation
  const allOptions = React.useMemo(() => {
    const opts: string[] = [];
    for (const m of filteredTopMarkets) opts.push(m);
    for (const m of filteredOtherMarkets) opts.push(m);
    // Include "Use custom" option if query doesn't match any market
    if (normalizedQuery && filteredTopMarkets.length === 0 && filteredOtherMarkets.length === 0) {
      opts.push(query.trim());
    }
    return opts;
  }, [filteredTopMarkets, filteredOtherMarkets, normalizedQuery, query]);

  // Handle outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // Focus input when opened
  React.useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      setHighlightIndex(-1);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, allOptions.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && allOptions[highlightIndex]) {
          selectMarket(allOptions[highlightIndex]);
        } else if (allOptions.length > 0) {
          selectMarket(allOptions[0]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setQuery("");
        break;
    }
  };

  const selectMarket = (marketName: string) => {
    onChange(marketName);
    setOpen(false);
    setQuery("");
  };

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.querySelector(`[data-index="${highlightIndex}"]`);
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={value ? `Market: ${value}` : "Select market"}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border bg-background/50 px-3 py-2 text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          invalid || isUnknownMarket
            ? "border-[var(--warp-field-error)] focus-visible:ring-[var(--warp-focus-ring-danger)]"
            : "border-border/60 focus-visible:ring-[var(--warp-focus-ring)]",
          !value && "text-muted-foreground"
        )}
      >
        <span className="truncate">{value || "Select market"}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {/* Unknown market warning */}
      {isUnknownMarket && (
        <div className="mt-1 flex items-center gap-1 text-xs text-amber-500">
          <AlertTriangle className="h-3 w-3" />
          <span>Unknown market. Consider selecting from the list.</span>
        </div>
      )}



      {/* Dropdown panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Select market"
          className={cn(
            "absolute left-0 top-full z-50 mt-1 w-full min-w-[340px] overflow-hidden rounded-xl",
            "border border-border bg-popover shadow-[var(--shadow-elev-2)]"
          )}
        >
          {/* Header */}
          <div className="border-b border-border/50 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Select market</h3>
                <p className="text-[11px] text-muted-foreground">
                  Top 10 markets have no surcharge. Others add +${NON_TOP_MARKET_BASE_SURCHARGE}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                }}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Search input */}
          <div className="border-b border-border/50 p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlightIndex(-1);
                }}
                placeholder="Search markets..."
                className={cn(
                  "h-9 w-full rounded-lg border border-border/50 bg-background/50 pl-9 pr-3 text-sm",
                  "placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--warp-focus-ring)]"
                )}
              />
            </div>
          </div>

          {/* Market list */}
          <div ref={listRef} className="max-h-[340px] overflow-y-auto p-1" role="listbox">
            {/* Quick-pick Top 10 as pills (only when not searching) */}
            {!normalizedQuery && (
              <div className="mb-2 p-2">
                <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Quick Pick — Top 10 Markets
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SFS_TOP_MARKETS.map((market) => (
                    <button
                      key={market}
                      type="button"
                      onClick={() => selectMarket(market)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors",
                        value === market
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/60 text-foreground hover:bg-muted"
                      )}
                    >
                      <span>{market}</span>
                      {value === market && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Filtered Top 10 (when searching) */}
            {normalizedQuery && filteredTopMarkets.length > 0 && (
              <div className="mb-1">
                <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Top 10 Markets
                </div>
                {filteredTopMarkets.map((market, idx) => (
                  <MarketListItem
                    key={market}
                    market={market}
                    isSelected={value === market}
                    isHighlighted={highlightIndex === idx}
                    isTop={true}
                    dataIndex={idx}
                    onClick={() => selectMarket(market)}
                  />
                ))}
              </div>
            )}

            {/* Other markets list */}
            {(normalizedQuery ? filteredOtherMarkets.length > 0 : true) && (
              <div>
                <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {normalizedQuery ? "All Markets" : "Browse All Markets"}
                </div>
                {(normalizedQuery ? filteredOtherMarkets : nonTopMarkets).map((market, idx) => {
                  const globalIdx = filteredTopMarkets.length + idx;
                  return (
                    <MarketListItem
                      key={market}
                      market={market}
                      isSelected={value === market}
                      isHighlighted={highlightIndex === globalIdx}
                      isTop={false}
                      dataIndex={globalIdx}
                      onClick={() => selectMarket(market)}
                    />
                  );
                })}
              </div>
            )}

            {/* No results - offer to use custom market name */}
            {normalizedQuery && filteredTopMarkets.length === 0 && filteredOtherMarkets.length === 0 && (
              <div className="px-3 py-4 text-center">
                <MapPin className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium text-foreground">No market found</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">
                  You can still use a custom market name.
                </p>
                <button
                  type="button"
                  onClick={() => selectMarket(query.trim())}
                  className={cn(
                    "w-full rounded-lg border border-border/50 px-3 py-2 text-left text-sm",
                    "hover:bg-muted/50 transition-colors",
                    highlightIndex === 0 && "bg-muted"
                  )}
                >
                  <span className="text-muted-foreground">Use:</span>{" "}
                  <span className="font-medium">&quot;{query.trim()}&quot;</span>
                  <span className="ml-2 text-[10px] text-amber-500">+${NON_TOP_MARKET_BASE_SURCHARGE}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MarketListItem subcomponent
// ─────────────────────────────────────────────────────────────────────────────

interface MarketListItemProps {
  market: string;
  isSelected: boolean;
  isHighlighted: boolean;
  isTop: boolean;
  dataIndex: number;
  onClick: () => void;
}

function MarketListItem({
  market,
  isSelected,
  isHighlighted,
  isTop,
  dataIndex,
  onClick,
}: MarketListItemProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      data-index={dataIndex}
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
        isHighlighted && "bg-muted",
        isSelected && "text-primary",
        !isHighlighted && !isSelected && "hover:bg-muted/50"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{market}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {isTop && (
          <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            Top 10
          </span>
        )}
        {isSelected && <Check className="h-4 w-4 text-primary" />}
      </div>
    </button>
  );
}

