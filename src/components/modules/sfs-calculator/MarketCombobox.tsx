"use client";

import * as React from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SFS_TOP_MARKETS,
  SFS_US_MARKETS,
  isTopMarket,
  normalizeMarket,
  isKnownMarket,
  NON_TOP_MARKET_BASE_SURCHARGE,
} from "@/lib/sfs-calculator/markets";

interface MarketComboboxProps {
  value: string;
  onChange: (market: string) => void;
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

  // Non-top markets excluding top markets
  const nonTopMarkets = React.useMemo(
    () => SFS_US_MARKETS.filter((m) => !isTopMarket(m)),
    []
  );

  // Filter markets by query
  const filteredTopMarkets = React.useMemo(() => {
    if (!normalizedQuery) return [...SFS_TOP_MARKETS];
    return SFS_TOP_MARKETS.filter((m) =>
      normalizeMarket(m).includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  const filteredOtherMarkets = React.useMemo(() => {
    if (!normalizedQuery) return nonTopMarkets;
    return nonTopMarkets.filter((m) =>
      normalizeMarket(m).includes(normalizedQuery)
    );
  }, [normalizedQuery, nonTopMarkets]);

  // Check if query could be a custom market
  const showCustomOption = React.useMemo(() => {
    if (!query.trim()) return false;
    return !isKnownMarket(query);
  }, [query]);

  // Combined list for keyboard navigation
  const allOptions = React.useMemo(() => {
    const opts: { type: "top" | "other" | "custom"; value: string }[] = [];
    for (const m of filteredTopMarkets) opts.push({ type: "top", value: m });
    for (const m of filteredOtherMarkets) opts.push({ type: "other", value: m });
    if (showCustomOption) opts.push({ type: "custom", value: query.trim() });
    return opts;
  }, [filteredTopMarkets, filteredOtherMarkets, showCustomOption, query]);

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
          selectMarket(allOptions[highlightIndex].value);
        } else if (allOptions.length > 0) {
          selectMarket(allOptions[0].value);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setQuery("");
        break;
    }
  };

  const selectMarket = (market: string) => {
    onChange(market);
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

  const isTop = isTopMarket(value);
  const displayValue = value || "Select market";

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border bg-background/50 px-3 py-2 text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          invalid
            ? "border-[var(--warp-field-error)] focus-visible:ring-[var(--warp-focus-ring-danger)]"
            : "border-border/60 focus-visible:ring-[var(--warp-focus-ring)]",
          !value && "text-muted-foreground"
        )}
      >
        <span className="truncate">{displayValue}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className={cn(
            "absolute left-0 top-full z-50 mt-1 w-full min-w-[280px] overflow-hidden rounded-xl",
            "border border-border bg-popover shadow-[var(--shadow-elev-2)]"
          )}
        >
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
          <div ref={listRef} className="max-h-[320px] overflow-y-auto p-1">
            {/* Quick-pick top markets as chips (only when not searching) */}
            {!normalizedQuery && (
              <div className="mb-2 p-2">
                <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Top Markets
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SFS_TOP_MARKETS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => selectMarket(m)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                        value === m
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/50 text-foreground hover:bg-muted"
                      )}
                    >
                      {m}
                      {value === m && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Filtered top markets (when searching) */}
            {normalizedQuery && filteredTopMarkets.length > 0 && (
              <div className="mb-1">
                <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Top Markets
                </div>
                {filteredTopMarkets.map((m, idx) => (
                  <MarketListItem
                    key={m}
                    market={m}
                    isSelected={value === m}
                    isHighlighted={highlightIndex === idx}
                    isTop={true}
                    dataIndex={idx}
                    onClick={() => selectMarket(m)}
                  />
                ))}
              </div>
            )}

            {/* Other markets list */}
            {(normalizedQuery ? filteredOtherMarkets.length > 0 : true) && (
              <div>
                <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {normalizedQuery ? "All Markets" : "Browse All Markets"}
                </div>
                {(normalizedQuery ? filteredOtherMarkets : nonTopMarkets.slice(0, 20)).map((m, idx) => {
                  const globalIdx = filteredTopMarkets.length + idx;
                  return (
                    <MarketListItem
                      key={m}
                      market={m}
                      isSelected={value === m}
                      isHighlighted={highlightIndex === globalIdx}
                      isTop={false}
                      dataIndex={globalIdx}
                      onClick={() => selectMarket(m)}
                    />
                  );
                })}
                {!normalizedQuery && nonTopMarkets.length > 20 && (
                  <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                    Type to search {nonTopMarkets.length - 20} more markets...
                  </div>
                )}
              </div>
            )}

            {/* Custom market option */}
            {showCustomOption && (
              <div className="border-t border-border/30 pt-1">
                <MarketListItem
                  market={query.trim()}
                  isSelected={value === query.trim()}
                  isHighlighted={highlightIndex === allOptions.length - 1}
                  isTop={false}
                  isCustom={true}
                  dataIndex={allOptions.length - 1}
                  onClick={() => selectMarket(query.trim())}
                />
              </div>
            )}

            {/* No results */}
            {normalizedQuery && filteredTopMarkets.length === 0 && filteredOtherMarkets.length === 0 && !showCustomOption && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No markets found
              </div>
            )}
          </div>
        </div>
      )}

      {/* Helper text for non-top markets */}
      {value && !isTop && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Non-top markets include a <span className="font-medium">+${NON_TOP_MARKET_BASE_SURCHARGE} base</span> adjustment.
        </p>
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
  isCustom?: boolean;
  dataIndex: number;
  onClick: () => void;
}

function MarketListItem({
  market,
  isSelected,
  isHighlighted,
  isTop,
  isCustom,
  dataIndex,
  onClick,
}: MarketListItemProps) {
  return (
    <button
      type="button"
      data-index={dataIndex}
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
        isHighlighted && "bg-muted",
        isSelected && "text-primary",
        !isHighlighted && !isSelected && "hover:bg-muted/50"
      )}
    >
      <span className="flex items-center gap-2">
        {isCustom ? (
          <>
            Use &ldquo;<span className="font-medium">{market}</span>&rdquo;
          </>
        ) : (
          market
        )}
      </span>
      <span className="flex items-center gap-1.5">
        {!isTop && (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            +${NON_TOP_MARKET_BASE_SURCHARGE} base
          </span>
        )}
        {isSelected && <Check className="h-4 w-4 text-primary" />}
      </span>
    </button>
  );
}

