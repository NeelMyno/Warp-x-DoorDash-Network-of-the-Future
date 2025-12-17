"use client";

import * as React from "react";
import { RotateCcw, AlertCircle, Store, Truck, Gauge, MapPin, Sliders } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { SfsCalculatorInputs, VehicleType } from "@/lib/sfs-calculator/types";

interface Props {
  inputs: SfsCalculatorInputs;
  onChange: (inputs: SfsCalculatorInputs) => void;
  onReset: () => void;
  markets: string[];
  validationErrors: Record<string, string>;
  /** When true, rate cards aren't available yet */
  disabled?: boolean;
}

interface FieldConfig {
  key: keyof SfsCalculatorInputs;
  label: string;
  unit?: string;
  helper?: string;
  min?: number;
}

const ANCHOR_FIELDS: FieldConfig[] = [
  { key: "anchor_packages", label: "Anchor packages", unit: "pkgs", min: 1 },
  { key: "anchor_stops", label: "Anchor stops", unit: "stops", min: 0 },
  { key: "pickup_route_miles", label: "Pickup route miles", unit: "mi", min: 0 },
  { key: "avg_routing_time_per_stop", label: "Avg time per stop", unit: "min", min: 1 },
  { key: "pickup_window_minutes", label: "Pickup window", unit: "min", min: 0 },
  { key: "avg_cubic_inches_per_package", label: "Avg package size", unit: "cu in", min: 1 },
];

const SATELLITE_FIELDS: FieldConfig[] = [
  { key: "satellite_stores", label: "Satellite stores", unit: "#", min: 0 },
  { key: "satellite_packages", label: "Satellite packages", unit: "pkgs", min: 0 },
  { key: "satellite_extra_miles", label: "Detour miles", unit: "mi", min: 0 },
  { key: "miles_to_hub_or_spoke", label: "Hub/spoke distance", unit: "mi", min: 0 },
];

const CONSTRAINT_FIELDS: FieldConfig[] = [
  { key: "max_satellite_packages_allowed", label: "Max satellite pkgs", unit: "pkgs", min: 0 },
  { key: "max_satellite_miles_allowed", label: "Max satellite miles", unit: "mi", min: 0 },
  { key: "max_driver_time_minutes", label: "Max driver time", unit: "min", min: 1 },
];

export function SfsCalculatorInputsPanel({
  inputs,
  onChange,
  onReset,
  markets,
  validationErrors,
  disabled = false,
}: Props) {
  const vehicleOptions = [
    { value: "Cargo Van", label: "Cargo Van" },
    { value: "Box Truck", label: "Box Truck" },
  ];

  const marketOptions = markets.map((m) => ({ value: m, label: m }));
  const noMarkets = markets.length === 0;

  const handleNumericChange = (key: keyof SfsCalculatorInputs, value: string) => {
    const num = value === "" ? 0 : parseFloat(value);
    if (!isNaN(num)) {
      onChange({ ...inputs, [key]: Math.max(0, num) });
    }
  };

  const renderField = (field: FieldConfig) => {
    const value = inputs[field.key];
    const error = validationErrors[field.key];

    return (
      <div key={field.key} className="space-y-1">
        <Label htmlFor={field.key} className="flex items-baseline justify-between text-[11px]">
          <span className="text-muted-foreground">{field.label}</span>
          {field.unit && (
            <span className="text-[10px] font-normal text-muted-foreground/60">{field.unit}</span>
          )}
        </Label>
        <div className="relative">
          <Input
            id={field.key}
            type="number"
            min={field.min ?? 0}
            step="any"
            value={typeof value === "number" ? value : ""}
            onChange={(e) => handleNumericChange(field.key, e.target.value)}
            className={`h-9 tabular-nums ${
              error
                ? "border-[var(--warp-field-error)] pr-8 focus-visible:ring-[var(--warp-focus-ring-danger)]"
                : "border-border/60 bg-background/50 focus:border-border focus-visible:ring-[var(--warp-focus-ring)]"
            }`}
          />
          {error && (
            <AlertCircle className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--warp-danger)]" />
          )}
        </div>
        {error && <p className="text-[10px] leading-tight text-[var(--warp-danger)]">{error}</p>}
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card/40">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Route Inputs</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
      </div>

      <div className="divide-y divide-border/40">
        {/* Route Configuration section */}
        <div className="px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Route Configuration
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="market" className="text-[11px] text-muted-foreground">
                Market
              </Label>
              <Select
                id="market"
                value={inputs.market}
                onChange={(e) => onChange({ ...inputs, market: e.target.value })}
                options={marketOptions}
                placeholder={noMarkets ? "No markets available" : "Select market"}
                disabled={disabled || noMarkets}
                invalid={!!validationErrors.market}
              />
              {noMarkets && !disabled && (
                <p className="text-[10px] leading-tight text-muted-foreground/70">
                  No rate cards configured.
                </p>
              )}
              {validationErrors.market && (
                <p className="text-[10px] leading-tight text-[var(--warp-danger)]">
                  {validationErrors.market}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="vehicle_type" className="text-[11px] text-muted-foreground">
                Vehicle Type
              </Label>
              <Select
                id="vehicle_type"
                value={inputs.vehicle_type}
                onChange={(e) =>
                  onChange({ ...inputs, vehicle_type: e.target.value as VehicleType })
                }
                options={vehicleOptions}
                disabled={disabled || noMarkets}
              />
            </div>
          </div>
        </div>

        {/* Anchor Store section */}
        <div className="px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <Store className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Anchor Store
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">{ANCHOR_FIELDS.map(renderField)}</div>
        </div>

        {/* Satellite section */}
        <div className="px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Satellite Stores
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">{SATELLITE_FIELDS.map(renderField)}</div>
        </div>

        {/* Constraints section */}
        <div className="px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Constraints
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">{CONSTRAINT_FIELDS.map(renderField)}</div>
        </div>
      </div>
    </div>
  );
}

