"use client";

import * as React from "react";
import { RotateCcw, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  { key: "anchor_packages", label: "Anchor packages", unit: "pkgs", helper: "Total packages at anchor store", min: 1 },
  { key: "anchor_stops", label: "Anchor stops", unit: "stops", helper: "Delivery stops from anchor", min: 0 },
  { key: "pickup_route_miles", label: "Pickup route miles", unit: "mi", helper: "Distance from hub to anchor", min: 0 },
  { key: "avg_routing_time_per_stop", label: "Avg time per stop", unit: "min", helper: "Including parking/walking", min: 1 },
  { key: "pickup_window_minutes", label: "Pickup window", unit: "min", helper: "Time available for pickups", min: 0 },
  { key: "avg_cubic_inches_per_package", label: "Avg package size", unit: "cu in", helper: "Average cubic inches", min: 1 },
];

const SATELLITE_FIELDS: FieldConfig[] = [
  { key: "satellite_stores", label: "Satellite stores", unit: "#", helper: "Number of satellite pickups", min: 0 },
  { key: "satellite_packages", label: "Satellite packages", unit: "pkgs", helper: "Total from all satellites", min: 0 },
  { key: "satellite_extra_miles", label: "Detour miles", unit: "mi", helper: "Extra miles for satellites", min: 0 },
  { key: "miles_to_hub_or_spoke", label: "Hub/spoke distance", unit: "mi", helper: "One-way to hub or spoke", min: 0 },
];

const CONSTRAINT_FIELDS: FieldConfig[] = [
  { key: "max_satellite_packages_allowed", label: "Max satellite pkgs", unit: "pkgs", helper: "Density threshold", min: 0 },
  { key: "max_satellite_miles_allowed", label: "Max satellite miles", unit: "mi", helper: "Density threshold", min: 0 },
  { key: "max_driver_time_minutes", label: "Max driver time", unit: "min", helper: "Shift length limit", min: 1 },
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
        <Label htmlFor={field.key} className="text-xs text-muted-foreground">
          {field.label}
          {field.unit && <span className="ml-1 text-muted-foreground/50">({field.unit})</span>}
        </Label>
        <div className="relative">
          <Input
            id={field.key}
            type="number"
            min={field.min ?? 0}
            step="any"
            value={typeof value === "number" ? value : ""}
            onChange={(e) => handleNumericChange(field.key, e.target.value)}
            className={error ? "border-destructive pr-8" : ""}
          />
          {error && (
            <AlertCircle className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-destructive" />
          )}
        </div>
        {field.helper && !error && (
          <p className="text-[10px] leading-tight text-muted-foreground/60">{field.helper}</p>
        )}
        {error && <p className="text-[10px] leading-tight text-destructive">{error}</p>}
      </div>
    );
  };

  return (
    <Card className="border-border/60 bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-sm font-medium">Route Inputs</CardTitle>
        <Button variant="ghost" size="sm" onClick={onReset} className="h-7 text-xs">
          <RotateCcw className="mr-1.5 h-3 w-3" />
          Reset
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Market & Vehicle selection */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="market" className="text-xs text-muted-foreground">Market</Label>
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
              <p className="text-[10px] leading-tight text-muted-foreground">
                No rate cards configured. Ask an admin to add rate cards in Admin → Setup.
              </p>
            )}
            {validationErrors.market && (
              <p className="text-[10px] leading-tight text-destructive">{validationErrors.market}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="vehicle_type" className="text-xs text-muted-foreground">Vehicle Type</Label>
            <Select
              id="vehicle_type"
              value={inputs.vehicle_type}
              onChange={(e) => onChange({ ...inputs, vehicle_type: e.target.value as VehicleType })}
              options={vehicleOptions}
              disabled={disabled || noMarkets}
            />
          </div>
        </div>

        {/* Anchor Store section */}
        <div className="space-y-3">
          <div>
            <h4 className="text-xs font-medium text-muted-foreground">Anchor Store</h4>
            <p className="text-[10px] text-muted-foreground/60">Primary pickup location and demand</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">{ANCHOR_FIELDS.map(renderField)}</div>
        </div>

        {/* Satellite section */}
        <div className="space-y-3">
          <div>
            <h4 className="text-xs font-medium text-muted-foreground">Satellite Stores</h4>
            <p className="text-[10px] text-muted-foreground/60">Additional pickups along the route</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">{SATELLITE_FIELDS.map(renderField)}</div>
        </div>

        {/* Constraints section */}
        <div className="space-y-3">
          <div>
            <h4 className="text-xs font-medium text-muted-foreground">Constraints</h4>
            <p className="text-[10px] text-muted-foreground/60">Density eligibility thresholds</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">{CONSTRAINT_FIELDS.map(renderField)}</div>
        </div>
      </CardContent>
    </Card>
  );
}

