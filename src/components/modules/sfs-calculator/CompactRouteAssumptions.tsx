"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Settings } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { SfsCalculatorInputs, VehicleType, SfsRateCard } from "@/lib/sfs-calculator/types";
import { SFS_MARKETS } from "@/lib/sfs-calculator/types";
import { formatCurrency } from "@/lib/sfs-calculator/format";

const OTHER_MARKET_VALUE = "__other__";

interface CompactRouteAssumptionsProps {
  inputs: SfsCalculatorInputs;
  onInputsChange: (inputs: SfsCalculatorInputs) => void;
  validationErrors: Record<string, string>;
  rateCard: SfsRateCard | null;
  isAdmin: boolean;
}

export function CompactRouteAssumptions({
  inputs,
  onInputsChange,
  validationErrors,
  rateCard,
  isAdmin,
}: CompactRouteAssumptionsProps) {
  const [assumptionsExpanded, setAssumptionsExpanded] = React.useState(false);
  const [ratesExpanded, setRatesExpanded] = React.useState(false);

  const marketSelectValue = SFS_MARKETS.includes(inputs.market as (typeof SFS_MARKETS)[number])
    ? inputs.market
    : OTHER_MARKET_VALUE;

  return (
    <div data-tour="assumptions" className="space-y-3">
      {/* Primary controls row */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[160px] space-y-1">
          <Label className="text-[11px] text-muted-foreground">Market</Label>
          <Select
            value={marketSelectValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v === OTHER_MARKET_VALUE) {
                onInputsChange({ ...inputs, market: "" });
              } else {
                onInputsChange({ ...inputs, market: v });
              }
            }}
            options={[
              ...SFS_MARKETS.map((m) => ({ value: m, label: m })),
              { value: OTHER_MARKET_VALUE, label: "Other…" },
            ]}
            placeholder="Select market"
            invalid={!!validationErrors.market}
          />
        </div>

        {marketSelectValue === OTHER_MARKET_VALUE && (
          <div className="min-w-[140px]">
            <Input
              value={inputs.market}
              onChange={(e) => onInputsChange({ ...inputs, market: e.target.value })}
              placeholder="Enter market"
              className="h-9"
            />
          </div>
        )}

        <div className="min-w-[160px] space-y-1">
          <Label className="text-[11px] text-muted-foreground">Vehicle type</Label>
          <Select
            value={inputs.vehicle_type}
            onChange={(e) =>
              onInputsChange({ ...inputs, vehicle_type: e.target.value as VehicleType })
            }
            options={[
              { value: "Cargo Van", label: "Cargo Van" },
              { value: "26' Box Truck", label: "26' Box Truck" },
            ]}
          />
        </div>
      </div>

      {/* Collapsible: Advanced assumptions */}
      <button
        type="button"
        onClick={() => setAssumptionsExpanded(!assumptionsExpanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        {assumptionsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Advanced assumptions
      </button>

      {assumptionsExpanded && (
        <div className="grid gap-3 rounded-lg border border-border bg-background/10 p-3 sm:grid-cols-3">
          {[
            { key: "miles_to_hub_or_spoke", label: "Miles to hub/spoke" },
            { key: "avg_routing_time_per_stop_minutes", label: "Time between stops (min)" },
            { key: "default_service_time_minutes", label: "Time per stop (min)" },
            { key: "avg_speed_mph", label: "Avg speed (mph)" },
          ].map((field) => {
            const key = field.key as keyof SfsCalculatorInputs;
            const value = inputs[key];
            return (
              <div key={field.key} className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">{field.label}</Label>
                <Input
                  type="number"
                  step="any"
                  value={typeof value === "number" ? value : 0}
                  onChange={(e) => onInputsChange({ ...inputs, [key]: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Admin-only: Rate configuration */}
      {isAdmin && (
        <>
          <button
            type="button"
            onClick={() => setRatesExpanded(!ratesExpanded)}
            className="flex items-center gap-1.5 text-xs text-amber-500/80 hover:text-amber-500"
          >
            {ratesExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Settings className="h-3 w-3" />
            Admin: Rates
          </button>

          {ratesExpanded && rateCard && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs">
              <div className="grid gap-2 sm:grid-cols-3">
                <div>Base fee: <span className="tabular-nums font-medium">{formatCurrency(rateCard.base_fee)}</span></div>
                <div>Per mile: <span className="tabular-nums font-medium">{formatCurrency(rateCard.per_mile_rate)}</span></div>
                <div>Per stop: <span className="tabular-nums font-medium">{formatCurrency(rateCard.per_stop_rate)}</span></div>
              </div>
              <Link href="/admin?tab=setup" className="mt-2 inline-block text-xs underline hover:text-foreground">
                Edit in Admin
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

