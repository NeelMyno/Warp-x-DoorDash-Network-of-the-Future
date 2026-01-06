"use client";

import * as React from "react";
import { ChevronDown, Search, Check, AlertTriangle, X, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SFS_TOP_10_LOCATIONS,
  SFS_ALL_62_LOCATIONS,
  searchLocations,
  findLocationById,
  normalizeString,
  getDisplayLabel,
  type CrossdockLocation,
} from "@/lib/sfs-calculator/markets";

interface MarketComboboxProps {
  /** Location ID (stored value) */
  value: string;
  /** Called with location ID when selection changes */
  onChange: (locationId: string) => void;
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

  const normalizedQuery = normalizeString(query);

  // Resolve selected location from ID
  const selectedLocation = React.useMemo(() => findLocationById(value), [value]);

  // Check if value is stale (set but not found in current 62 locations)
  const isStaleSelection = value && !selectedLocation;

  // Non-top locations
  const nonTopLocations = React.useMemo(
    () => SFS_ALL_62_LOCATIONS.filter((loc) => !loc.isTop10),
    []
  );

  // Filter locations by query
  const filteredTopLocations = React.useMemo(() => {
    if (!normalizedQuery) return [...SFS_TOP_10_LOCATIONS];
    return searchLocations(query).filter((loc) => loc.isTop10);
  }, [normalizedQuery, query]);

  const filteredOtherLocations = React.useMemo(() => {
    if (!normalizedQuery) return nonTopLocations;
    return searchLocations(query).filter((loc) => !loc.isTop10);
  }, [normalizedQuery, nonTopLocations, query]);

  // Combined list for keyboard navigation (IDs)
  const allOptions = React.useMemo(() => {
    const opts: CrossdockLocation[] = [];
    for (const loc of filteredTopLocations) opts.push(loc);
    for (const loc of filteredOtherLocations) opts.push(loc);
    return opts;
  }, [filteredTopLocations, filteredOtherLocations]);

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
          selectLocation(allOptions[highlightIndex].id);
        } else if (allOptions.length > 0) {
          selectLocation(allOptions[0].id);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setQuery("");
        break;
    }
  };

  const selectLocation = (locationId: string) => {
    onChange(locationId);
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
      {/* Trigger button - matches Vehicle type dropdown styling */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={selectedLocation ? `Market: ${getDisplayLabel(selectedLocation)}` : "Select crossdock location"}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border bg-background/50 px-3 py-2 text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          invalid || isStaleSelection
            ? "border-[var(--warp-field-error)] focus-visible:ring-[var(--warp-focus-ring-danger)]"
            : "border-border/60 focus-visible:ring-[var(--warp-focus-ring)]",
          !selectedLocation && "text-muted-foreground"
        )}
      >
        <span className="truncate">
          {selectedLocation ? getDisplayLabel(selectedLocation) : "Select market"}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {/* Stale selection warning */}
      {isStaleSelection && (
        <div className="mt-1 flex items-center gap-1 text-xs text-amber-500">
          <AlertTriangle className="h-3 w-3" />
          <span>Previously selected market is no longer available. Please choose a crossdock location.</span>
        </div>
      )}



      {/* Dropdown panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Select crossdock location"
          className={cn(
            "absolute left-0 top-full z-50 mt-1 w-full min-w-[380px] overflow-hidden rounded-xl",
            "border border-border bg-popover shadow-[var(--shadow-elev-2)]"
          )}
        >
          {/* Header with title */}
          <div className="border-b border-border/50 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Select crossdock location</h3>
                <p className="text-[11px] text-muted-foreground">
                  Choose from 62 locations. Top 10 are quick picks.
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
                placeholder="Search by airport code, city, or state..."
                className={cn(
                  "h-9 w-full rounded-lg border border-border/50 bg-background/50 pl-9 pr-3 text-sm",
                  "placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--warp-focus-ring)]"
                )}
              />
            </div>
          </div>

          {/* Location list */}
          <div ref={listRef} className="max-h-[340px] overflow-y-auto p-1" role="listbox">
            {/* Quick-pick Top 10 as pills (only when not searching) */}
            {!normalizedQuery && (
              <div className="mb-2 p-2">
                <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Quick Pick — Top 10 Crossdocks
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SFS_TOP_10_LOCATIONS.map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => selectLocation(loc.id)}
                      title={`${loc.airportCode} — ${loc.city}, ${loc.state} • ZIP ${loc.zip}`}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors",
                        value === loc.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/60 text-foreground hover:bg-muted"
                      )}
                    >
                      <span className="font-semibold">{loc.airportCode}</span>
                      <span className="opacity-70">•</span>
                      <span>{loc.city}</span>
                      {value === loc.id && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Filtered Top 10 (when searching) */}
            {normalizedQuery && filteredTopLocations.length > 0 && (
              <div className="mb-1">
                <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Top 10 Crossdocks
                </div>
                {filteredTopLocations.map((loc, idx) => (
                  <LocationListItem
                    key={loc.id}
                    location={loc}
                    isSelected={value === loc.id}
                    isHighlighted={highlightIndex === idx}
                    dataIndex={idx}
                    onClick={() => selectLocation(loc.id)}
                  />
                ))}
              </div>
            )}

            {/* Other locations list */}
            {(normalizedQuery ? filteredOtherLocations.length > 0 : true) && (
              <div>
                <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {normalizedQuery ? "All Crossdocks" : "Browse All 62 Crossdocks"}
                </div>
                {(normalizedQuery ? filteredOtherLocations : nonTopLocations).map((loc, idx) => {
                  const globalIdx = filteredTopLocations.length + idx;
                  return (
                    <LocationListItem
                      key={loc.id}
                      location={loc}
                      isSelected={value === loc.id}
                      isHighlighted={highlightIndex === globalIdx}
                      dataIndex={globalIdx}
                      onClick={() => selectLocation(loc.id)}
                    />
                  );
                })}
              </div>
            )}

            {/* No results - enhanced empty state */}
            {normalizedQuery && filteredTopLocations.length === 0 && filteredOtherLocations.length === 0 && (
              <div className="px-3 py-6 text-center">
                <MapPin className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium text-foreground">No crossdock found</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Try searching by airport code (e.g., ATL) or ZIP.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setHighlightIndex(-1);
                    inputRef.current?.focus();
                  }}
                  className="mt-3 text-xs font-medium text-primary hover:underline"
                >
                  Clear search
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
// LocationListItem subcomponent
// ─────────────────────────────────────────────────────────────────────────────

interface LocationListItemProps {
  location: CrossdockLocation;
  isSelected: boolean;
  isHighlighted: boolean;
  dataIndex: number;
  onClick: () => void;
}

function LocationListItem({
  location,
  isSelected,
  isHighlighted,
  dataIndex,
  onClick,
}: LocationListItemProps) {
  // Extract site suffix if present (e.g., "(Site A)")
  const siteSuffixMatch = location.label.match(/\(Site [A-Z]\)$/);
  const siteSuffix = siteSuffixMatch ? siteSuffixMatch[0] : null;

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
        {/* Primary: Airport — City, State + site suffix */}
        <div className="text-sm font-medium truncate">
          {getDisplayLabel(location)}
          {siteSuffix && (
            <span className="ml-1 text-muted-foreground font-normal">{siteSuffix}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Badge: Top 10 only */}
        {location.isTop10 && (
          <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            Top 10
          </span>
        )}
        {isSelected && <Check className="h-4 w-4 text-primary" />}
      </div>
    </button>
  );
}

